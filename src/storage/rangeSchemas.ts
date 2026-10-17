import { RECENT_GAMES_LIMIT } from '@/engine/constants';
import {
  DEFAULT_RANGE_LENGTH,
  HEAT_LEVELS,
  lowerSentinel,
  RANGE_LENGTHS,
  RANGE_MAX_GUESSES,
  RANGE_MAX_GUESSES_OVERALL,
  upperSentinel,
} from '@/engine/range/constants';
import type {
  Heat,
  RangeDirection,
  RangeGuess,
  RangeRecord,
  RangeState,
  RangeStatus,
} from '@/engine/range/types';
import type { WordLength } from '@/engine/types';

import { emptyTimeStats, readTimeStats, type TimeStats } from './timeStats';

/**
 * Persisted WordRange shapes and their runtime guards (SPEC §18, FR-124,
 * FR-125). Parsed JSON is untrusted: anything that fails a guard is discarded
 * in favour of defaults (EC-12).
 *
 * WordRange played 5 letters only until ADR-037. A blob saved before then has no
 * length anywhere, and every validator reads it as 5-letter data, so nobody
 * loses statistics or a saved game on upgrade (ADR-035).
 */

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

/** WordRange's own length preference, apart from every other game's (FR-67). */
export interface RangePrefs {
  readonly defaultWordLength: WordLength;
}

/** Counts kept overall and per length (FR-124). */
export interface RangeStatsBucket extends TimeStats {
  readonly gamesPlayed: number;
  readonly gamesWon: number;
  readonly currentStreak: number;
  readonly bestStreak: number;
  /**
   * Wins by guesses used. Index 0 is a win on guess 1. A length's bucket has
   * `RANGE_MAX_GUESSES[length]` entries, and the overall bucket has 15 (FR-124).
   */
  readonly distribution: readonly number[];
  /** Games saved with the heat field, how many reached Burning, and the sum of that guess number. */
  readonly heatTrackedGames: number;
  readonly burningGames: number;
  readonly totalFirstBurningAt: number;
  /** The fewest words left in the range after a loss, or null with no such loss yet. */
  readonly closestMiss: number | null;
}

export interface RangeStatsState {
  readonly overall: RangeStatsBucket;
  readonly perLength: Readonly<Record<WordLength, RangeStatsBucket>>;
  /** Newest first, at most `RECENT_GAMES_LIMIT`. */
  readonly recentGames: readonly RangeRecord[];
  /** Ids already recorded, so a replayed completion cannot double-count. */
  readonly recordedGameIds: readonly string[];
}

/** The no-repeat ring buffer, one per length (FR-115). */
export interface RangeMeta {
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
  return RANGE_LENGTHS.some((length) => length === value);
}

function isWord(value: unknown, length: number): value is string {
  return typeof value === 'string' && value.length === length && /^[A-Z]+$/.test(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/** The length a saved row names, or 5 for a row saved before lengths existed. */
function lengthOf(value: unknown): WordLength {
  return isLength(value) ? value : 5;
}

/* ------------------------------------------------------------------ *
 * Defaults
 * ------------------------------------------------------------------ */

export const DEFAULT_RANGE_PREFS: RangePrefs = { defaultWordLength: DEFAULT_RANGE_LENGTH };

/** A bucket with a distribution of `guesses` entries. */
export function emptyRangeBucket(guesses: number): RangeStatsBucket {
  return {
    gamesPlayed: 0,
    gamesWon: 0,
    currentStreak: 0,
    bestStreak: 0,
    distribution: new Array<number>(guesses).fill(0),
    heatTrackedGames: 0,
    burningGames: 0,
    totalFirstBurningAt: 0,
    closestMiss: null,
    ...emptyTimeStats(),
  };
}

function emptyPerLength(): Record<WordLength, RangeStatsBucket> {
  return {
    4: emptyRangeBucket(RANGE_MAX_GUESSES[4]),
    5: emptyRangeBucket(RANGE_MAX_GUESSES[5]),
    6: emptyRangeBucket(RANGE_MAX_GUESSES[6]),
  };
}

export function defaultRangeStats(): RangeStatsState {
  return {
    overall: emptyRangeBucket(RANGE_MAX_GUESSES_OVERALL),
    perLength: emptyPerLength(),
    recentGames: [],
    recordedGameIds: [],
  };
}

export function defaultRangeMeta(): RangeMeta {
  return { recentAnswers: { 4: [], 5: [], 6: [] } };
}

/* ------------------------------------------------------------------ *
 * Validators
 * ------------------------------------------------------------------ */

export function validateRangePrefs(value: unknown): RangePrefs | null {
  if (!isObject(value)) return null;

  // Saved before lengths existed, the blob is empty and reads as the default.
  return { defaultWordLength: lengthOf(value.defaultWordLength) };
}

function validateRecord(value: unknown): RangeRecord | null {
  if (!isObject(value)) return null;

  const { id, playedAt, secret, guessesUsed, won } = value;
  const wordLength = lengthOf(value.wordLength);

  if (typeof id !== 'string' || id.length === 0) return null;
  if (!isFiniteNumber(playedAt)) return null;
  if (!isWord(secret, wordLength)) return null;
  if (!isNonNegativeInteger(guessesUsed) || guessesUsed > RANGE_MAX_GUESSES[wordLength]) {
    return null;
  }
  if (typeof won !== 'boolean') return null;

  const base = { id, playedAt, wordLength, secret, guessesUsed, won };

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
    value.firstBurningGuess <= RANGE_MAX_GUESSES[wordLength]
  )
    extra.firstBurningGuess = value.firstBurningGuess;
  if (value.wordsLeft === null) extra.wordsLeft = null;
  else if (isNonNegativeInteger(value.wordsLeft)) extra.wordsLeft = value.wordsLeft;
  if (isWord(value.opener, wordLength)) extra.opener = value.opener;

  return { ...base, ...extra };
}

/** One bucket, whose distribution must have exactly `guesses` entries. */
function validateBucket(value: unknown, guesses: number): RangeStatsBucket | null {
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
    distribution.length !== guesses ||
    !distribution.every(isNonNegativeInteger)
  ) {
    return null;
  }

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
  };
}

