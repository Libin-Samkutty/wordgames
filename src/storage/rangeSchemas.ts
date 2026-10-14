import { RECENT_GAMES_LIMIT } from '@/engine/constants';
import {
  HEAT_LEVELS,
  LOWER_SENTINEL,
  RANGE_LENGTH,
  RANGE_MAX_GUESSES,
  UPPER_SENTINEL,
} from '@/engine/range/constants';
import type {
  Heat,
  RangeDirection,
  RangeGuess,
  RangeRecord,
  RangeState,
  RangeStatus,
} from '@/engine/range/types';

import { emptyTimeStats, readTimeStats, type TimeStats } from './timeStats';

/**
 * Persisted WordRange shapes and their runtime guards (SPEC §18, FR-124,
 * FR-125). Parsed JSON is untrusted: anything that fails a guard is discarded
 * in favour of defaults (EC-12).
 */

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

/** WordRange has no preferences yet; the key exists so reset and import stay uniform. */
export type RangePrefs = Record<string, never>;

export interface RangeStatsState extends TimeStats {
  readonly gamesPlayed: number;
  readonly gamesWon: number;
  readonly currentStreak: number;
  readonly bestStreak: number;
  /** Wins by guesses used. Index 0 is a win on guess 1, index 13 on guess 14 (FR-124). */
  readonly distribution: readonly number[];
  /** Games saved with the heat field, how many reached Burning, and the sum of that guess number. */
  readonly heatTrackedGames: number;
  readonly burningGames: number;
  readonly totalFirstBurningAt: number;
  /** The fewest words left in the range after a loss, or null with no such loss yet. */
  readonly closestMiss: number | null;
  /** Newest first, at most `RECENT_GAMES_LIMIT`. */
  readonly recentGames: readonly RangeRecord[];
  /** Ids already recorded, so a replayed completion cannot double-count. */
  readonly recordedGameIds: readonly string[];
}

