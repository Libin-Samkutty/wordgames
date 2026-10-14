import { RECENT_GAMES_LIMIT } from '@/engine/constants';
import { RECENT_START_WINDOW, overParBucketIndex } from '@/engine/weaver/constants';
import type { WeaverLength, WeaverRecord, WeaverState } from '@/engine/weaver/types';

import { createRepository, type Repository, type StorageIssue } from './createRepository';
import { gameKeys } from './keys';
import { addSolveTime } from './timeStats';
import {
  DEFAULT_WEAVER_PREFS,
  defaultWeaverMeta,
  defaultWeaverStats,
  validateWeaverMeta,
  validateWeaverPrefs,
  validateWeaverSession,
  validateWeaverStats,
  type WeaverMeta,
  type WeaverPrefs,
  type WeaverStatsBucket,
  type WeaverStatsState,
} from './weaverSchemas';

type OnIssue = (issue: StorageIssue, key: string) => void;

const keys = gameKeys('weaver');

/* ------------------------------------------------------------------ *
 * Repositories: one key each under `wordgames:v1:weaver:` (FR-68)
 * ------------------------------------------------------------------ */

export function createWeaverPrefsRepository(onIssue?: OnIssue): Repository<WeaverPrefs> {
  return createRepository<WeaverPrefs>({
    key: keys.prefs,
    defaults: () => DEFAULT_WEAVER_PREFS,
    validate: validateWeaverPrefs,
    ...(onIssue ? { onIssue } : {}),
  });
}

export function createWeaverStatsRepository(onIssue?: OnIssue): Repository<WeaverStatsState> {
  return createRepository<WeaverStatsState>({
    key: keys.stats,
    defaults: defaultWeaverStats,
    validate: validateWeaverStats,
    ...(onIssue ? { onIssue } : {}),
  });
}

export function createWeaverSessionRepository(onIssue?: OnIssue): Repository<WeaverState | null> {
  return createRepository<WeaverState | null>({
    key: keys.session,
    defaults: () => null,
    validate: (value) => (value === null ? null : validateWeaverSession(value)),
    ...(onIssue ? { onIssue } : {}),
  });
}

export function createWeaverMetaRepository(onIssue?: OnIssue): Repository<WeaverMeta> {
  return createRepository<WeaverMeta>({
    key: keys.meta,
    defaults: defaultWeaverMeta,
    validate: validateWeaverMeta,
    ...(onIssue ? { onIssue } : {}),
  });
}

/* ------------------------------------------------------------------ *
 * Statistics (FR-92)
 * ------------------------------------------------------------------ */

/** Folds one finished puzzle into a bucket. */
function applyToBucket(bucket: WeaverStatsBucket, record: WeaverRecord): WeaverStatsBucket {
  const gamesPlayed = bucket.gamesPlayed + 1;

  if (!record.solved) {
    // A give up resets the streak and leaves the best untouched.
    return { ...bucket, gamesPlayed, currentStreak: 0 };
  }

  const overPar = record.moves - record.par;
  const currentStreak = bucket.currentStreak + 1;

  const overParDistribution = [...bucket.overParDistribution];
  const index = overParBucketIndex(overPar);
  overParDistribution[index] = (overParDistribution[index] ?? 0) + 1;

  return {
    ...addSolveTime(bucket, record.solveMs),
    overParDistribution,
    totalUndos: bucket.totalUndos + Math.max(0, record.moves - record.ladderLength),
    hardestParSolved:
      bucket.hardestParSolved === null ? record.par : Math.max(bucket.hardestParSolved, record.par),
    gamesPlayed,
    gamesSolved: bucket.gamesSolved + 1,
    parHits: bucket.parHits + (overPar <= 0 ? 1 : 0),
    totalOverPar: bucket.totalOverPar + overPar,
    bestOverPar: bucket.bestOverPar === null ? overPar : Math.min(bucket.bestOverPar, overPar),
    currentStreak,
    bestStreak: Math.max(bucket.bestStreak, currentStreak),
  };
}

/**
 * Records a finished puzzle, overall and for its length (FR-92).
 *
 * Idempotent by id: the reveal callback, a re-render, or a restored session
 * replaying its final state must not inflate the player's stats. Abandoned
 * puzzles are never recorded and never touch streaks.
 */
export function recordWeaverGame(stats: WeaverStatsState, record: WeaverRecord): WeaverStatsState {
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
export function resetWeaverStatistics(stats: WeaverStatsState): WeaverStatsState {
  return {
    ...defaultWeaverStats(),
    recentGames: stats.recentGames,
    recordedGameIds: stats.recordedGameIds,
  };
}

/** Clears the recent-games log but keeps the metrics (FR-47). */
export function resetWeaverHistory(stats: WeaverStatsState): WeaverStatsState {
  return { ...stats, recentGames: [], recordedGameIds: [] };
}

/** Solve rate as a whole percent, 0 with no games (FR-92). */
export function weaverSolvePercentage(bucket: WeaverStatsBucket): number {
  if (bucket.gamesPlayed === 0) return 0;
  return Math.round((bucket.gamesSolved / bucket.gamesPlayed) * 100);
}

/** Puzzles given up on: played but not solved (FR-92). */
export function weaverGaveUp(bucket: WeaverStatsBucket): number {
  return bucket.gamesPlayed - bucket.gamesSolved;
}

/**
 * Average moves over par across solved games, or null when there are none
 * (FR-92). Can be negative: finishing under par is possible (FR-76).
 */
export function averageOverPar(bucket: WeaverStatsBucket): number | null {
  if (bucket.gamesSolved === 0) return null;
  return bucket.totalOverPar / bucket.gamesSolved;
}

/** Solves counted by the over-par chart, which is also what `totalUndos` covers. */
export function weaverDetailSolves(bucket: WeaverStatsBucket): number {
  return bucket.overParDistribution.reduce((sum, count) => sum + count, 0);
}

/** Average undos per solve, or null before any solve was recorded with the detail. */
export function weaverAverageUndos(bucket: WeaverStatsBucket): number | null {
  const solves = weaverDetailSolves(bucket);
  if (solves === 0) return null;
  return bucket.totalUndos / solves;
}

/* ------------------------------------------------------------------ *
 * Meta: the no-repeat start buffer (FR-78)
 * ------------------------------------------------------------------ */

/** Puts a start word at the front of its length's buffer, keeping the last 20. */
export function rememberStart(meta: WeaverMeta, length: WeaverLength, start: string): WeaverMeta {
  const previous = meta.recentStarts[length];

  return {
    recentStarts: {
      ...meta.recentStarts,
      [length]: [start, ...previous.filter((word) => word !== start)].slice(0, RECENT_START_WINDOW),
    },
  };
}
