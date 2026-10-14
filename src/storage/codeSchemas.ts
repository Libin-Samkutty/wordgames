import { RECENT_GAMES_LIMIT } from '@/engine/constants';
import {
  CODE_LENGTHS,
  CODE_MAX_GUESSES,
  DEFAULT_CODE_LENGTH,
  NOTE_MARKS,
} from '@/engine/code/constants';
import type {
  CodeGuess,
  CodeRecord,
  CodeState,
  CodeStatus,
  NoteMark,
  Notes,
} from '@/engine/code/types';
import type { WordLength } from '@/engine/types';

/**
 * Persisted WordCode shapes and their runtime guards (SPEC §19, FR-127,
 * FR-134, FR-135). Parsed JSON is untrusted: anything that fails a guard is
 * discarded in favour of defaults (EC-12).
 */

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

/** WordCode's own length preference, apart from every other game's (FR-127, FR-67). */
export interface CodePrefs {
  readonly defaultWordLength: WordLength;
}

/** Counts kept overall and per length (FR-134). */
export interface CodeStatsBucket {
  readonly gamesPlayed: number;
  readonly gamesWon: number;
  readonly currentStreak: number;
  readonly bestStreak: number;
  /** Wins by guesses used. Index 0 is a win on guess 1, index 9 on guess 10. */
  readonly distribution: readonly number[];
}

export interface CodeStatsState {
  readonly overall: CodeStatsBucket;
  readonly perLength: Readonly<Record<WordLength, CodeStatsBucket>>;
  /** Newest first, at most `RECENT_GAMES_LIMIT` (FR-134). */
  readonly recentGames: readonly CodeRecord[];
  /** Ids already recorded, so a replayed completion cannot double-count. */
  readonly recordedGameIds: readonly string[];
}

