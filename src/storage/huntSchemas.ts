import { RECENT_GAMES_LIMIT } from '@/engine/constants';
import { MAX_SAVED_WORDS, MIN_WORD_LENGTH, TRAY_SIZE } from '@/engine/hunt/constants';
import type { HuntRecord, HuntState, HuntStatus } from '@/engine/hunt/types';
import { isFormableFrom } from '@/engine/hunt/validate';

import { emptyTimeStats, readTimeStats, type TimeStats } from './timeStats';

/**
 * Persisted WordHunt shapes and their runtime guards (SPEC §22, FR-164,
 * FR-165). Parsed JSON is untrusted: anything that fails a guard is discarded
 * in favour of defaults (EC-12).
 *
 * WordHunt has one fixed size of puzzle, so it has no length preference and no
 * per-length statistics.
 */

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

/** Counts kept for every puzzle (FR-165). */
export interface HuntStatsBucket extends TimeStats {
  readonly gamesPlayed: number;
  readonly gamesCompleted: number;
  readonly currentStreak: number;
  readonly bestStreak: number;
  /** The words to find and the words found, summed over every puzzle, for the average. */
  readonly totalRequired: number;
  readonly totalFound: number;
  /** Bonus words found, summed over every puzzle. */
  readonly totalBonus: number;
}

export interface HuntStatsState {
  readonly overall: HuntStatsBucket;
  /** Newest first, at most `RECENT_GAMES_LIMIT` (FR-165). */
  readonly recentGames: readonly HuntRecord[];
  /** Ids already recorded, so a replayed completion cannot double-count. */
  readonly recordedGameIds: readonly string[];
}

