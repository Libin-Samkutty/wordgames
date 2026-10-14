import { RECENT_ANSWER_WINDOW, RECENT_GAMES_LIMIT } from '@/engine/constants';
import { timeBucketIndex } from '@/engine/shuffle/constants';
import type { ShuffleRecord, ShuffleState } from '@/engine/shuffle/types';
import type { WordLength } from '@/engine/types';

import { createRepository, type Repository, type StorageIssue } from './createRepository';
import { gameKeys } from './keys';
import { addSolveTime } from './timeStats';
import {
  DEFAULT_SHUFFLE_PREFS,
  defaultShuffleMeta,
  defaultShuffleStats,
  validateShuffleMeta,
  validateShufflePrefs,
  validateShuffleSession,
  validateShuffleStats,
  type ShuffleMeta,
  type ShufflePrefs,
  type ShuffleStatsBucket,
  type ShuffleStatsState,
} from './shuffleSchemas';

type OnIssue = (issue: StorageIssue, key: string) => void;

const keys = gameKeys('shuffle');

/* ------------------------------------------------------------------ *
 * Repositories: one key each under `wordgames:v1:shuffle:` (FR-99)
 * ------------------------------------------------------------------ */

export function createShufflePrefsRepository(onIssue?: OnIssue): Repository<ShufflePrefs> {
  return createRepository<ShufflePrefs>({
    key: keys.prefs,
    defaults: () => DEFAULT_SHUFFLE_PREFS,
    validate: validateShufflePrefs,
    ...(onIssue ? { onIssue } : {}),
  });
}

export function createShuffleStatsRepository(onIssue?: OnIssue): Repository<ShuffleStatsState> {
  return createRepository<ShuffleStatsState>({
    key: keys.stats,
    defaults: defaultShuffleStats,
    validate: validateShuffleStats,
    ...(onIssue ? { onIssue } : {}),
  });
}

export function createShuffleSessionRepository(onIssue?: OnIssue): Repository<ShuffleState | null> {
  return createRepository<ShuffleState | null>({
    key: keys.session,
    defaults: () => null,
    validate: (value) => (value === null ? null : validateShuffleSession(value)),
    ...(onIssue ? { onIssue } : {}),
  });
}

export function createShuffleMetaRepository(onIssue?: OnIssue): Repository<ShuffleMeta> {
  return createRepository<ShuffleMeta>({
    key: keys.meta,
    defaults: defaultShuffleMeta,
    validate: validateShuffleMeta,
    ...(onIssue ? { onIssue } : {}),
  });
}

/* ------------------------------------------------------------------ *
 * Statistics (FR-146)
 * ------------------------------------------------------------------ */

function applyToBucket(bucket: ShuffleStatsBucket, record: ShuffleRecord): ShuffleStatsBucket {
  const gamesPlayed = bucket.gamesPlayed + 1;

  // A give up breaks the streak and leaves the best untouched.
  if (!record.solved) return { ...bucket, gamesPlayed, currentStreak: 0 };

  const currentStreak = bucket.currentStreak + 1;

  const timeDistribution = [...bucket.timeDistribution];
  if (record.solveMs !== undefined) {
    const index = timeBucketIndex(record.solveMs);
    timeDistribution[index] = (timeDistribution[index] ?? 0) + 1;
  }
  const multi = record.anagramCount !== undefined && record.anagramCount > 1;

  return {
    ...addSolveTime(bucket, record.solveMs),
    timeDistribution,
    multiAnswerSolves: bucket.multiAnswerSolves + (multi ? 1 : 0),
    altAnswerSolves: bucket.altAnswerSolves + (multi && record.found !== record.target ? 1 : 0),
    gamesPlayed,
    gamesSolved: bucket.gamesSolved + 1,
    solvedWithoutHints: bucket.solvedWithoutHints + (record.hintsUsed === 0 ? 1 : 0),
    totalHintsOnSolves: bucket.totalHintsOnSolves + record.hintsUsed,
    currentStreak,
    bestStreak: Math.max(bucket.bestStreak, currentStreak),
  };
}

/**
 * Records a finished puzzle, overall and for its length (FR-146).
 *
 * Idempotent by id: a re-render or a restored session replaying its final
 * state must not inflate the player's stats. Abandoned puzzles are never
 * recorded and never touch streaks.
 */
export function recordShuffleGame(
  stats: ShuffleStatsState,
  record: ShuffleRecord,
): ShuffleStatsState {
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
export function resetShuffleStatistics(stats: ShuffleStatsState): ShuffleStatsState {
  return {
    ...defaultShuffleStats(),
    recentGames: stats.recentGames,
    recordedGameIds: stats.recordedGameIds,
  };
}

/** Clears the recent-games log but keeps the metrics (FR-47). */
export function resetShuffleHistory(stats: ShuffleStatsState): ShuffleStatsState {
  return { ...stats, recentGames: [], recordedGameIds: [] };
}

/** Solve rate as a whole percent, 0 with no puzzles. */
export function shuffleSolvePercentage(bucket: ShuffleStatsBucket): number {
  if (bucket.gamesPlayed === 0) return 0;
  return Math.round((bucket.gamesSolved / bucket.gamesPlayed) * 100);
}

/** Puzzles given up, derived: played minus solved (FR-146). */
export function shuffleGaveUp(bucket: ShuffleStatsBucket): number {
  return bucket.gamesPlayed - bucket.gamesSolved;
}

/** Average hints per solve, or null when nothing has been solved yet (shown as the em dash). */
export function shuffleAverageHints(bucket: ShuffleStatsBucket): number | null {
  if (bucket.gamesSolved === 0) return null;
  return bucket.totalHintsOnSolves / bucket.gamesSolved;
}

/**
 * Solves by hints taken: none, one, two. Worked out from the existing counts, so
 * it is right for puzzles solved before it was shown. Every hinted solve took at
 * least one, so with `h` hinted solves and `t` hints in all, two-hint solves are
 * `t - h` and one-hint solves are `2h - t`.
 */
export function shuffleHintDistribution(bucket: ShuffleStatsBucket): readonly number[] {
  const hinted = bucket.gamesSolved - bucket.solvedWithoutHints;
  const two = bucket.totalHintsOnSolves - hinted;
  return [bucket.solvedWithoutHints, hinted - two, two];
}

/** Share of multi-answer puzzles solved with another word, as a whole percent, or null with none. */
export function shuffleAltAnswerPercentage(bucket: ShuffleStatsBucket): number | null {
  if (bucket.multiAnswerSolves === 0) return null;
  return Math.round((bucket.altAnswerSolves / bucket.multiAnswerSolves) * 100);
}

/* ------------------------------------------------------------------ *
 * Meta: the no-repeat ring buffer, per length (FR-138)
 * ------------------------------------------------------------------ */

/** Puts a puzzle's target at the front of its length's buffer, keeping the last 50. */
export function rememberShuffleAnswer(
  meta: ShuffleMeta,
  length: WordLength,
  answer: string,
): ShuffleMeta {
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
