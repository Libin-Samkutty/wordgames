import { RECENT_GAMES_LIMIT } from '@/engine/constants';
import {
  DEFAULT_DODGE_LENGTH,
  DISTRIBUTION_BUCKETS,
  DODGE_LENGTHS,
  MAX_SAVED_GUESSES,
} from '@/engine/dodge/constants';
import type { DodgeGuess, DodgeRecord, DodgeSession, DodgeStatus } from '@/engine/dodge/types';
import type { LetterState, WordLength } from '@/engine/types';

import { emptyTimeStats, readTimeStats, type TimeStats } from './timeStats';

/**
 * Persisted WordDodge shapes and their runtime guards (SPEC §21, FR-148,
 * FR-153, FR-155). Parsed JSON is untrusted: anything that fails a guard is
 * discarded in favour of defaults (EC-12).
 */

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

/** WordDodge's own length preference, apart from every other game's (FR-148, FR-67). */
export interface DodgePrefs {
  readonly defaultWordLength: WordLength;
}

/** Counts kept overall and per length (FR-155). */
export interface DodgeStatsBucket extends TimeStats {
  readonly gamesPlayed: number;
  readonly gamesWon: number;
  readonly currentStreak: number;
  readonly bestStreak: number;
  /** Wins grouped by guesses used: see `distributionIndex`. */
  readonly distribution: readonly number[];
  /** The sum of the guesses used over wins, for the average. */
  readonly totalWinGuesses: number;
  /** The fewest guesses in any win, or null before the first. */
  readonly fewestGuesses: number | null;
}

export interface DodgeStatsState {
  readonly overall: DodgeStatsBucket;
  readonly perLength: Readonly<Record<WordLength, DodgeStatsBucket>>;
  /** Newest first, at most `RECENT_GAMES_LIMIT` (FR-155). */
  readonly recentGames: readonly DodgeRecord[];
  /** Ids already recorded, so a replayed completion cannot double-count. */
  readonly recordedGameIds: readonly string[];
}

/* ------------------------------------------------------------------ *
 * Primitive guards
 * ------------------------------------------------------------------ */

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isLength(value: unknown): value is WordLength {
  return DODGE_LENGTHS.some((length) => length === value);
}

