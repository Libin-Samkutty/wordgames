import { RECENT_GAMES_LIMIT } from '@/engine/constants';
import { anagramKey } from '@/engine/shuffle/anagram';
import {
  DEFAULT_SHUFFLE_LENGTH,
  MAX_HINTS,
  SHUFFLE_LENGTHS,
  TIME_BUCKET_COUNT,
} from '@/engine/shuffle/constants';
import type { ShuffleRecord, ShuffleState, ShuffleStatus } from '@/engine/shuffle/types';
import type { WordLength } from '@/engine/types';

import { emptyTimeStats, readTimeStats, type TimeStats } from './timeStats';

/**
 * Persisted WordShuffle shapes and their runtime guards (SPEC §20, FR-137,
 * FR-146, FR-147). Parsed JSON is untrusted: anything that fails a guard is
 * discarded in favour of defaults (EC-12).
 */

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

/** WordShuffle's own length preference, apart from every other game's (FR-137, FR-67). */
export interface ShufflePrefs {
  readonly defaultWordLength: WordLength;
}

/** Metrics kept overall and per length (FR-146). */
export interface ShuffleStatsBucket extends TimeStats {
  readonly gamesPlayed: number;
  readonly gamesSolved: number;
  /** Solves that took no hint. */
  readonly solvedWithoutHints: number;
  /** Hints taken across every solve, so the average per solve can be derived. */
  readonly totalHintsOnSolves: number;
  /** A solve adds one; a give up resets it to 0. */
  readonly currentStreak: number;
  readonly bestStreak: number;
  /** Timed solves by duration: under 10s, 30s, 1m, 2m, and longer. Sums to `timedSolves`. */
  readonly timeDistribution: readonly number[];
  /** Solves of a puzzle that had several answers, and how many of them used another word. */
  readonly multiAnswerSolves: number;
  readonly altAnswerSolves: number;
}

export interface ShuffleStatsState {
  readonly overall: ShuffleStatsBucket;
  readonly perLength: Readonly<Record<WordLength, ShuffleStatsBucket>>;
  /** Newest first, at most `RECENT_GAMES_LIMIT` (FR-146). */
  readonly recentGames: readonly ShuffleRecord[];
  /** Ids already recorded, so a replayed completion cannot double-count. */
  readonly recordedGameIds: readonly string[];
}

