import { RECENT_ANSWER_WINDOW, RECENT_GAMES_LIMIT } from '@/engine/constants';
import type { CodeRecord, CodeState } from '@/engine/code/types';
import type { WordLength } from '@/engine/types';

import { createRepository, type Repository, type StorageIssue } from './createRepository';
import {
  DEFAULT_CODE_PREFS,
  defaultCodeMeta,
  defaultCodeStats,
  validateCodeMeta,
  validateCodePrefs,
  validateCodeSession,
  validateCodeStats,
  type CodeMeta,
  type CodePrefs,
  type CodeStatsBucket,
  type CodeStatsState,
} from './codeSchemas';
import { gameKeys } from './keys';
import { addSolveTime } from './timeStats';

type OnIssue = (issue: StorageIssue, key: string) => void;

const keys = gameKeys('code');

/* ------------------------------------------------------------------ *
 * Repositories: one key each under `wordgames:v1:code:` (FR-99)
 * ------------------------------------------------------------------ */

export function createCodePrefsRepository(onIssue?: OnIssue): Repository<CodePrefs> {
  return createRepository<CodePrefs>({
    key: keys.prefs,
    defaults: () => DEFAULT_CODE_PREFS,
    validate: validateCodePrefs,
    ...(onIssue ? { onIssue } : {}),
  });
}

export function createCodeStatsRepository(onIssue?: OnIssue): Repository<CodeStatsState> {
  return createRepository<CodeStatsState>({
    key: keys.stats,
    defaults: defaultCodeStats,
    validate: validateCodeStats,
    ...(onIssue ? { onIssue } : {}),
  });
}

export function createCodeSessionRepository(onIssue?: OnIssue): Repository<CodeState | null> {
  return createRepository<CodeState | null>({
    key: keys.session,
    defaults: () => null,
    validate: (value) => (value === null ? null : validateCodeSession(value)),
    ...(onIssue ? { onIssue } : {}),
  });
}

export function createCodeMetaRepository(onIssue?: OnIssue): Repository<CodeMeta> {
  return createRepository<CodeMeta>({
    key: keys.meta,
    defaults: defaultCodeMeta,
    validate: validateCodeMeta,
    ...(onIssue ? { onIssue } : {}),
  });
}

/* ------------------------------------------------------------------ *
 * Statistics (FR-134)
 * ------------------------------------------------------------------ */

/** The detail counters, which count a game whether it was won or lost. */
function applyDetail(bucket: CodeStatsBucket, record: CodeRecord): CodeStatsBucket {
  const found = record.lettersFoundAt;
  const hasFound = typeof found === 'number' && found > 0;
  const noted = record.usedNotes;

  return {
    ...bucket,
    lettersFoundGames: bucket.lettersFoundGames + (hasFound ? 1 : 0),
    totalLettersFoundAt: bucket.totalLettersFoundAt + (hasFound ? found : 0),
    notesTrackedGames: bucket.notesTrackedGames + (noted === undefined ? 0 : 1),
    notesUsedGames: bucket.notesUsedGames + (noted === true ? 1 : 0),
  };
}

function applyToBucket(bucket: CodeStatsBucket, record: CodeRecord): CodeStatsBucket {
  const gamesPlayed = bucket.gamesPlayed + 1;
  const detailed = applyDetail(bucket, record);

  // A loss breaks the streak and leaves the best untouched.
  if (!record.won) return { ...detailed, gamesPlayed, currentStreak: 0 };

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
 * Records a finished game, overall and for its length (FR-134).
 *
 * Idempotent by id: a re-render or a restored session replaying its final
 * state must not inflate the player's stats. Abandoned games are never
 * recorded and never touch streaks.
 */
export function recordCodeGame(stats: CodeStatsState, record: CodeRecord): CodeStatsState {
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
export function resetCodeStatistics(stats: CodeStatsState): CodeStatsState {
  return {
    ...defaultCodeStats(),
    recentGames: stats.recentGames,
    recordedGameIds: stats.recordedGameIds,
  };
}

/** Clears the recent-games log but keeps the metrics (FR-47). */
export function resetCodeHistory(stats: CodeStatsState): CodeStatsState {
  return { ...stats, recentGames: [], recordedGameIds: [] };
}

/** Mean guess at which a game's letters were all known, or null with none. */
export function codeAverageLettersFoundAt(bucket: CodeStatsBucket): number | null {
  if (bucket.lettersFoundGames === 0) return null;
  return bucket.totalLettersFoundAt / bucket.lettersFoundGames;
}

/** Share of tracked games that used the notepad, as a whole percent, or null with none. */
export function codeNotesUsedPercentage(bucket: CodeStatsBucket): number | null {
  if (bucket.notesTrackedGames === 0) return null;
  return Math.round((bucket.notesUsedGames / bucket.notesTrackedGames) * 100);
}

/** Win rate as a whole percent, 0 with no games. */
export function codeWinPercentage(bucket: CodeStatsBucket): number {
  if (bucket.gamesPlayed === 0) return 0;
  return Math.round((bucket.gamesWon / bucket.gamesPlayed) * 100);
}

/* ------------------------------------------------------------------ *
 * Meta: the no-repeat ring buffer, per length (FR-127)
 * ------------------------------------------------------------------ */

/** Puts a game's secret at the front of its length's buffer, keeping the last 50. */
export function rememberCodeAnswer(meta: CodeMeta, length: WordLength, answer: string): CodeMeta {
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
