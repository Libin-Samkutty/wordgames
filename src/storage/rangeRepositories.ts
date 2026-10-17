import { RECENT_ANSWER_WINDOW, RECENT_GAMES_LIMIT } from '@/engine/constants';
import type { RangeRecord, RangeState } from '@/engine/range/types';
import type { WordLength } from '@/engine/types';

import { createRepository, type Repository, type StorageIssue } from './createRepository';
import { gameKeys } from './keys';
import { addSolveTime } from './timeStats';
import {
  DEFAULT_RANGE_PREFS,
  defaultRangeMeta,
  defaultRangeStats,
  validateRangeMeta,
  validateRangePrefs,
  validateRangeSession,
  validateRangeStats,
  type RangeMeta,
  type RangePrefs,
  type RangeStatsBucket,
  type RangeStatsState,
} from './rangeSchemas';

type OnIssue = (issue: StorageIssue, key: string) => void;

const keys = gameKeys('range');

/* ------------------------------------------------------------------ *
 * Repositories: one key each under `wordgames:v1:range:` (FR-99)
 * ------------------------------------------------------------------ */

export function createRangePrefsRepository(onIssue?: OnIssue): Repository<RangePrefs> {
  return createRepository<RangePrefs>({
    key: keys.prefs,
    defaults: () => DEFAULT_RANGE_PREFS,
    validate: validateRangePrefs,
    ...(onIssue ? { onIssue } : {}),
  });
}

export function createRangeStatsRepository(onIssue?: OnIssue): Repository<RangeStatsState> {
  return createRepository<RangeStatsState>({
    key: keys.stats,
    defaults: defaultRangeStats,
    validate: validateRangeStats,
    ...(onIssue ? { onIssue } : {}),
  });
}

export function createRangeSessionRepository(onIssue?: OnIssue): Repository<RangeState | null> {
  return createRepository<RangeState | null>({
    key: keys.session,
    defaults: () => null,
    validate: (value) => (value === null ? null : validateRangeSession(value)),
    ...(onIssue ? { onIssue } : {}),
  });
}

export function createRangeMetaRepository(onIssue?: OnIssue): Repository<RangeMeta> {
  return createRepository<RangeMeta>({
    key: keys.meta,
    defaults: defaultRangeMeta,
    validate: validateRangeMeta,
    ...(onIssue ? { onIssue } : {}),
  });
}

/* ------------------------------------------------------------------ *
 * Statistics (FR-124)
 * ------------------------------------------------------------------ */

/** The detail counters, which count a game whether it was won or lost. */
function applyDetail(bucket: RangeStatsBucket, record: RangeRecord): RangeStatsBucket {
  const burning = record.firstBurningGuess;

  return {
    ...bucket,
    heatTrackedGames: bucket.heatTrackedGames + (burning === undefined ? 0 : 1),
    burningGames: bucket.burningGames + (typeof burning === 'number' ? 1 : 0),
    totalFirstBurningAt: bucket.totalFirstBurningAt + (typeof burning === 'number' ? burning : 0),
  };
}

function applyToBucket(bucket: RangeStatsBucket, record: RangeRecord): RangeStatsBucket {
  const gamesPlayed = bucket.gamesPlayed + 1;
  const detailed = applyDetail(bucket, record);

  // A loss breaks the streak and leaves the best untouched.
  if (!record.won) {
    const left = record.wordsLeft;
    const closestMiss =
      typeof left === 'number'
        ? bucket.closestMiss === null
          ? left
          : Math.min(bucket.closestMiss, left)
        : bucket.closestMiss;

    return { ...detailed, closestMiss, gamesPlayed, currentStreak: 0 };
  }

  const currentStreak = bucket.currentStreak + 1;
  const distribution = [...bucket.distribution];
  const index = record.guessesUsed - 1;
  if (index >= 0 && index < distribution.length)
    distribution[index] = (distribution[index] ?? 0) + 1;

  return {
    ...detailed,
    ...addSolveTime(bucket, record.solveMs),
    gamesPlayed,
    gamesWon: bucket.gamesWon + 1,
    currentStreak,
    bestStreak: Math.max(bucket.bestStreak, currentStreak),
    distribution,
  };
}

/**
 * Records a finished game, overall and for its length (FR-124).
 *
 * Idempotent by id: a re-render or a restored session replaying its final
 * state must not inflate the player's stats. Abandoned games are never
 * recorded and never touch streaks.
 */
export function recordRangeGame(stats: RangeStatsState, record: RangeRecord): RangeStatsState {
  if (stats.recordedGameIds.includes(record.id)) return stats;

  return {
    overall: applyToBucket(stats.overall, record),
    perLength: {
      ...stats.perLength,
      [record.wordLength]: applyToBucket(stats.perLength[record.wordLength], record),
    },
    recentGames: [record, ...stats.recentGames].slice(0, RECENT_GAMES_LIMIT),
    // Bounded alongside the log, so it cannot grow without limit.
    recordedGameIds: [record.id, ...stats.recordedGameIds].slice(0, RECENT_GAMES_LIMIT * 2),
  };
}

/** Clears the metrics but keeps the recent-games log (FR-47). */
export function resetRangeStatistics(stats: RangeStatsState): RangeStatsState {
  return {
    ...defaultRangeStats(),
    recentGames: stats.recentGames,
    recordedGameIds: stats.recordedGameIds,
  };
}

/** Clears the recent-games log but keeps the metrics (FR-47). */
export function resetRangeHistory(stats: RangeStatsState): RangeStatsState {
  return { ...stats, recentGames: [], recordedGameIds: [] };
}

/** Mean guess on which a game first reached Burning, or null if none did. */
export function rangeAverageFirstBurning(bucket: RangeStatsBucket): number | null {
  if (bucket.burningGames === 0) return null;
  return bucket.totalFirstBurningAt / bucket.burningGames;
}

/** Share of tracked games that reached Burning, as a whole percent, or null with none. */
export function rangeBurningPercentage(bucket: RangeStatsBucket): number | null {
  if (bucket.heatTrackedGames === 0) return null;
  return Math.round((bucket.burningGames / bucket.heatTrackedGames) * 100);
}

/** Win rate as a whole percent, 0 with no games. */
export function rangeWinPercentage(bucket: RangeStatsBucket): number {
  if (bucket.gamesPlayed === 0) return 0;
  return Math.round((bucket.gamesWon / bucket.gamesPlayed) * 100);
}

/* ------------------------------------------------------------------ *
 * Meta: the no-repeat ring buffer, per length (FR-115)
 * ------------------------------------------------------------------ */

/** Puts a game's secret at the front of its length's buffer, keeping the last 50. */
export function rememberRangeAnswer(
  meta: RangeMeta,
  length: WordLength,
  answer: string,
): RangeMeta {
  const previous = meta.recentAnswers[length];

  return {
    recentAnswers: {
      ...meta.recentAnswers,
      [length]: [answer, ...previous.filter((word) => word !== answer)].slice(
        0,
        RECENT_ANSWER_WINDOW,
      ),
    },
  };
}