export function validateRangeStats(value: unknown): RangeStatsState | null {
  if (!isObject(value)) return null;

  if (!Array.isArray(value.recentGames)) return null;
  const recentGames: RangeRecord[] = [];
  for (const entry of value.recentGames) {
    const record = validateRecord(entry);
    // Drop individual malformed rows rather than discarding the whole history.
    if (record) recentGames.push(record);
  }

  const recordedGameIds = isStringArray(value.recordedGameIds) ? value.recordedGameIds : [];
  const log = { recentGames: recentGames.slice(0, RECENT_GAMES_LIMIT), recordedGameIds };

  // Saved before lengths existed: one flat bucket of 5-letter games. It becomes
  // the 5-letter bucket, and the overall one with its distribution padded to 15.
  if (!('overall' in value)) {
    const flat = validateBucket(value, RANGE_MAX_GUESSES[5]);
    if (!flat) return null;

    const padding = new Array<number>(RANGE_MAX_GUESSES_OVERALL - flat.distribution.length).fill(0);
    return {
      overall: { ...flat, distribution: [...flat.distribution, ...padding] },
      perLength: { ...emptyPerLength(), 5: flat },
      ...log,
    };
  }

  const overall = validateBucket(value.overall, RANGE_MAX_GUESSES_OVERALL);
  if (!overall) return null;

  if (!isObject(value.perLength)) return null;
  const perLength = {} as Record<WordLength, RangeStatsBucket>;
  for (const length of RANGE_LENGTHS) {
    const bucket = validateBucket(value.perLength[String(length)], RANGE_MAX_GUESSES[length]);
    if (!bucket) return null;
    perLength[length] = bucket;
  }

  return { overall, perLength, ...log };
}

export function validateRangeMeta(value: unknown): RangeMeta | null {
  if (!isObject(value)) return null;

  // Saved before lengths existed, the buffer is one list of 5-letter secrets.
  if (Array.isArray(value.recentAnswers)) {
    if (!isStringArray(value.recentAnswers)) return null;
    return { recentAnswers: { ...defaultRangeMeta().recentAnswers, 5: value.recentAnswers } };
  }

  if (!isObject(value.recentAnswers)) return null;

  const recentAnswers = {} as Record<WordLength, readonly string[]>;
  for (const length of RANGE_LENGTHS) {
    const entry = value.recentAnswers[String(length)];
    recentAnswers[length] = isStringArray(entry) ? entry : [];
  }

  return { recentAnswers };
}

const STATUSES: readonly RangeStatus[] = ['playing', 'won', 'lost'];
const DIRECTIONS: readonly RangeDirection[] = ['before', 'after'];

function validateGuess(value: unknown, length: WordLength): RangeGuess | null {
  if (!isObject(value)) return null;

  const { word, direction, heat } = value;
  if (!isWord(word, length)) return null;

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
 * is `isRangeSessionUsable` (FR-125). A game saved before lengths existed has no
 * `wordLength` and is a 5-letter game.
 */
export function validateRangeSession(value: unknown): RangeState | null {
  if (!isObject(value)) return null;

  const { id, secret, guesses, lower, upper, currentInput, status, startedAt, finishedAt } = value;
  const wordLength = lengthOf(value.wordLength);

  if (typeof id !== 'string' || id.length === 0) return null;
  if (!isWord(secret, wordLength)) return null;
  if (typeof currentInput !== 'string' || currentInput.length > wordLength) return null;
  if (!/^[A-Z]*$/.test(currentInput)) return null;
  if (!STATUSES.some((known) => known === status)) return null;
  if (startedAt !== null && !isFiniteNumber(startedAt)) return null;
  if (finishedAt !== null && !isFiniteNumber(finishedAt)) return null;

  // The bounds are a word, or one of the two sentinels.
  const isBound = (word: unknown, sentinel: string): word is string =>
    word === sentinel || isWord(word, wordLength);
  if (!isBound(lower, lowerSentinel(wordLength)) || !isBound(upper, upperSentinel(wordLength))) {
    return null;
  }
  if (!(lower < secret && secret < upper)) return null;

  if (!Array.isArray(guesses) || guesses.length > RANGE_MAX_GUESSES[wordLength]) return null;
  const parsed: RangeGuess[] = [];
  for (const entry of guesses) {
    const guess = validateGuess(entry, wordLength);
    if (!guess) return null;
    parsed.push(guess);
  }

  const words = parsed.map((guess) => guess.word);
  if (new Set(words).size !== words.length) return null;

  return {
    id,
    secret,
    wordLength,
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
