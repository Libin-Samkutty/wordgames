import { MAX_GUESSES, RECENT_GAMES_LIMIT } from '@/engine/constants';
import {
  DEFAULT_STACK_MODE,
  STACK_LENGTH,
  STACK_MODES,
  STACK_MODE_IDS,
} from '@/engine/stack/constants';
import type {
  StackBoard,
  StackMode,
  StackRecord,
  StackState,
  StackStatus,
} from '@/engine/stack/types';
import type { Guess, LetterState } from '@/engine/types';

import { emptyTimeStats, readTimeStats, type TimeStats } from './timeStats';

/**
 * Persisted WordStack shapes and their runtime guards (SPEC §17, FR-111,
 * FR-112). Parsed JSON is untrusted: anything that fails a guard is discarded
 * in favour of defaults (EC-12).
 */

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

/** The mode preference, which persists (FR-102). */
export interface StackPrefs {
  readonly mode: StackMode;
}

/** Counts kept overall and per mode (FR-111). */
export interface StackStatsBucket extends TimeStats {
  readonly gamesPlayed: number;
  readonly gamesWon: number;
  readonly currentStreak: number;
  readonly bestStreak: number;
  /** Losses with every board but one solved ("so close"). */
  readonly nearMisses: number;
  /** Boards solved, summed over losses, for the average on a loss. */
  readonly boardsSolvedOnLosses: number;
  /** Games that solved at least one board and saved when, and the sum of the first solve's guess. */
  readonly firstBoardGames: number;
  readonly totalFirstBoardGuess: number;
}

/**
 * A mode's counts plus its guess distribution for wins. Duo wins take 2 to 7
 * guesses and Quad wins 4 to 9, so each distribution has six buckets, and index
 * 0 is the fewest guesses that mode allows a win in (FR-111).
 */
export interface StackModeStats extends StackStatsBucket {
  readonly distribution: readonly number[];
}

export interface StackStatsState {
  readonly overall: StackStatsBucket;
  readonly perMode: Readonly<Record<StackMode, StackModeStats>>;
  /** Newest first, at most `RECENT_GAMES_LIMIT` (FR-111). */
  readonly recentGames: readonly StackRecord[];
  /** Ids already recorded, so a replayed completion cannot double-count. */
  readonly recordedGameIds: readonly string[];
}

/** One no-repeat ring buffer, shared by both modes (FR-103). */
export interface StackMeta {
  readonly recentAnswers: readonly string[];
}

/** The fewest guesses a win can take in each mode: one per board at best (FR-111). */
export const STACK_MIN_WIN_GUESSES: Readonly<Record<StackMode, number>> = {
  duo: STACK_MODES.duo.boards,
  quad: STACK_MODES.quad.boards,
};

