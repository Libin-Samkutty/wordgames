import { RECENT_GAMES_LIMIT } from '@/engine/constants';
import { DEFAULT_HANG_LENGTH, HANG_LENGTHS, MAX_MISSES } from '@/engine/hang/constants';
import type { HangRecord, HangState, HangStatus } from '@/engine/hang/types';
import type { WordLength } from '@/engine/types';

import { emptyTimeStats, readTimeStats, type TimeStats } from './timeStats';

/**
 * Persisted WordHang shapes and their runtime guards (SPEC §23, FR-167,
 * FR-173, FR-174). Parsed JSON is untrusted: anything that fails a guard is
 * discarded in favour of defaults (EC-12).
 */

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

/** WordHang's own length preference, apart from every other game's (FR-167, FR-67). */
export interface HangPrefs {
  readonly defaultWordLength: WordLength;
}

/** Counts kept overall and per length (FR-174). */
export interface HangStatsBucket extends TimeStats {
  readonly gamesPlayed: number;
  readonly gamesWon: number;
  readonly currentStreak: number;
  readonly bestStreak: number;
  /** Wins by misses. Index 0 is a win with no miss, index 5 a win with five. */
  readonly distribution: readonly number[];
}

export interface HangStatsState {
  readonly overall: HangStatsBucket;
  readonly perLength: Readonly<Record<WordLength, HangStatsBucket>>;
  /** Newest first, at most `RECENT_GAMES_LIMIT` (FR-174). */
  readonly recentGames: readonly HangRecord[];
  /** Ids already recorded, so a replayed completion cannot double-count. */
  readonly recordedGameIds: readonly string[];
}

/** The no-repeat ring buffer, one per length (FR-168). */
export interface HangMeta {
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
  return HANG_LENGTHS.some((length) => length === value);
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

export const DEFAULT_HANG_PREFS: HangPrefs = { defaultWordLength: DEFAULT_HANG_LENGTH };

export function emptyHangBucket(): HangStatsBucket {
  return {
    gamesPlayed: 0,
    gamesWon: 0,
    currentStreak: 0,
    bestStreak: 0,
    distribution: new Array<number>(MAX_MISSES).fill(0),
    ...emptyTimeStats(),
  };
}

export function defaultHangStats(): HangStatsState {
  return {
    overall: emptyHangBucket(),
    perLength: { 4: emptyHangBucket(), 5: emptyHangBucket(), 6: emptyHangBucket() },
    recentGames: [],
    recordedGameIds: [],
  };
}

export function defaultHangMeta(): HangMeta {
  return { recentAnswers: { 4: [], 5: [], 6: [] } };
}

/* ------------------------------------------------------------------ *
 * Validators
 * ------------------------------------------------------------------ */

export function validateHangPrefs(value: unknown): HangPrefs | null {
  if (!isObject(value)) return null;
  if (!isLength(value.defaultWordLength)) return null;

  return { defaultWordLength: value.defaultWordLength };
}

function validateBucket(value: unknown): HangStatsBucket | null {
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
    distribution.length !== MAX_MISSES ||
    !distribution.every(isNonNegativeInteger)
  ) {
    return null;
  }

  const time = readTimeStats(value);
  if (!time) return null;

  return { gamesPlayed, gamesWon, currentStreak, bestStreak, distribution, ...time };
}

function validateRecord(value: unknown): HangRecord | null {
  if (!isObject(value)) return null;

  const { id, playedAt, length, secret, misses, won, solveMs } = value;

  if (typeof id !== 'string' || id.length === 0) return null;
  if (!isFiniteNumber(playedAt)) return null;
  if (!isLength(length)) return null;
  if (!isWord(secret, length)) return null;
  if (!isNonNegativeInteger(misses) || misses > MAX_MISSES) return null;
  if (typeof won !== 'boolean') return null;
  // A win has fewer than six misses, and a loss has exactly six.
  if (won !== misses < MAX_MISSES) return null;
  if (!isFiniteNumber(solveMs) || solveMs < 0) return null;

  return { id, playedAt, length, secret, misses, won, solveMs };
}

export function validateHangStats(value: unknown): HangStatsState | null {
  if (!isObject(value)) return null;

  const overall = validateBucket(value.overall);
  if (!overall) return null;

  if (!isObject(value.perLength)) return null;
  const perLength = {} as Record<WordLength, HangStatsBucket>;
  for (const length of HANG_LENGTHS) {
    const bucket = validateBucket(value.perLength[String(length)]);
    if (!bucket) return null;
    perLength[length] = bucket;
  }

  if (!Array.isArray(value.recentGames)) return null;
  const recentGames: HangRecord[] = [];
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

export function validateHangMeta(value: unknown): HangMeta | null {
  if (!isObject(value)) return null;
  if (!isObject(value.recentAnswers)) return null;

  const recentAnswers = {} as Record<WordLength, readonly string[]>;
  for (const length of HANG_LENGTHS) {
    const entry = value.recentAnswers[String(length)];
    recentAnswers[length] = isStringArray(entry) ? entry : [];
  }

  return { recentAnswers };
}

const STATUSES: readonly HangStatus[] = ['playing', 'won', 'lost'];

/**
 * Turns parsed JSON into a `HangState`, or null if its shape is wrong. This
 * checks shape and internal consistency only; whether the secret still exists
 * is `isHangSessionUsable` (FR-173). The status must be the one the letters
 * tried give: a game is won once every letter is tried, and lost at six misses.
 */
export function validateHangSession(value: unknown): HangState | null {
  if (!isObject(value)) return null;

  const { id, wordLength, secret, tried, status, startedAt, finishedAt } = value;

  if (typeof id !== 'string' || id.length === 0) return null;
  if (!isLength(wordLength)) return null;
  if (!isWord(secret, wordLength)) return null;
  // Each letter is tried once, so the string has no repeats.
  if (
    typeof tried !== 'string' ||
    !/^[A-Z]*$/.test(tried) ||
    new Set(tried).size !== tried.length
  ) {
    return null;
  }
  const known = STATUSES.find((candidate) => candidate === status);
  if (!known) return null;
  if (startedAt !== null && !isFiniteNumber(startedAt)) return null;
  if (finishedAt !== null && !isFiniteNumber(finishedAt)) return null;

  const solved = [...secret].every((letter) => tried.includes(letter));
  const missed = [...tried].filter((letter) => !secret.includes(letter)).length;
  const expected: HangStatus = solved ? 'won' : missed >= MAX_MISSES ? 'lost' : 'playing';
  if (known !== expected) return null;
  // A game in play has no end time, and a finished one has.
  if ((known === 'playing') !== (finishedAt === null)) return null;

  return { id, wordLength, secret, tried, status: known, startedAt, finishedAt };
}

/**
 * True when a saved game can still be played against today's answer list
 * (FR-173). It is discarded silently, and a new game starts, if its secret has
 * left the list.
 */
export function isHangSessionUsable(
  session: HangState | null,
  isKnownAnswer: (word: string) => boolean,
): session is HangState {
  return session !== null && isKnownAnswer(session.secret);
}
