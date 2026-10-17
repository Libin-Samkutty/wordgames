import { RECENT_ANSWER_WINDOW, RECENT_GAMES_LIMIT } from '@/engine/constants';
import type { HuntRecord, HuntState } from '@/engine/hunt/types';

import { createRepository, type Repository, type StorageIssue } from './createRepository';
import {
  defaultHuntMeta,
  defaultHuntStats,
  validateHuntMeta,
  validateHuntSession,
  validateHuntStats,
  type HuntMeta,
  type HuntStatsBucket,
  type HuntStatsState,
} from './huntSchemas';
import { gameKeys } from './keys';
import { addSolveTime } from './timeStats';

type OnIssue = (issue: StorageIssue, key: string) => void;

const keys = gameKeys('hunt');

/* ------------------------------------------------------------------ *
 * Repositories: one key each under `wordgames:v1:hunt:` (FR-99)
 *
 * WordHunt has no length to remember, so it has no prefs key.
 * ------------------------------------------------------------------ */

export function createHuntStatsRepository(onIssue?: OnIssue): Repository<HuntStatsState> {
  return createRepository<HuntStatsState>({
    key: keys.stats,
    defaults: defaultHuntStats,
    validate: validateHuntStats,
    ...(onIssue ? { onIssue } : {}),
  });
}

export function createHuntSessionRepository(onIssue?: OnIssue): Repository<HuntState | null> {
  return createRepository<HuntState | null>({
    key: keys.session,
    defaults: () => null,
    validate: (value) => (value === null ? null : validateHuntSession(value)),
    ...(onIssue ? { onIssue } : {}),
  });
}

export function createHuntMetaRepository(onIssue?: OnIssue): Repository<HuntMeta> {
  return createRepository<HuntMeta>({
    key: keys.meta,
    defaults: defaultHuntMeta,
    validate: validateHuntMeta,
    ...(onIssue ? { onIssue } : {}),
  });
}

/* ------------------------------------------------------------------ *
 * Statistics (FR-165)
 * ------------------------------------------------------------------ */

function applyToBucket(bucket: HuntStatsBucket, record: HuntRecord): HuntStatsBucket {
  const counted = {
    ...bucket,
    gamesPlayed: bucket.gamesPlayed + 1,
    totalRequired: bucket.totalRequired + record.requiredCount,
    totalFound: bucket.totalFound + record.foundCount,
    totalBonus: bucket.totalBonus + record.bonusCount,
  };

  // A give up counts as played, and breaks the streak without touching the best.
  if (!record.completed) return { ...counted, currentStreak: 0 };

  const currentStreak = bucket.currentStreak + 1;
  return {
    ...counted,
    ...addSolveTime(bucket, record.solveMs),
    gamesCompleted: bucket.gamesCompleted + 1,
    currentStreak,
    bestStreak: Math.max(bucket.bestStreak, currentStreak),
  };
}

/**
 * Records a finished puzzle (FR-165).
 *
 * Idempotent by id: a re-render or a restored session replaying its final
 * state must not inflate the player's stats. Abandoned puzzles are never
 * recorded and never touch streaks.
 */
export function recordHuntGame(stats: HuntStatsState, record: HuntRecord): HuntStatsState {
  if (stats.recordedGameIds.includes(record.id)) return stats;

  return {
    overall: applyToBucket(stats.overall, record),
    recentGames: [record, ...stats.recentGames].slice(0, RECENT_GAMES_LIMIT),
    // Bounded alongside the log, so it cannot grow without limit.
    recordedGameIds: [record.id, ...stats.recordedGameIds].slice(0, RECENT_GAMES_LIMIT * 2),
  };
}

/** Clears the metrics but keeps the recent-games log (FR-47). */
export function resetHuntStatistics(stats: HuntStatsState): HuntStatsState {
  return {
    ...defaultHuntStats(),
    recentGames: stats.recentGames,
    recordedGameIds: stats.recordedGameIds,
  };
}

/** Clears the recent-games log but keeps the metrics (FR-47). */
export function resetHuntHistory(stats: HuntStatsState): HuntStatsState {
  return { ...stats, recentGames: [], recordedGameIds: [] };
}

/** Share of puzzles with every word found, as a whole percent, 0 with none. */
export function huntCompletionPercentage(bucket: HuntStatsBucket): number {
  if (bucket.gamesPlayed === 0) return 0;
  return Math.round((bucket.gamesCompleted / bucket.gamesPlayed) * 100);
}

/** Share of all the words to find that were found, as a whole percent, or null with none. */
export function huntWordsFoundPercentage(bucket: HuntStatsBucket): number | null {
  if (bucket.totalRequired === 0) return null;
  return Math.round((bucket.totalFound / bucket.totalRequired) * 100);
}

/* ------------------------------------------------------------------ *
 * Meta: the no-repeat ring buffer (FR-158)
 * ------------------------------------------------------------------ */

/** Puts a puzzle's seed at the front of the buffer, keeping the last 50. */
export function rememberHuntSeed(meta: HuntMeta, seed: string): HuntMeta {
  return {
    recentAnswers: [seed, ...meta.recentAnswers.filter((word) => word !== seed)].slice(
      0,
      RECENT_ANSWER_WINDOW,
    ),
  };
}