/** The no-repeat ring buffer of seeds (FR-158). */
export interface HuntMeta {
  readonly recentAnswers: readonly string[];
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

function isWord(value: unknown, length: number): value is string {
  return typeof value === 'string' && value.length === length && /^[A-Z]+$/.test(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/** A word of 4 to 6 letters. */
function isHuntWord(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= MIN_WORD_LENGTH &&
    value.length <= TRAY_SIZE &&
    /^[A-Z]+$/.test(value)
  );
}

/* ------------------------------------------------------------------ *
 * Defaults
 * ------------------------------------------------------------------ */

export function emptyHuntBucket(): HuntStatsBucket {
  return {
    gamesPlayed: 0,
    gamesCompleted: 0,
    currentStreak: 0,
    bestStreak: 0,
    totalRequired: 0,
    totalFound: 0,
    totalBonus: 0,
    ...emptyTimeStats(),
  };
}

export function defaultHuntStats(): HuntStatsState {
  return { overall: emptyHuntBucket(), recentGames: [], recordedGameIds: [] };
}

export function defaultHuntMeta(): HuntMeta {
  return { recentAnswers: [] };
}

/* ------------------------------------------------------------------ *
 * Validators
 * ------------------------------------------------------------------ */

function validateBucket(value: unknown): HuntStatsBucket | null {
  if (!isObject(value)) return null;

  const {
    gamesPlayed,
    gamesCompleted,
    currentStreak,
    bestStreak,
    totalRequired,
    totalFound,
    totalBonus,
  } = value;
  if (
    !isNonNegativeInteger(gamesPlayed) ||
    !isNonNegativeInteger(gamesCompleted) ||
    !isNonNegativeInteger(currentStreak) ||
    !isNonNegativeInteger(bestStreak) ||
    !isNonNegativeInteger(totalRequired) ||
    !isNonNegativeInteger(totalFound) ||
    !isNonNegativeInteger(totalBonus)
  ) {
    return null;
  }
  // Cross-field sanity: more completions than puzzles, or more words found than
  // there were to find, means the record is incoherent.
  if (gamesCompleted > gamesPlayed || totalFound > totalRequired) return null;

  const time = readTimeStats(value);
  if (!time) return null;

  return {
    gamesPlayed,
    gamesCompleted,
    currentStreak,
    bestStreak,
    totalRequired,
    totalFound,
    totalBonus,
    ...time,
  };
}

function validateRecord(value: unknown): HuntRecord | null {
  if (!isObject(value)) return null;

  const { id, playedAt, seed, requiredCount, foundCount, bonusCount, completed, solveMs } = value;

  if (typeof id !== 'string' || id.length === 0) return null;
  if (!isFiniteNumber(playedAt)) return null;
  if (!isWord(seed, TRAY_SIZE)) return null;
  if (!isNonNegativeInteger(requiredCount) || requiredCount < 1) return null;
  if (!isNonNegativeInteger(foundCount) || foundCount > requiredCount) return null;
  if (!isNonNegativeInteger(bonusCount)) return null;
  if (typeof completed !== 'boolean') return null;
  // A puzzle is completed exactly when every word was found.
  if (completed !== (foundCount === requiredCount)) return null;
  if (!isFiniteNumber(solveMs) || solveMs < 0) return null;

  return { id, playedAt, seed, requiredCount, foundCount, bonusCount, completed, solveMs };
}

export function validateHuntStats(value: unknown): HuntStatsState | null {
  if (!isObject(value)) return null;

  const overall = validateBucket(value.overall);
  if (!overall) return null;

  if (!Array.isArray(value.recentGames)) return null;
  const recentGames: HuntRecord[] = [];
  for (const entry of value.recentGames) {
    const record = validateRecord(entry);
    // Drop individual malformed rows rather than discarding the whole history.
    if (record) recentGames.push(record);
  }

  const recordedGameIds = isStringArray(value.recordedGameIds) ? value.recordedGameIds : [];

  return { overall, recentGames: recentGames.slice(0, RECENT_GAMES_LIMIT), recordedGameIds };
}

export function validateHuntMeta(value: unknown): HuntMeta | null {
  if (!isObject(value)) return null;
  if (!isStringArray(value.recentAnswers)) return null;

  return { recentAnswers: value.recentAnswers };
}

const STATUSES: readonly HuntStatus[] = ['playing', 'won', 'gave-up'];

/**
 * A list of distinct words of 4 to 6 letters, each spelled from the seed. Null
 * if any entry breaks that, or the list is too long.
 */
function validateWords(value: unknown, seed: string): string[] | null {
  if (!Array.isArray(value) || value.length > MAX_SAVED_WORDS) return null;

  const words: string[] = [];
  for (const entry of value) {
    if (!isHuntWord(entry) || !isFormableFrom(entry, seed) || words.includes(entry)) return null;
    words.push(entry);
  }
  return words;
}

/**
 * Turns parsed JSON into a `HuntState`, or null if its shape is wrong. This
 * checks shape and internal consistency only. A saved puzzle carries its own
 * word list, so it needs no check against today's word lists and is never
 * discarded for a list change (FR-164).
 */
export function validateHuntSession(value: unknown): HuntState | null {
  if (!isObject(value)) return null;

  const { id, seed, tray, currentInput, status, startedAt, finishedAt } = value;

  if (typeof id !== 'string' || id.length === 0) return null;
  if (!isWord(seed, TRAY_SIZE) || !isWord(tray, TRAY_SIZE)) return null;
  // The tray is the seed's letters in some order.
  if (!isFormableFrom(tray, seed)) return null;
  if (typeof currentInput !== 'string' || currentInput.length > TRAY_SIZE) return null;
  if (!/^[A-Z]*$/.test(currentInput) || !isFormableFrom(currentInput, tray)) return null;
  const known = STATUSES.find((candidate) => candidate === status);
  if (!known) return null;
  if (startedAt !== null && !isFiniteNumber(startedAt)) return null;
  if (finishedAt !== null && !isFiniteNumber(finishedAt)) return null;

  const required = validateWords(value.required, seed);
  if (!required || required.length === 0) return null;
  const found = validateWords(value.found, seed);
  const bonus = validateWords(value.bonus, seed);
  if (!found || !bonus) return null;
  // Found words are required ones, and bonus words are not.
  if (!found.every((word) => required.includes(word))) return null;
  if (bonus.some((word) => required.includes(word))) return null;

  if (known === 'playing') {
    if (finishedAt !== null || found.length === required.length) return null;
  } else {
    if (finishedAt === null || currentInput !== '') return null;
    // A win has every required word, and a give up does not.
    if ((known === 'won') !== (found.length === required.length)) return null;
  }

  return {
    id,
    seed,
    tray,
    required,
    found,
    bonus,
    currentInput,
    status: known,
    startedAt,
    finishedAt,
  };
}
