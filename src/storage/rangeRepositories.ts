import { RECENT_ANSWER_WINDOW, RECENT_GAMES_LIMIT } from '@/engine/constants';
import type { RangeRecord, RangeState } from '@/engine/range/types';

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

/**
 * Records a finished game (FR-124).
 *
 * Idempotent by id: a re-render or a restored session replaying its final
 * state must not inflate the player's stats. Abandoned games are never
 * recorded and never touch streaks.
 */
export function recordRangeGame(stats: RangeStatsState, record: RangeRecord): RangeStatsState {
  if (stats.recordedGameIds.includes(record.id)) return stats;

  const gamesPlayed = stats.gamesPlayed + 1;
  const recentGames = [record, ...stats.recentGames].slice(0, RECENT_GAMES_LIMIT);
  // Bounded alongside the log, so it cannot grow without limit.
  const recordedGameIds = [record.id, ...stats.recordedGameIds].slice(0, RECENT_GAMES_LIMIT * 2);

  // Counted whether the game was won or lost, for records that carry the field.
  const burning = record.firstBurningGuess;
  const detail = {
    heatTrackedGames: stats.heatTrackedGames + (burning === undefined ? 0 : 1),
    burningGames: stats.burningGames + (typeof burning === 'number' ? 1 : 0),
    totalFirstBurningAt: stats.totalFirstBurningAt + (typeof burning === 'number' ? burning : 0),
  };

  // A loss breaks the streak and leaves the best untouched.
  if (!record.won) {
    const left = record.wordsLeft;
    const closestMiss =
      typeof left === 'number'
        ? stats.closestMiss === null
          ? left
          : Math.min(stats.closestMiss, left)
        : stats.closestMiss;

    return {
      ...stats,
      ...detail,
      closestMiss,
      gamesPlayed,
      currentStreak: 0,
      recentGames,
      recordedGameIds,
    };
  }

  const currentStreak = stats.currentStreak + 1;
  const distribution = [...stats.distribution];
  const index = record.guessesUsed - 1;
  if (index >= 0 && index < distribution.length)
    distribution[index] = (distribution[index] ?? 0) + 1;

  return {
    ...detail,
    closestMiss: stats.closestMiss,
    ...addSolveTime(stats, record.solveMs),
    gamesPlayed,
    gamesWon: stats.gamesWon + 1,
    currentStreak,
    bestStreak: Math.max(stats.bestStreak, currentStreak),
    distribution,
    recentGames,
    recordedGameIds,
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
export function rangeAverageFirstBurning(stats: RangeStatsState): number | null {
  if (stats.burningGames === 0) return null;
  return stats.totalFirstBurningAt / stats.burningGames;
}

/** Share of tracked games that reached Burning, as a whole percent, or null with none. */
export function rangeBurningPercentage(stats: RangeStatsState): number | null {
  if (stats.heatTrackedGames === 0) return null;
  return Math.round((stats.burningGames / stats.heatTrackedGames) * 100);
}

/** Win rate as a whole percent, 0 with no games. */
export function rangeWinPercentage(stats: RangeStatsState): number {
  if (stats.gamesPlayed === 0) return 0;
  return Math.round((stats.gamesWon / stats.gamesPlayed) * 100);
}

/* ------------------------------------------------------------------ *
 * Meta: the no-repeat ring buffer (FR-115)
 * ------------------------------------------------------------------ */

/** Puts a game's secret at the front of the buffer, keeping the last 50. */
export function rememberRangeAnswer(meta: RangeMeta, answer: string): RangeMeta {
  return {
    recentAnswers: [answer, ...meta.recentAnswers.filter((word) => word !== answer)].slice(
      0,
      RECENT_ANSWER_WINDOW,
    ),
  };
}