/** The no-repeat ring buffer (FR-115). */
export interface RangeMeta {
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

function isWord(value: unknown): value is string {
  return typeof value === 'string' && value.length === RANGE_LENGTH && /^[A-Z]+$/.test(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/* ------------------------------------------------------------------ *
 * Defaults
 * ------------------------------------------------------------------ */

export const DEFAULT_RANGE_PREFS: RangePrefs = {};

export function defaultRangeStats(): RangeStatsState {
  return {
    gamesPlayed: 0,
    gamesWon: 0,
    currentStreak: 0,
    bestStreak: 0,
    distribution: new Array<number>(RANGE_MAX_GUESSES).fill(0),
    heatTrackedGames: 0,
    burningGames: 0,
    totalFirstBurningAt: 0,
    closestMiss: null,
    ...emptyTimeStats(),
    recentGames: [],
    recordedGameIds: [],
  };
}

export function defaultRangeMeta(): RangeMeta {
  return { recentAnswers: [] };
}

/* ------------------------------------------------------------------ *
 * Validators
 * ------------------------------------------------------------------ */

export function validateRangePrefs(value: unknown): RangePrefs | null {
  return isObject(value) ? {} : null;
}

function validateRecord(value: unknown): RangeRecord | null {
  if (!isObject(value)) return null;

  const { id, playedAt, secret, guessesUsed, won } = value;

  if (typeof id !== 'string' || id.length === 0) return null;
  if (!isFiniteNumber(playedAt)) return null;
  if (!isWord(secret)) return null;
  if (!isNonNegativeInteger(guessesUsed) || guessesUsed > RANGE_MAX_GUESSES) return null;
  if (typeof won !== 'boolean') return null;

  const base = { id, playedAt, secret, guessesUsed, won };

  // Fields added later are optional, so an older row still loads.
  const extra: {
    solveMs?: number;
    firstBurningGuess?: number | null;
    wordsLeft?: number | null;
    opener?: string;
  } = {};
  if (isFiniteNumber(value.solveMs) && value.solveMs >= 0) extra.solveMs = value.solveMs;
  if (value.firstBurningGuess === null) extra.firstBurningGuess = null;
  else if (
    isNonNegativeInteger(value.firstBurningGuess) &&
    value.firstBurningGuess <= RANGE_MAX_GUESSES
  )
    extra.firstBurningGuess = value.firstBurningGuess;
  if (value.wordsLeft === null) extra.wordsLeft = null;
  else if (isNonNegativeInteger(value.wordsLeft)) extra.wordsLeft = value.wordsLeft;
  if (isWord(value.opener)) extra.opener = value.opener;

  return { ...base, ...extra };
}

export function validateRangeStats(value: unknown): RangeStatsState | null {
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
    distribution.length !== RANGE_MAX_GUESSES ||
    !distribution.every(isNonNegativeInteger)
  ) {
    return null;
  }

  if (!Array.isArray(value.recentGames)) return null;
  const recentGames: RangeRecord[] = [];
  for (const entry of value.recentGames) {
    const record = validateRecord(entry);
    // Drop individual malformed rows rather than discarding the whole history.
    if (record) recentGames.push(record);
  }

  const recordedGameIds = isStringArray(value.recordedGameIds) ? value.recordedGameIds : [];

  // Counters saved before these fields existed read as zero, and no closest miss yet.
  const counters = [value.heatTrackedGames, value.burningGames, value.totalFirstBurningAt].map(
    (counter) => (counter === undefined ? 0 : counter),
  );
  if (!counters.every(isNonNegativeInteger)) return null;
  const [heatTrackedGames = 0, burningGames = 0, totalFirstBurningAt = 0] = counters;
  if (burningGames > heatTrackedGames) return null;

  const storedMiss = value.closestMiss;
  if (storedMiss !== undefined && storedMiss !== null && !isNonNegativeInteger(storedMiss)) {
    return null;
  }
  const closestMiss = typeof storedMiss === 'number' ? storedMiss : null;

  const time = readTimeStats(value);
  if (!time) return null;

  return {
    heatTrackedGames,
    burningGames,
    totalFirstBurningAt,
    closestMiss,
    ...time,
    gamesPlayed,
    gamesWon,
    currentStreak,
    bestStreak,
    distribution,
    recentGames: recentGames.slice(0, RECENT_GAMES_LIMIT),
    recordedGameIds,
  };
}

export function validateRangeMeta(value: unknown): RangeMeta | null {
  if (!isObject(value)) return null;
  if (!isStringArray(value.recentAnswers)) return null;

  return { recentAnswers: value.recentAnswers };
}

const STATUSES: readonly RangeStatus[] = ['playing', 'won', 'lost'];
const DIRECTIONS: readonly RangeDirection[] = ['before', 'after'];

function validateGuess(value: unknown): RangeGuess | null {
  if (!isObject(value)) return null;

  const { word, direction, heat } = value;
  if (!isWord(word)) return null;

  // The secret itself carries neither a direction nor a heat.
  if (direction === null && heat === null) return { word, direction: null, heat: null };

  const knownDirection = DIRECTIONS.find((candidate) => candidate === direction);
  const knownHeat: Heat | undefined = HEAT_LEVELS.find((candidate) => candidate === heat);
  if (!knownDirection || !knownHeat) return null;

  return { word, direction: knownDirection, heat: knownHeat };
}

/**
 * Turns parsed JSON into a `RangeState`, or null if its shape is wrong. This
 * checks shape and internal consistency only; whether the secret still exists
 * is `isRangeSessionUsable` (FR-125).
 */
export function validateRangeSession(value: unknown): RangeState | null {
  if (!isObject(value)) return null;

  const { id, secret, guesses, lower, upper, currentInput, status, startedAt, finishedAt } = value;

  if (typeof id !== 'string' || id.length === 0) return null;
  if (!isWord(secret)) return null;
  if (typeof currentInput !== 'string' || currentInput.length > RANGE_LENGTH) return null;
  if (!/^[A-Z]*$/.test(currentInput)) return null;
  if (!STATUSES.some((known) => known === status)) return null;
  if (startedAt !== null && !isFiniteNumber(startedAt)) return null;
  if (finishedAt !== null && !isFiniteNumber(finishedAt)) return null;

  // The bounds are a word, or one of the two sentinels.
  const isBound = (word: unknown, sentinel: string): word is string =>
    word === sentinel || isWord(word);
  if (!isBound(lower, LOWER_SENTINEL) || !isBound(upper, UPPER_SENTINEL)) return null;
  if (!(lower < secret && secret < upper)) return null;

  if (!Array.isArray(guesses) || guesses.length > RANGE_MAX_GUESSES) return null;
  const parsed: RangeGuess[] = [];
  for (const entry of guesses) {
    const guess = validateGuess(entry);
    if (!guess) return null;
    parsed.push(guess);
  }

  const words = parsed.map((guess) => guess.word);
  if (new Set(words).size !== words.length) return null;

  return {
    id,
    secret,
    guesses: parsed,
    lower,
    upper,
    currentInput,
    status: status as RangeStatus,
    startedAt,
    finishedAt,
  };
}

/**
 * True when a saved game can still be played against today's answer list
 * (FR-125). It is discarded silently, and a new game starts, if its secret has
 * left the list, because a game whose secret is gone is unwinnable.
 */
export function isRangeSessionUsable(
  session: RangeState | null,
  isKnownAnswer: (word: string) => boolean,
): session is RangeState {
  return session !== null && isKnownAnswer(session.secret);
}