/** The no-repeat ring buffer, one per length (FR-138). */
export interface ShuffleMeta {
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
  return SHUFFLE_LENGTHS.some((length) => length === value);
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

export const DEFAULT_SHUFFLE_PREFS: ShufflePrefs = { defaultWordLength: DEFAULT_SHUFFLE_LENGTH };

export function emptyShuffleBucket(): ShuffleStatsBucket {
  return {
    gamesPlayed: 0,
    gamesSolved: 0,
    solvedWithoutHints: 0,
    totalHintsOnSolves: 0,
    currentStreak: 0,
    bestStreak: 0,
    timeDistribution: new Array<number>(TIME_BUCKET_COUNT).fill(0),
    multiAnswerSolves: 0,
    altAnswerSolves: 0,
    ...emptyTimeStats(),
  };
}

export function defaultShuffleStats(): ShuffleStatsState {
  return {
    overall: emptyShuffleBucket(),
    perLength: { 4: emptyShuffleBucket(), 5: emptyShuffleBucket(), 6: emptyShuffleBucket() },
    recentGames: [],
    recordedGameIds: [],
  };
}

export function defaultShuffleMeta(): ShuffleMeta {
  return { recentAnswers: { 4: [], 5: [], 6: [] } };
}

/* ------------------------------------------------------------------ *
 * Validators
 * ------------------------------------------------------------------ */

export function validateShufflePrefs(value: unknown): ShufflePrefs | null {
  if (!isObject(value)) return null;
  if (!isLength(value.defaultWordLength)) return null;

  return { defaultWordLength: value.defaultWordLength };
}

function validateBucket(value: unknown): ShuffleStatsBucket | null {
  if (!isObject(value)) return null;

  const {
    gamesPlayed,
    gamesSolved,
    solvedWithoutHints,
    totalHintsOnSolves,
    currentStreak,
    bestStreak,
  } = value;
  if (
    !isNonNegativeInteger(gamesPlayed) ||
    !isNonNegativeInteger(gamesSolved) ||
    !isNonNegativeInteger(solvedWithoutHints) ||
    !isNonNegativeInteger(totalHintsOnSolves) ||
    !isNonNegativeInteger(currentStreak) ||
    !isNonNegativeInteger(bestStreak)
  ) {
    return null;
  }

  // Cross-field sanity: the counts must nest, or the record is incoherent.
  if (gamesSolved > gamesPlayed) return null;
  if (solvedWithoutHints > gamesSolved) return null;
  // Every solve that used a hint used at least one and at most the limit.
  const hinted = gamesSolved - solvedWithoutHints;
  if (totalHintsOnSolves < hinted || totalHintsOnSolves > hinted * MAX_HINTS) return null;

  // A bucket saved before these fields existed has none, which reads as zero.
  const time = readTimeStats(value);
  if (!time) return null;

  const storedDistribution = value.timeDistribution;
  const timeDistribution: readonly unknown[] =
    storedDistribution === undefined
      ? new Array<number>(TIME_BUCKET_COUNT).fill(0)
      : Array.isArray(storedDistribution)
        ? storedDistribution
        : [];
  if (
    timeDistribution.length !== TIME_BUCKET_COUNT ||
    !timeDistribution.every(isNonNegativeInteger)
  ) {
    return null;
  }
  const timed = timeDistribution.reduce((sum, count) => sum + count, 0);
  if (timed !== time.timedSolves || time.timedSolves > gamesSolved) return null;

  const multiAnswerSolves = value.multiAnswerSolves === undefined ? 0 : value.multiAnswerSolves;
  const altAnswerSolves = value.altAnswerSolves === undefined ? 0 : value.altAnswerSolves;
  if (!isNonNegativeInteger(multiAnswerSolves) || !isNonNegativeInteger(altAnswerSolves)) {
    return null;
  }
  if (altAnswerSolves > multiAnswerSolves || multiAnswerSolves > gamesSolved) return null;

  return {
    gamesPlayed,
    gamesSolved,
    solvedWithoutHints,
    totalHintsOnSolves,
    currentStreak,
    bestStreak,
    timeDistribution: timeDistribution,
    multiAnswerSolves,
    altAnswerSolves,
    ...time,
  };
}

function validateRecord(value: unknown): ShuffleRecord | null {
  if (!isObject(value)) return null;

  const { id, playedAt, length, target, found, hintsUsed, solved } = value;

  if (typeof id !== 'string' || id.length === 0) return null;
  if (!isFiniteNumber(playedAt)) return null;
  if (!isLength(length)) return null;
  if (!isWord(target, length)) return null;
  if (!isNonNegativeInteger(hintsUsed) || hintsUsed > MAX_HINTS) return null;
  if (typeof solved !== 'boolean') return null;
  // A solve names the word found, a give up has none.
  if (solved ? !isWord(found, length) : found !== null) return null;

  const base = {
    id,
    playedAt,
    length,
    target,
    found: found as string | null,
    hintsUsed,
    solved,
  };

  // Fields added later are optional, so an older row still loads.
  const extra: { solveMs?: number; anagramCount?: number } = {};
  if (isFiniteNumber(value.solveMs) && value.solveMs >= 0) extra.solveMs = value.solveMs;
  if (isNonNegativeInteger(value.anagramCount)) extra.anagramCount = value.anagramCount;

  return { ...base, ...extra };
}

export function validateShuffleStats(value: unknown): ShuffleStatsState | null {
  if (!isObject(value)) return null;

  const overall = validateBucket(value.overall);
  if (!overall) return null;

  if (!isObject(value.perLength)) return null;
  const perLength = {} as Record<WordLength, ShuffleStatsBucket>;
  for (const length of SHUFFLE_LENGTHS) {
    const bucket = validateBucket(value.perLength[String(length)]);
    if (!bucket) return null;
    perLength[length] = bucket;
  }

  if (!Array.isArray(value.recentGames)) return null;
  const recentGames: ShuffleRecord[] = [];
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

export function validateShuffleMeta(value: unknown): ShuffleMeta | null {
  if (!isObject(value)) return null;
  if (!isObject(value.recentAnswers)) return null;

  const recentAnswers = {} as Record<WordLength, readonly string[]>;
  for (const length of SHUFFLE_LENGTHS) {
    const entry = value.recentAnswers[String(length)];
    recentAnswers[length] = isStringArray(entry) ? entry : [];
  }

  return { recentAnswers };
}

const STATUSES: readonly ShuffleStatus[] = ['playing', 'solved', 'gave-up'];

/** A letters-only string, one per tray entry. */
function isLetter(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z]$/.test(value);
}

/**
 * Turns parsed JSON into a `ShuffleState`, or null if its shape or its internal
 * consistency is wrong: the tray and the row must hold exactly the letters of
 * the scramble, which are the letters of the target, and every hinted slot must
 * hold the target's letter. Whether the target still exists is
 * `isShuffleSessionUsable` (FR-147).
 */
export function validateShuffleSession(value: unknown): ShuffleState | null {
  if (!isObject(value)) return null;

  const {
    id,
    wordLength,
    target,
    scramble,
    tray,
    slots,
    hinted,
    status,
    found,
    anagrams,
    startedAt,
    finishedAt,
  } = value;

  if (typeof id !== 'string' || id.length === 0) return null;
  if (!isLength(wordLength)) return null;
  if (!isWord(target, wordLength) || !isWord(scramble, wordLength)) return null;
  if (anagramKey(scramble) !== anagramKey(target)) return null;
  if (!STATUSES.some((known) => known === status)) return null;
  if (startedAt !== null && !isFiniteNumber(startedAt)) return null;
  if (finishedAt !== null && !isFiniteNumber(finishedAt)) return null;

  if (!Array.isArray(tray) || !tray.every(isLetter)) return null;
  if (!Array.isArray(slots) || slots.length !== wordLength) return null;
  if (!slots.every((slot) => slot === null || isLetter(slot))) return null;
  const inRow = (slots as (string | null)[]).filter((slot): slot is string => slot !== null);
  // Every letter is in the tray or the row, and none is gained or lost.
  if (anagramKey([...tray, ...inRow].join('')) !== anagramKey(scramble)) return null;

  if (!Array.isArray(hinted) || hinted.length > MAX_HINTS) return null;
  if (!hinted.every((position) => isNonNegativeInteger(position) && position < wordLength)) {
    return null;
  }
  if (new Set(hinted).size !== hinted.length) return null;
  // Ascending, and each locked slot holds the target's letter.
  if (hinted.some((position, index) => index > 0 && position <= (hinted[index - 1] as number))) {
    return null;
  }
  if (hinted.some((position) => slots[position as number] !== target[position as number])) {
    return null;
  }

  if (!isStringArray(anagrams)) return null;
  // A solve names the word found; a puzzle in play or given up has none.
  if (status === 'solved' ? !isWord(found, wordLength) : found !== null) return null;

  return {
    id,
    wordLength,
    target,
    scramble,
    tray: tray,
    slots: slots as (string | null)[],
    hinted: hinted as number[],
    status: status as ShuffleStatus,
    found: found as string | null,
    anagrams,
    startedAt,
    finishedAt,
  };
}

/**
 * True when a saved puzzle can still be played against today's answer list
 * (FR-147). It is discarded silently, and a new puzzle starts, if its target
 * has left the list, because hints follow the target.
 */
export function isShuffleSessionUsable(
  session: ShuffleState | null,
  isKnownAnswer: (word: string) => boolean,
): session is ShuffleState {
  return session !== null && isKnownAnswer(session.target);
}
