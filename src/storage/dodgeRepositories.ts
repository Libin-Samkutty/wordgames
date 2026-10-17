import { RECENT_GAMES_LIMIT } from '@/engine/constants';
import { distributionIndex } from '@/engine/dodge/constants';
import type { DodgeRecord, DodgeSession } from '@/engine/dodge/types';

import { createRepository, type Repository, type StorageIssue } from './createRepository';
import {
  DEFAULT_DODGE_PREFS,
  defaultDodgeStats,
  validateDodgePrefs,
  validateDodgeSession,
  validateDodgeStats,
  type DodgePrefs,
  type DodgeStatsBucket,
  type DodgeStatsState,
} from './dodgeSchemas';
import { gameKeys } from './keys';
import { addSolveTime } from './timeStats';

type OnIssue = (issue: StorageIssue, key: string) => void;

const keys = gameKeys('dodge');

/* ------------------------------------------------------------------ *
 * Repositories: one key each under `wordgames:v1:dodge:` (FR-99)
 *
 * WordDodge has no secret to keep from repeating, so it has no meta key.
 * ------------------------------------------------------------------ */

export function createDodgePrefsRepository(onIssue?: OnIssue): Repository<DodgePrefs> {
  return createRepository<DodgePrefs>({
    key: keys.prefs,
    defaults: () => DEFAULT_DODGE_PREFS,
    validate: validateDodgePrefs,
    ...(onIssue ? { onIssue } : {}),
  });
}

export function createDodgeStatsRepository(onIssue?: OnIssue): Repository<DodgeStatsState> {
  return createRepository<DodgeStatsState>({
    key: keys.stats,
    defaults: defaultDodgeStats,
    validate: validateDodgeStats,
    ...(onIssue ? { onIssue } : {}),
  });
}

export function createDodgeSessionRepository(onIssue?: OnIssue): Repository<DodgeSession | null> {
  return createRepository<DodgeSession | null>({
    key: keys.session,
    defaults: () => null,
    validate: (value) => (value === null ? null : validateDodgeSession(value)),
    ...(onIssue ? { onIssue } : {}),
  });
}

/* ------------------------------------------------------------------ *
 * Statistics (FR-155)
 * ------------------------------------------------------------------ */

function applyToBucket(bucket: DodgeStatsBucket, record: DodgeRecord): DodgeStatsBucket {
  const gamesPlayed = bucket.gamesPlayed + 1;

  // A give up counts as played, and breaks the streak without touching the best.
  if (!record.won) return { ...bucket, gamesPlayed, currentStreak: 0 };

  const currentStreak = bucket.currentStreak + 1;
  const distribution = [...bucket.distribution];
  const index = distributionIndex(record.guessesUsed);
  distribution[index] = (distribution[index] ?? 0) + 1;

  return {
    ...bucket,
    ...addSolveTime(bucket, record.solveMs),
    gamesPlayed,
    gamesWon: bucket.gamesWon + 1,
    currentStreak,
    bestStreak: Math.max(bucket.bestStreak, currentStreak),
    distribution,
    totalWinGuesses: bucket.totalWinGuesses + record.guessesUsed,
    fewestGuesses:
      bucket.fewestGuesses === null
        ? record.guessesUsed
        : Math.min(bucket.fewestGuesses, record.guessesUsed),
  };
}

/**
 * Records a finished game, overall and for its length (FR-155).
 *
 * Idempotent by id: a re-render or a restored session replaying its final
 * state must not inflate the player's stats. Abandoned games are never
 * recorded and never touch streaks.
 */
export function recordDodgeGame(stats: DodgeStatsState, record: DodgeRecord): DodgeStatsState {
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
export function resetDodgeStatistics(stats: DodgeStatsState): DodgeStatsState {
  return {
    ...defaultDodgeStats(),
    recentGames: stats.recentGames,
    recordedGameIds: stats.recordedGameIds,
  };
}

/** Clears the recent-games log but keeps the metrics (FR-47). */
export function resetDodgeHistory(stats: DodgeStatsState): DodgeStatsState {
  return { ...stats, recentGames: [], recordedGameIds: [] };
}

/** Win rate as a whole percent, 0 with no games. */
export function dodgeWinPercentage(bucket: DodgeStatsBucket): number {
  if (bucket.gamesPlayed === 0) return 0;
  return Math.round((bucket.gamesWon / bucket.gamesPlayed) * 100);
}

/** Mean guesses over wins, or null with no wins. */
export function dodgeAverageGuesses(bucket: DodgeStatsBucket): number | null {
  if (bucket.gamesWon === 0) return null;
  return bucket.totalWinGuesses / bucket.gamesWon;
}
