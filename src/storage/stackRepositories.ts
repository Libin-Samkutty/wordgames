import { RECENT_ANSWER_WINDOW, RECENT_GAMES_LIMIT } from '@/engine/constants';
import type { StackRecord, StackState } from '@/engine/stack/types';

import { createRepository, type Repository, type StorageIssue } from './createRepository';
import { gameKeys } from './keys';
import {
  DEFAULT_STACK_PREFS,
  STACK_MIN_WIN_GUESSES,
  defaultStackMeta,
  defaultStackStats,
  validateStackMeta,
  validateStackPrefs,
  validateStackSession,
  validateStackStats,
  type StackMeta,
  type StackModeStats,
  type StackPrefs,
  type StackStatsBucket,
  type StackStatsState,
} from './stackSchemas';

type OnIssue = (issue: StorageIssue, key: string) => void;

const keys = gameKeys('stack');

/* ------------------------------------------------------------------ *
 * Repositories: one key each under `wordgames:v1:stack:` (FR-99)
 * ------------------------------------------------------------------ */

export function createStackPrefsRepository(onIssue?: OnIssue): Repository<StackPrefs> {
  return createRepository<StackPrefs>({
    key: keys.prefs,
    defaults: () => DEFAULT_STACK_PREFS,
    validate: validateStackPrefs,
    ...(onIssue ? { onIssue } : {}),
  });
}

export function createStackStatsRepository(onIssue?: OnIssue): Repository<StackStatsState> {
  return createRepository<StackStatsState>({
    key: keys.stats,
    defaults: defaultStackStats,
    validate: validateStackStats,
    ...(onIssue ? { onIssue } : {}),
  });
}

export function createStackSessionRepository(onIssue?: OnIssue): Repository<StackState | null> {
  return createRepository<StackState | null>({
    key: keys.session,
    defaults: () => null,
    validate: (value) => (value === null ? null : validateStackSession(value)),
    ...(onIssue ? { onIssue } : {}),
  });
}

export function createStackMetaRepository(onIssue?: OnIssue): Repository<StackMeta> {
  return createRepository<StackMeta>({
    key: keys.meta,
    defaults: defaultStackMeta,
    validate: validateStackMeta,
    ...(onIssue ? { onIssue } : {}),
  });
}

/* ------------------------------------------------------------------ *
 * Statistics (FR-111)
 * ------------------------------------------------------------------ */

function applyToBucket<T extends StackStatsBucket>(bucket: T, won: boolean): T {
  const gamesPlayed = bucket.gamesPlayed + 1;

  // A loss breaks the streak and leaves the best untouched.
  if (!won) return { ...bucket, gamesPlayed, currentStreak: 0 };

  const currentStreak = bucket.currentStreak + 1;
  return {
    ...bucket,
    gamesPlayed,
    gamesWon: bucket.gamesWon + 1,
    currentStreak,
    bestStreak: Math.max(bucket.bestStreak, currentStreak),
  };
}

/** Folds one finished game into its mode's bucket, including the win distribution. */
function applyToMode(stats: StackModeStats, record: StackRecord): StackModeStats {
  const next = applyToBucket(stats, record.won);
  if (!record.won) return next;

  const distribution = [...stats.distribution];
  const index = record.guessesUsed - STACK_MIN_WIN_GUESSES[record.mode];
  if (index >= 0 && index < distribution.length)
    distribution[index] = (distribution[index] ?? 0) + 1;

  return { ...next, distribution };
}

/**
 * Records a finished game, overall and for its mode (FR-111).
 *
 * Idempotent by id: the reveal callback, a re-render, or a restored session
 * replaying its final state must not inflate the player's stats. Abandoned
 * games are never recorded and never touch streaks.
 */
export function recordStackGame(stats: StackStatsState, record: StackRecord): StackStatsState {
  if (stats.recordedGameIds.includes(record.id)) return stats;

  return {
    overall: applyToBucket(stats.overall, record.won),
    perMode: {
      ...stats.perMode,
      [record.mode]: applyToMode(stats.perMode[record.mode], record),
    },
    recentGames: [record, ...stats.recentGames].slice(0, RECENT_GAMES_LIMIT),
    // Bounded alongside the log, so it cannot grow without limit.
    recordedGameIds: [record.id, ...stats.recordedGameIds].slice(0, RECENT_GAMES_LIMIT * 2),
  };
}

/** Clears the metrics but keeps the recent-games log (FR-47). */
export function resetStackStatistics(stats: StackStatsState): StackStatsState {
  return {
    ...defaultStackStats(),
    recentGames: stats.recentGames,
    recordedGameIds: stats.recordedGameIds,
  };
}

/** Clears the recent-games log but keeps the metrics (FR-47). */
export function resetStackHistory(stats: StackStatsState): StackStatsState {
  return { ...stats, recentGames: [], recordedGameIds: [] };
}

/** Win rate as a whole percent, 0 with no games. */
export function stackWinPercentage(bucket: StackStatsBucket): number {
  if (bucket.gamesPlayed === 0) return 0;
  return Math.round((bucket.gamesWon / bucket.gamesPlayed) * 100);
}

/* ------------------------------------------------------------------ *
 * Meta: the no-repeat ring buffer (FR-103)
 * ------------------------------------------------------------------ */

/** Puts a game's answers at the front of the one shared buffer, keeping the last 50. */
export function rememberStackAnswers(meta: StackMeta, answers: readonly string[]): StackMeta {
  const fresh = new Set(answers);
  return {
    recentAnswers: [...answers, ...meta.recentAnswers.filter((word) => !fresh.has(word))].slice(
      0,
      RECENT_ANSWER_WINDOW,
    ),
  };
}
