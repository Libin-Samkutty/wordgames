import { RECENT_ANSWER_WINDOW, RECENT_GAMES_LIMIT } from '@/engine/constants';
import type { HangRecord, HangState } from '@/engine/hang/types';
import type { WordLength } from '@/engine/types';

import { createRepository, type Repository, type StorageIssue } from './createRepository';
import {
  DEFAULT_HANG_PREFS,
  defaultHangMeta,
  defaultHangStats,
  validateHangMeta,
  validateHangPrefs,
  validateHangSession,
  validateHangStats,
  type HangMeta,
  type HangPrefs,
  type HangStatsBucket,
  type HangStatsState,
} from './hangSchemas';
import { gameKeys } from './keys';
import { addSolveTime } from './timeStats';

type OnIssue = (issue: StorageIssue, key: string) => void;

const keys = gameKeys('hang');

/* ------------------------------------------------------------------ *
 * Repositories: one key each under `wordgames:v1:hang:` (FR-99)
 * ------------------------------------------------------------------ */

export function createHangPrefsRepository(onIssue?: OnIssue): Repository<HangPrefs> {
  return createRepository<HangPrefs>({
    key: keys.prefs,
    defaults: () => DEFAULT_HANG_PREFS,
    validate: validateHangPrefs,
    ...(onIssue ? { onIssue } : {}),
  });
}

export function createHangStatsRepository(onIssue?: OnIssue): Repository<HangStatsState> {
  return createRepository<HangStatsState>({
    key: keys.stats,
    defaults: defaultHangStats,
    validate: validateHangStats,
    ...(onIssue ? { onIssue } : {}),
  });
}

export function createHangSessionRepository(onIssue?: OnIssue): Repository<HangState | null> {
  return createRepository<HangState | null>({
    key: keys.session,
    defaults: () => null,
    validate: (value) => (value === null ? null : validateHangSession(value)),
    ...(onIssue ? { onIssue } : {}),
  });
}

export function createHangMetaRepository(onIssue?: OnIssue): Repository<HangMeta> {
  return createRepository<HangMeta>({
    key: keys.meta,
    defaults: defaultHangMeta,
    validate: validateHangMeta,
    ...(onIssue ? { onIssue } : {}),
  });
}

/* ------------------------------------------------------------------ *
 * Statistics (FR-174)
 * ------------------------------------------------------------------ */

function applyToBucket(bucket: HangStatsBucket, record: HangRecord): HangStatsBucket {
  const gamesPlayed = bucket.gamesPlayed + 1;

  // A loss breaks the streak and leaves the best untouched.
  if (!record.won) return { ...bucket, gamesPlayed, currentStreak: 0 };

  const currentStreak = bucket.currentStreak + 1;
  const distribution = [...bucket.distribution];
  distribution[record.misses] = (distribution[record.misses] ?? 0) + 1;

  return {
    ...bucket,
    ...addSolveTime(bucket, record.solveMs),
    gamesPlayed,
    gamesWon: bucket.gamesWon + 1,
    currentStreak,
    bestStreak: Math.max(bucket.bestStreak, currentStreak),
    distribution,
  };
}

/**
 * Records a finished game, overall and for its length (FR-174).
 *
 * Idempotent by id: a re-render or a restored session replaying its final
 * state must not inflate the player's stats. Abandoned games are never
 * recorded and never touch streaks.
 */
export function recordHangGame(stats: HangStatsState, record: HangRecord): HangStatsState {
  if (stats.recordedGameIds.includes(record.id)) return stats;

  return {
    overall: applyToBucket(stats.overall, record),
    perLength: {
      ...stats.perLength,
      [record.length]: applyToBucket(stats.perLength[record.length], record),
    },
    recentGames: [record, ...stats.recentGames].slice(0, RECENT_GAMES_LIMIT),
    // Bounded alongside the log, so it cannot grow without limit.
    recordedGameIds: [record.id, ...stats.recordedGameIds].slice(0, RECENT_GAMES_LIMIT * 2),
  };
}

/** Clears the metrics but keeps the recent-games log (FR-47). */
export function resetHangStatistics(stats: HangStatsState): HangStatsState {
  return {
    ...defaultHangStats(),
    recentGames: stats.recentGames,
    recordedGameIds: stats.recordedGameIds,
  };
}

/** Clears the recent-games log but keeps the metrics (FR-47). */
export function resetHangHistory(stats: HangStatsState): HangStatsState {
  return { ...stats, recentGames: [], recordedGameIds: [] };
}

/** Win rate as a whole percent, 0 with no games. */
export function hangWinPercentage(bucket: HangStatsBucket): number {
  if (bucket.gamesPlayed === 0) return 0;
  return Math.round((bucket.gamesWon / bucket.gamesPlayed) * 100);
}

/** Mean misses over wins, read off the distribution, or null with no wins. */
export function hangAverageMisses(bucket: HangStatsBucket): number | null {
  if (bucket.gamesWon === 0) return null;
  const total = bucket.distribution.reduce((sum, count, misses) => sum + count * misses, 0);
  return total / bucket.gamesWon;
}

/** Wins with no wrong letter at all. */
export function hangPerfectWins(bucket: HangStatsBucket): number {
  return bucket.distribution[0] ?? 0;
}

/* ------------------------------------------------------------------ *
 * Meta: the no-repeat ring buffer, per length (FR-168)
 * ------------------------------------------------------------------ */

/** Puts a game's secret at the front of its length's buffer, keeping the last 50. */
export function rememberHangAnswer(meta: HangMeta, length: WordLength, answer: string): HangMeta {
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