function isWord(value: unknown, length: number): value is string {
  return typeof value === 'string' && value.length === length && /^[A-Z]+$/.test(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/* ------------------------------------------------------------------ *
 * Defaults
 * ------------------------------------------------------------------ */

export const DEFAULT_DODGE_PREFS: DodgePrefs = { defaultWordLength: DEFAULT_DODGE_LENGTH };

export function emptyDodgeBucket(): DodgeStatsBucket {
  return {
    gamesPlayed: 0,
    gamesWon: 0,
    currentStreak: 0,
    bestStreak: 0,
    distribution: new Array<number>(DISTRIBUTION_BUCKETS).fill(0),
    totalWinGuesses: 0,
    fewestGuesses: null,
    ...emptyTimeStats(),
  };
}

export function defaultDodgeStats(): DodgeStatsState {
  return {
    overall: emptyDodgeBucket(),
    perLength: { 4: emptyDodgeBucket(), 5: emptyDodgeBucket(), 6: emptyDodgeBucket() },
    recentGames: [],
    recordedGameIds: [],
  };
}

/* ------------------------------------------------------------------ *
 * Validators
 * ------------------------------------------------------------------ */

export function validateDodgePrefs(value: unknown): DodgePrefs | null {
  if (!isObject(value)) return null;
  if (!isLength(value.defaultWordLength)) return null;

  return { defaultWordLength: value.defaultWordLength };
}

function validateBucket(value: unknown): DodgeStatsBucket | null {
  if (!isObject(value)) return null;

  const {
    gamesPlayed,
    gamesWon,
    currentStreak,
    bestStreak,
    distribution,
    totalWinGuesses,
    fewestGuesses,
  } = value;
  if (
    !isNonNegativeInteger(gamesPlayed) ||
    !isNonNegativeInteger(gamesWon) ||
    !isNonNegativeInteger(currentStreak) ||
    !isNonNegativeInteger(bestStreak) ||
    !isNonNegativeInteger(totalWinGuesses)
  ) {
    return null;
  }
  // Cross-field sanity: more wins than games means the record is incoherent.
  if (gamesWon > gamesPlayed) return null;

  if (
    !Array.isArray(distribution) ||
    distribution.length !== DISTRIBUTION_BUCKETS ||
    !distribution.every(isNonNegativeInteger)
  ) {
    return null;
  }

  if (fewestGuesses !== null && (!isNonNegativeInteger(fewestGuesses) || fewestGuesses < 1)) {
    return null;
  }

  const time = readTimeStats(value);
  if (!time) return null;

  return {
    gamesPlayed,
    gamesWon,
    currentStreak,
    bestStreak,
    distribution,
    totalWinGuesses,
    fewestGuesses,
    ...time,
  };
}

function validateRecord(value: unknown): DodgeRecord | null {
  if (!isObject(value)) return null;

  const { id, playedAt, length, word, guessesUsed, won, solveMs } = value;

  if (typeof id !== 'string' || id.length === 0) return null;
  if (!isFiniteNumber(playedAt)) return null;
  if (!isLength(length)) return null;
  if (!isWord(word, length)) return null;
  if (!isNonNegativeInteger(guessesUsed) || guessesUsed < 1 || guessesUsed > MAX_SAVED_GUESSES) {
    return null;
  }
  if (typeof won !== 'boolean') return null;
  if (!isFiniteNumber(solveMs) || solveMs < 0) return null;

  const base = { id, playedAt, length, word, guessesUsed, won, solveMs };

  // The opener is optional: a malformed one is dropped, not a reason to lose the row.
  return isWord(value.opener, length) ? { ...base, opener: value.opener } : base;
}

export function validateDodgeStats(value: unknown): DodgeStatsState | null {
  if (!isObject(value)) return null;

  const overall = validateBucket(value.overall);
  if (!overall) return null;

  if (!isObject(value.perLength)) return null;
  const perLength = {} as Record<WordLength, DodgeStatsBucket>;
  for (const length of DODGE_LENGTHS) {
    const bucket = validateBucket(value.perLength[String(length)]);
    if (!bucket) return null;
    perLength[length] = bucket;
  }

  if (!Array.isArray(value.recentGames)) return null;
  const recentGames: DodgeRecord[] = [];
  for (const entry of value.recentGames) {
    const record = validateRecord(entry);
    // Drop individual malformed rows rather than discarding the whole history.
    if (record) recentGames.push(record);
  }

  const recordedGameIds = isStringArray(value.recordedGameIds) ? value.recordedGameIds : [];

  return {
    overall,
    perLength,
    recentGames: recentGames.slice(0, RECENT_GAMES_LIMIT),
    recordedGameIds,
  };
}

const STATUSES: readonly DodgeStatus[] = ['playing', 'won', 'gave-up'];
const LETTER_STATES: readonly LetterState[] = ['correct', 'present', 'absent'];

function validateGuess(value: unknown, length: WordLength): DodgeGuess | null {
  if (!isObject(value)) return null;

  const { word, evaluation } = value;
  if (!isWord(word, length)) return null;
  if (!Array.isArray(evaluation) || evaluation.length !== length) return null;

  const states: LetterState[] = [];
  for (const entry of evaluation) {
    const known = LETTER_STATES.find((state) => state === entry);
    if (!known) return null;
    states.push(known);
  }

  return { word, evaluation: states };
}

function isAllCorrect(guess: DodgeGuess): boolean {
  return guess.evaluation.every((state) => state === 'correct');
}

/**
 * Turns parsed JSON into a `DodgeSession`, or null if its shape is wrong. This
 * checks shape and internal consistency only. Whether the guesses still replay
 * against today's answers is `restoreGame` (FR-153). A game saved mid-reveal is
 * never written, so `revealing` is not a status that can be stored.
 */
export function validateDodgeSession(value: unknown): DodgeSession | null {
  if (!isObject(value)) return null;

  const { id, wordLength, guesses, currentInput, status, startedAt, finishedAt } = value;

  if (typeof id !== 'string' || id.length === 0) return null;
  if (!isLength(wordLength)) return null;
  if (typeof currentInput !== 'string' || currentInput.length > wordLength) return null;
  if (!/^[A-Z]*$/.test(currentInput)) return null;
  const known = STATUSES.find((candidate) => candidate === status);
  if (!known) return null;
  if (startedAt !== null && !isFiniteNumber(startedAt)) return null;
  if (finishedAt !== null && !isFiniteNumber(finishedAt)) return null;

  if (!Array.isArray(guesses) || guesses.length > MAX_SAVED_GUESSES) return null;
  const parsed: DodgeGuess[] = [];
  for (const entry of guesses) {
    const guess = validateGuess(entry, wordLength);
    if (!guess) return null;
    parsed.push(guess);
  }

  const last = parsed.at(-1);
  if (known === 'playing') {
    // A game in play has no end time, and its last reply was not all green.
    if (finishedAt !== null) return null;
    if (last && isAllCorrect(last)) return null;
  } else {
    // A finished game has an end time, no half-typed row, and a guess behind it.
    if (finishedAt === null || currentInput !== '' || !last) return null;
    // A win ends on an all-green reply, and a give up does not.
    if ((known === 'won') !== isAllCorrect(last)) return null;
  }

  return {
    id,
    wordLength,
    guesses: parsed,
    currentInput,
    status: known,
    startedAt,
    finishedAt,
  };
}