/** The no-repeat ring buffer, one per length (FR-127). */
export interface CodeMeta {
  readonly recentAnswers: Readonly<Record<WordLength, readonly string[]>>;
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
  return CODE_LENGTHS.some((length) => length === value);
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

export const DEFAULT_CODE_PREFS: CodePrefs = { defaultWordLength: DEFAULT_CODE_LENGTH };

export function emptyCodeBucket(): CodeStatsBucket {
  return {
    gamesPlayed: 0,
    gamesWon: 0,
    currentStreak: 0,
    bestStreak: 0,
    distribution: new Array<number>(CODE_MAX_GUESSES).fill(0),
  };
}

export function defaultCodeStats(): CodeStatsState {
  return {
    overall: emptyCodeBucket(),
    perLength: { 4: emptyCodeBucket(), 5: emptyCodeBucket(), 6: emptyCodeBucket() },
    recentGames: [],
    recordedGameIds: [],
  };
}

export function defaultCodeMeta(): CodeMeta {
  return { recentAnswers: { 4: [], 5: [], 6: [] } };
}

/* ------------------------------------------------------------------ *
 * Validators
 * ------------------------------------------------------------------ */

export function validateCodePrefs(value: unknown): CodePrefs | null {
  if (!isObject(value)) return null;
  if (!isLength(value.defaultWordLength)) return null;

  return { defaultWordLength: value.defaultWordLength };
}

function validateBucket(value: unknown): CodeStatsBucket | null {
  if (!isObject(value)) return null;

  const { gamesPlayed, gamesWon, currentStreak, bestStreak, distribution } = value;
  if (
    !isNonNegativeInteger(gamesPlayed) ||
    !isNonNegativeInteger(gamesWon) ||
    !isNonNegativeInteger(currentStreak) ||
    !isNonNegativeInteger(bestStreak)
  ) {
    return null;
  }
  // Cross-field sanity: more wins than games means the record is incoherent.
  if (gamesWon > gamesPlayed) return null;

  if (
    !Array.isArray(distribution) ||
    distribution.length !== CODE_MAX_GUESSES ||
    !distribution.every(isNonNegativeInteger)
  ) {
    return null;
  }

  return { gamesPlayed, gamesWon, currentStreak, bestStreak, distribution };
}

function validateRecord(value: unknown): CodeRecord | null {
  if (!isObject(value)) return null;

  const { id, playedAt, length, secret, guessesUsed, won } = value;

  if (typeof id !== 'string' || id.length === 0) return null;
  if (!isFiniteNumber(playedAt)) return null;
  if (!isLength(length)) return null;
  if (!isWord(secret, length)) return null;
  if (!isNonNegativeInteger(guessesUsed) || guessesUsed > CODE_MAX_GUESSES) return null;
  if (typeof won !== 'boolean') return null;

  return { id, playedAt, length, secret, guessesUsed, won };
}

export function validateCodeStats(value: unknown): CodeStatsState | null {
  if (!isObject(value)) return null;

  const overall = validateBucket(value.overall);
  if (!overall) return null;

  if (!isObject(value.perLength)) return null;
  const perLength = {} as Record<WordLength, CodeStatsBucket>;
  for (const length of CODE_LENGTHS) {
    const bucket = validateBucket(value.perLength[String(length)]);
    if (!bucket) return null;
    perLength[length] = bucket;
  }

  if (!Array.isArray(value.recentGames)) return null;
  const recentGames: CodeRecord[] = [];
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

export function validateCodeMeta(value: unknown): CodeMeta | null {
  if (!isObject(value)) return null;
  if (!isObject(value.recentAnswers)) return null;

  const recentAnswers = {} as Record<WordLength, readonly string[]>;
  for (const length of CODE_LENGTHS) {
    const entry = value.recentAnswers[String(length)];
    recentAnswers[length] = isStringArray(entry) ? entry : [];
  }

  return { recentAnswers };
}

const STATUSES: readonly CodeStatus[] = ['playing', 'won', 'lost'];

function validateGuess(value: unknown, length: WordLength, secret: string): CodeGuess | null {
  if (!isObject(value)) return null;

  const { word, bulls, cows } = value;
  if (!isWord(word, length)) return null;
  if (!isNonNegativeInteger(bulls) || !isNonNegativeInteger(cows)) return null;
  if (bulls + cows > length) return null;
  // A guess that is the secret is all bulls, and only that guess is.
  if ((word === secret) !== (bulls === length)) return null;

  return { word, bulls, cows };
}

/** A notepad is an object of single letters to a known mark (FR-132). */
function validateNotes(value: unknown): Notes | null {
  if (!isObject(value)) return null;

  const notes: Partial<Record<string, NoteMark>> = {};
  for (const [letter, mark] of Object.entries(value)) {
    if (!/^[A-Z]$/.test(letter)) return null;
    const known = NOTE_MARKS.find((candidate) => candidate === mark);
    if (!known) return null;
    notes[letter] = known;
  }

  return notes;
}

/**
 * Turns parsed JSON into a `CodeState`, or null if its shape is wrong. This
 * checks shape and internal consistency only; whether the secret still exists
 * is `isCodeSessionUsable` (FR-135). The notes round-trip exactly (EC-45).
 */
export function validateCodeSession(value: unknown): CodeState | null {
  if (!isObject(value)) return null;

  const { id, wordLength, secret, guesses, currentInput, notes, status, startedAt, finishedAt } =
    value;

  if (typeof id !== 'string' || id.length === 0) return null;
  if (!isLength(wordLength)) return null;
  if (!isWord(secret, wordLength)) return null;
  if (typeof currentInput !== 'string' || currentInput.length > wordLength) return null;
  if (!/^[A-Z]*$/.test(currentInput)) return null;
  if (!STATUSES.some((known) => known === status)) return null;
  if (startedAt !== null && !isFiniteNumber(startedAt)) return null;
  if (finishedAt !== null && !isFiniteNumber(finishedAt)) return null;

  const parsedNotes = validateNotes(notes);
  if (!parsedNotes) return null;

  if (!Array.isArray(guesses) || guesses.length > CODE_MAX_GUESSES) return null;
  const parsed: CodeGuess[] = [];
  for (const entry of guesses) {
    const guess = validateGuess(entry, wordLength, secret);
    if (!guess) return null;
    parsed.push(guess);
  }

  return {
    id,
    wordLength,
    secret,
    guesses: parsed,
    currentInput,
    notes: parsedNotes,
    status: status as CodeStatus,
    startedAt,
    finishedAt,
  };
}

/**
 * True when a saved game can still be played against today's answer list
 * (FR-135). It is discarded silently, and a new game starts, if its secret has
 * left the list, because a game whose secret is gone is unwinnable.
 */
export function isCodeSessionUsable(
  session: CodeState | null,
  isKnownAnswer: (word: string) => boolean,
): session is CodeState {
  return session !== null && isKnownAnswer(session.secret);
}
