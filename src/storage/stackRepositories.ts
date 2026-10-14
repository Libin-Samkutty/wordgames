import { RECENT_ANSWER_WINDOW, RECENT_GAMES_LIMIT } from '@/engine/constants';
import { STACK_MODES } from '@/engine/stack/constants';
import type { StackRecord, StackState } from '@/engine/stack/types';

import { createRepository, type Repository, type StorageIssue } from './createRepository';
import { gameKeys } from './keys';
import { addSolveTime } from './timeStats';
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

function applyToBucket<T extends StackStatsBucket>(bucket: T, record: StackRecord): T {
  const gamesPlayed = bucket.gamesPlayed + 1;

  // Games that solved a board, whether or not the game was won, for the first-board average.
  const first = record.boardSolveGuesses?.filter((guess): guess is number => guess !== null);
  const hasFirst = first !== undefined && first.length > 0;
  const withFirst = {
    ...bucket,
    firstBoardGames: bucket.firstBoardGames + (hasFirst ? 1 : 0),
    totalFirstBoardGuess: bucket.totalFirstBoardGuess + (hasFirst ? Math.min(...first) : 0),
  };

  // A loss breaks the streak and leaves the best untouched.
  if (!record.won) {
    const boards = STACK_MODES[record.mode].boards;
    return {
      ...withFirst,
      gamesPlayed,
      currentStreak: 0,
      nearMisses: bucket.nearMisses + (record.boardsSolved === boards - 1 ? 1 : 0),
      boardsSolvedOnLosses: bucket.boardsSolvedOnLosses + record.boardsSolved,
    };
  }

  const currentStreak = bucket.currentStreak + 1;
  return {
    ...withFirst,
    ...addSolveTime(bucket, record.solveMs),
    gamesPlayed,
    gamesWon: bucket.gamesWon + 1,
    currentStreak,
    bestStreak: Math.max(bucket.bestStreak, currentStreak),
  };
}

/** Folds one finished game into its mode's bucket, including the win distribution. */
function applyToMode(stats: StackModeStats, record: StackRecord): StackModeStats {
  const next = applyToBucket(stats, record);
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
    overall: applyToBucket(stats.overall, record),
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

/** Mean guess on which a game's first board fell, or null if none has. */
export function stackAverageFirstBoard(bucket: StackStatsBucket): number | null {
  if (bucket.firstBoardGames === 0) return null;
  return bucket.totalFirstBoardGuess / bucket.firstBoardGames;
}

/** Mean boards solved in a lost game, or null with no losses. */
export function stackAverageBoardsOnLoss(bucket: StackStatsBucket): number | null {
  const losses = bucket.gamesPlayed - bucket.gamesWon;
  if (losses === 0) return null;
  return bucket.boardsSolvedOnLosses / losses;
}

/**
 * Wins by guesses to spare, summed over both modes, most spare first. Duo and Quad
 * each have six distribution buckets and the same spread (the fewest-guess win has 5
 * to spare in both), so index i adds up directly.
 */
export function stackSpareDistribution(stats: StackStatsState): readonly number[] {
  return stats.perMode.duo.distribution.map(
    (count, index) => count + (stats.perMode.quad.distribution[index] ?? 0),
  );
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