/** Buckets in a distribution: from the fewest guesses to the limit. */
export function distributionLength(mode: StackMode): number {
  return STACK_MODES[mode].maxGuesses - STACK_MIN_WIN_GUESSES[mode] + 1;
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

function isMode(value: unknown): value is StackMode {
  return STACK_MODE_IDS.some((mode) => mode === value);
}

function isWord(value: unknown): value is string {
  return typeof value === 'string' && value.length === STACK_LENGTH && /^[A-Z]+$/.test(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/* ------------------------------------------------------------------ *
 * Defaults
 * ------------------------------------------------------------------ */

export const DEFAULT_STACK_PREFS: StackPrefs = { mode: DEFAULT_STACK_MODE };

function emptyBucket(): StackStatsBucket {
  return {
    gamesPlayed: 0,
    gamesWon: 0,
    currentStreak: 0,
    bestStreak: 0,
    nearMisses: 0,
    boardsSolvedOnLosses: 0,
    firstBoardGames: 0,
    totalFirstBoardGuess: 0,
    ...emptyTimeStats(),
  };
}

export function emptyStackModeStats(mode: StackMode): StackModeStats {
  return { ...emptyBucket(), distribution: new Array<number>(distributionLength(mode)).fill(0) };
}

export function defaultStackStats(): StackStatsState {
  return {
    overall: emptyBucket(),
    perMode: { duo: emptyStackModeStats('duo'), quad: emptyStackModeStats('quad') },
    recentGames: [],
    recordedGameIds: [],
  };
}

export function defaultStackMeta(): StackMeta {
  return { recentAnswers: [] };
}

/* ------------------------------------------------------------------ *
 * Validators
 * ------------------------------------------------------------------ */

export function validateStackPrefs(value: unknown): StackPrefs | null {
  if (!isObject(value)) return null;
  if (!isMode(value.mode)) return null;

  return { mode: value.mode };
}

function validateBucket(value: unknown): StackStatsBucket | null {
  if (!isObject(value)) return null;

  const { gamesPlayed, gamesWon, currentStreak, bestStreak } = value;
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

  // A bucket saved before these fields existed has none, which reads as zero.
  const counters = [
    value.nearMisses,
    value.boardsSolvedOnLosses,
    value.firstBoardGames,
    value.totalFirstBoardGuess,
  ].map((counter) => (counter === undefined ? 0 : counter));
  if (!counters.every(isNonNegativeInteger)) return null;
  const [nearMisses = 0, boardsSolvedOnLosses = 0, firstBoardGames = 0, totalFirstBoardGuess = 0] =
    counters;
  if (nearMisses > gamesPlayed - gamesWon) return null;

  const time = readTimeStats(value);
  if (!time) return null;

  return {
    gamesPlayed,
    gamesWon,
    currentStreak,
    bestStreak,
    nearMisses,
    boardsSolvedOnLosses,
    firstBoardGames,
    totalFirstBoardGuess,
    ...time,
  };
}

function validateModeStats(value: unknown, mode: StackMode): StackModeStats | null {
  const bucket = validateBucket(value);
  if (!bucket || !isObject(value)) return null;

  const { distribution } = value;
  if (
    !Array.isArray(distribution) ||
    distribution.length !== distributionLength(mode) ||
    !distribution.every(isNonNegativeInteger)
  ) {
    return null;
  }

  return { ...bucket, distribution };
}

function validateRecord(value: unknown): StackRecord | null {
  if (!isObject(value)) return null;

  const { id, playedAt, mode, answers, guessesUsed, boardsSolved, won } = value;

  if (typeof id !== 'string' || id.length === 0) return null;
  if (!isFiniteNumber(playedAt)) return null;
  if (!isMode(mode)) return null;
  if (!Array.isArray(answers) || answers.length !== STACK_MODES[mode].boards) return null;
  if (!answers.every(isWord)) return null;
  if (!isNonNegativeInteger(guessesUsed) || guessesUsed > STACK_MODES[mode].maxGuesses) return null;
  if (!isNonNegativeInteger(boardsSolved) || boardsSolved > STACK_MODES[mode].boards) return null;
  if (typeof won !== 'boolean') return null;

  const base = { id, playedAt, mode, answers: answers, guessesUsed, boardsSolved, won };

  // Fields added later are optional, so an older row still loads.
  const extra: { solveMs?: number; boardSolveGuesses?: readonly (number | null)[] } = {};
  if (isFiniteNumber(value.solveMs) && value.solveMs >= 0) extra.solveMs = value.solveMs;
  const solves = value.boardSolveGuesses;
  if (
    Array.isArray(solves) &&
    solves.length === STACK_MODES[mode].boards &&
    solves.every(
      (entry) =>
        entry === null || (isNonNegativeInteger(entry) && entry <= STACK_MODES[mode].maxGuesses),
    )
  ) {
    extra.boardSolveGuesses = solves as readonly (number | null)[];
  }

  return { ...base, ...extra };
}

export function validateStackStats(value: unknown): StackStatsState | null {
  if (!isObject(value)) return null;

  const overall = validateBucket(value.overall);
  if (!overall) return null;

  if (!isObject(value.perMode)) return null;
  const duo = validateModeStats(value.perMode.duo, 'duo');
  const quad = validateModeStats(value.perMode.quad, 'quad');
  if (!duo || !quad) return null;

  if (!Array.isArray(value.recentGames)) return null;
  const recentGames: StackRecord[] = [];
  for (const entry of value.recentGames) {
    const record = validateRecord(entry);
    // Drop individual malformed rows rather than discarding the whole history.
    if (record) recentGames.push(record);
  }

  const recordedGameIds = isStringArray(value.recordedGameIds) ? value.recordedGameIds : [];

  return {
    overall,
    perMode: { duo, quad },
    recentGames: recentGames.slice(0, RECENT_GAMES_LIMIT),
    recordedGameIds,
  };
}

export function validateStackMeta(value: unknown): StackMeta | null {
  if (!isObject(value)) return null;
  if (!isStringArray(value.recentAnswers)) return null;

  return { recentAnswers: value.recentAnswers };
}

const STATUSES: readonly StackStatus[] = ['playing', 'revealing', 'won', 'lost'];
const LETTER_STATES: readonly LetterState[] = ['correct', 'present', 'absent'];

function validateGuess(value: unknown): Guess | null {
  if (!isObject(value)) return null;

  const { word, evaluation } = value;
  if (!isWord(word)) return null;
  if (!Array.isArray(evaluation) || evaluation.length !== STACK_LENGTH) return null;

  const states: LetterState[] = [];
  for (const state of evaluation as readonly unknown[]) {
    const known = LETTER_STATES.find((candidate) => candidate === state);
    if (!known) return null;
    states.push(known);
  }

  return { word, evaluation: states };
}

function validateBoard(value: unknown): StackBoard | null {
  if (!isObject(value)) return null;

  const { answer, guesses } = value;
  if (!isWord(answer)) return null;
  if (!Array.isArray(guesses) || guesses.length > MAX_GUESSES + 3) return null;

  const parsed: Guess[] = [];
  for (const entry of guesses) {
    const guess = validateGuess(entry);
    if (!guess) return null;
    parsed.push(guess);
  }

  return { answer, guesses: parsed };
}

/**
 * Turns parsed JSON into a `StackState`, or null if its shape is wrong. This
 * checks shape and internal consistency only; whether the answers still exist
 * is `isStackSessionUsable` (FR-112). A `revealing` status is kept as stored:
 * the provider finishes the reveal on restore.
 */
export function validateStackSession(value: unknown): StackState | null {
  if (!isObject(value)) return null;

  const { id, mode, boards, words, currentInput, status, startedAt, finishedAt } = value;

  if (typeof id !== 'string' || id.length === 0) return null;
  if (!isMode(mode)) return null;
  const rules = STACK_MODES[mode];

  if (typeof currentInput !== 'string' || currentInput.length > STACK_LENGTH) return null;
  if (!/^[A-Z]*$/.test(currentInput)) return null;
  if (!STATUSES.some((known) => known === status)) return null;
  if (startedAt !== null && !isFiniteNumber(startedAt)) return null;
  if (finishedAt !== null && !isFiniteNumber(finishedAt)) return null;

  if (!Array.isArray(words) || words.length > rules.maxGuesses || !words.every(isWord)) return null;
  if (!Array.isArray(boards) || boards.length !== rules.boards) return null;

  const parsed: StackBoard[] = [];
  for (const entry of boards) {
    const board = validateBoard(entry);
    if (!board) return null;
    // Every guess on a board is one of the game's words, in order.
    if (board.guesses.length > words.length) return null;
    if (board.guesses.some((guess, index) => guess.word !== words[index])) return null;
    parsed.push(board);
  }

  return {
    id,
    mode,
    boards: parsed,
    words: words,
    currentInput,
    status: status as StackStatus,
    startedAt,
    finishedAt,
  };
}

/**
 * True when a saved game can still be played against today's answer list
 * (FR-112). It is discarded silently, and a new game starts, if any board's
 * answer has left the list or two boards share an answer. Regenerating the
 * lists can retire a word, and resuming a board whose solution is no longer
 * valid would be unwinnable.
 */
export function isStackSessionUsable(
  session: StackState | null,
  isKnownAnswer: (word: string) => boolean,
): session is StackState {
  if (!session) return false;

  const answers = session.boards.map((board) => board.answer);
  if (new Set(answers).size !== answers.length) return false;

  return answers.every(isKnownAnswer);
}
