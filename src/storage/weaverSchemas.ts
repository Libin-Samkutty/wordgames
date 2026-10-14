import { RECENT_GAMES_LIMIT } from '@/engine/constants';
import { DEFAULT_WEAVER_LENGTH, MAX_MOVES, WEAVER_LENGTHS } from '@/engine/weaver/constants';
import type {
  Rung,
  RungState,
  WeaverLength,
  WeaverRecord,
  WeaverState,
  WeaverStatus,
} from '@/engine/weaver/types';

/**
 * Persisted WordWeaver shapes and their runtime guards (SPEC §16, FR-68,
 * FR-92, FR-93).
 *
 * Like every storage boundary, parsed JSON here is untrusted: it is
 * user-writable and outlives app upgrades. Anything that fails a guard is
 * discarded in favour of defaults (EC-12).
 */

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

/** WordWeaver's own preference, apart from Wordwright's (FR-74, FR-67). */
export interface WeaverPrefs {
  readonly defaultWordLength: WeaverLength;
}

/** Metrics kept overall and per length (FR-92). */
export interface WeaverStatsBucket {
  readonly gamesPlayed: number;
  readonly gamesSolved: number;
  /** Solves with `moves <= par` (FR-84). */
  readonly parHits: number;
  /** Sum of `moves - par` over solved games. May be negative. */
  readonly totalOverPar: number;
  /** The best single solve: moves minus par, so -1 is one under par. Null before any solve. */
  readonly bestOverPar: number | null;
  readonly currentStreak: number;
  readonly bestStreak: number;
}

export interface WeaverStatsState {
  readonly overall: WeaverStatsBucket;
  readonly perLength: Readonly<Record<WeaverLength, WeaverStatsBucket>>;
  /** Newest first, at most `RECENT_GAMES_LIMIT` (FR-92). */
  readonly recentGames: readonly WeaverRecord[];
  /** Ids already recorded, so a replayed completion cannot double-count. */
  readonly recordedGameIds: readonly string[];
}

/** The no-repeat ring buffer for start words, per length (FR-78, FR-68). */
export interface WeaverMeta {
  readonly recentStarts: Readonly<Record<WeaverLength, readonly string[]>>;
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

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isWeaverLength(value: unknown): value is WeaverLength {
  return WEAVER_LENGTHS.some((length) => length === value);
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

export const DEFAULT_WEAVER_PREFS: WeaverPrefs = { defaultWordLength: DEFAULT_WEAVER_LENGTH };

export function emptyWeaverBucket(): WeaverStatsBucket {
  return {
    gamesPlayed: 0,
    gamesSolved: 0,
    parHits: 0,
    totalOverPar: 0,
    bestOverPar: null,
    currentStreak: 0,
    bestStreak: 0,
  };
}

export function defaultWeaverStats(): WeaverStatsState {
  return {
    overall: emptyWeaverBucket(),
    perLength: { 4: emptyWeaverBucket(), 5: emptyWeaverBucket() },
    recentGames: [],
    recordedGameIds: [],
  };
}

export function defaultWeaverMeta(): WeaverMeta {
  return { recentStarts: { 4: [], 5: [] } };
}

/* ------------------------------------------------------------------ *
 * Validators
 * ------------------------------------------------------------------ */

export function validateWeaverPrefs(value: unknown): WeaverPrefs | null {
  if (!isObject(value)) return null;
  if (!isWeaverLength(value.defaultWordLength)) return null;

  return { defaultWordLength: value.defaultWordLength };
}

function validateBucket(value: unknown): WeaverStatsBucket | null {
  if (!isObject(value)) return null;

  const { gamesPlayed, gamesSolved, parHits, totalOverPar, currentStreak, bestStreak } = value;

  if (
    !isNonNegativeInteger(gamesPlayed) ||
    !isNonNegativeInteger(gamesSolved) ||
    !isNonNegativeInteger(parHits) ||
    !isNonNegativeInteger(currentStreak) ||
    !isNonNegativeInteger(bestStreak) ||
    !isInteger(totalOverPar)
  ) {
    return null;
  }

  // Cross-field sanity: the counts must nest, or the record is incoherent.
  if (gamesSolved > gamesPlayed) return null;
  if (parHits > gamesSolved) return null;

  // A bucket saved before this field existed has none, which reads as no best yet.
  const stored = value.bestOverPar;
  if (stored !== undefined && stored !== null && !isInteger(stored)) return null;
  const bestOverPar = typeof stored === 'number' ? stored : null;

  return {
    gamesPlayed,
    gamesSolved,
    parHits,
    totalOverPar,
    bestOverPar,
    currentStreak,
    bestStreak,
  };
}

function validateRecord(value: unknown): WeaverRecord | null {
  if (!isObject(value)) return null;

  const { id, playedAt, length, start, end, par, moves, ladderLength, solved } = value;

  if (typeof id !== 'string' || id.length === 0) return null;
  if (!isFiniteNumber(playedAt)) return null;
  if (!isWeaverLength(length)) return null;
  if (!isWord(start, length) || !isWord(end, length)) return null;
  if (!isNonNegativeInteger(par) || !isNonNegativeInteger(moves)) return null;
  if (!isNonNegativeInteger(ladderLength)) return null;
  if (typeof solved !== 'boolean') return null;

  return { id, playedAt, length, start, end, par, moves, ladderLength, solved };
}

export function validateWeaverStats(value: unknown): WeaverStatsState | null {
  if (!isObject(value)) return null;

  const overall = validateBucket(value.overall);
  if (!overall) return null;

  if (!isObject(value.perLength)) return null;
  const perLength = {} as Record<WeaverLength, WeaverStatsBucket>;
  for (const length of WEAVER_LENGTHS) {
    const bucket = validateBucket(value.perLength[String(length)]);
    if (!bucket) return null;
    perLength[length] = bucket;
  }

  if (!Array.isArray(value.recentGames)) return null;
  const recentGames: WeaverRecord[] = [];
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

export function validateWeaverMeta(value: unknown): WeaverMeta | null {
  if (!isObject(value)) return null;
  if (!isObject(value.recentStarts)) return null;

  const recentStarts = {} as Record<WeaverLength, readonly string[]>;
  for (const length of WEAVER_LENGTHS) {
    const entry = value.recentStarts[String(length)];
    recentStarts[length] = isStringArray(entry) ? entry : [];
  }

  return { recentStarts };
}

const STATUSES: readonly WeaverStatus[] = ['playing', 'revealing', 'solved', 'gave-up'];

function validateRungEntry(value: unknown, length: number): Rung | null {
  if (!isObject(value)) return null;

  const { word, evaluation } = value;
  if (!isWord(word, length)) return null;
  if (!Array.isArray(evaluation) || evaluation.length !== length) return null;

  const states: RungState[] = [];
  for (const state of evaluation as readonly unknown[]) {
    if (state !== 'correct' && state !== 'absent') return null;
    states.push(state);
  }

  return { word, evaluation: states };
}

/**
 * Turns parsed JSON into a `WeaverState`, or null if its shape is wrong.
 *
 * This checks shape only. Whether the puzzle still makes sense against the
 * current word lists is `isWeaverSessionUsable` (FR-93). A `revealing` status
 * is kept as stored: the provider finishes the reveal on restore, so the row
 * shows settled and a winning rung is recorded as the solve it was (EC-23).
 */
export function validateWeaverSession(value: unknown): WeaverState | null {
  if (!isObject(value)) return null;

  const {
    id,
    length,
    start,
    end,
    par,
    rungs,
    moves,
    currentInput,
    status,
    startedAt,
    finishedAt,
    optimalLadder,
  } = value;

  if (typeof id !== 'string' || id.length === 0) return null;
  if (!isWeaverLength(length)) return null;
  if (!isWord(start, length) || !isWord(end, length)) return null;
  if (!isNonNegativeInteger(par)) return null;
  if (!isNonNegativeInteger(moves) || moves > MAX_MOVES) return null;
  if (typeof currentInput !== 'string' || currentInput.length > length) return null;
  if (!/^[A-Z]*$/.test(currentInput)) return null;
  if (!STATUSES.some((known) => known === status)) return null;
  if (startedAt !== null && !isFiniteNumber(startedAt)) return null;
  if (finishedAt !== null && !isFiniteNumber(finishedAt)) return null;

  if (!Array.isArray(rungs)) return null;
  const parsed: Rung[] = [];
  for (const entry of rungs) {
    const rung = validateRungEntry(entry, length);
    if (!rung) return null;
    parsed.push(rung);
  }
  // Every rung is an accepted submission, so moves can never be fewer.
  if (moves < parsed.length) return null;

  let ladder: readonly string[] | null = null;
  if (optimalLadder !== null) {
    if (!isStringArray(optimalLadder)) return null;
    if (!optimalLadder.every((word) => isWord(word, length))) return null;
    ladder = optimalLadder;
  }

  return {
    id,
    length,
    start,
    end,
    par,
    rungs: parsed,
    moves,
    currentInput,
    status: status as WeaverStatus,
    startedAt,
    finishedAt,
    optimalLadder: ladder,
  };
}

/* ------------------------------------------------------------------ *
 * Session restore (FR-93)
 * ------------------------------------------------------------------ */

function differsInOnePosition(a: string, b: string): boolean {
  let differences = 0;
  for (let position = 0; position < a.length; position += 1) {
    if (a[position] !== b[position]) differences += 1;
  }
  return differences === 1;
}

/**
 * True when a saved puzzle can still be played against today's word lists
 * (FR-93, EC-33). It is discarded silently, and a new puzzle starts, if:
 *
 *   - its length is not the length now in use;
 *   - the start or the end is no longer in the answer list, or they are equal;
 *   - any rung is no longer in the guess list;
 *   - the ladder breaks the one-letter rule, or repeats a word;
 *   - it claims to be solved without ending on the end word.
 *
 * Regenerating the lists can retire a word, and resuming a ladder that now
 * contains a non-word would leave a puzzle the player could not trust.
 */
export function isWeaverSessionUsable(
  session: WeaverState | null,
  length: WeaverLength,
  isAnswer: (word: string) => boolean,
  isGuess: (word: string) => boolean,
): session is WeaverState {
  if (!session) return false;
  if (session.length !== length) return false;
  if (session.start === session.end) return false;
  if (!isAnswer(session.start) || !isAnswer(session.end)) return false;

  const seen = new Set([session.start]);
  let previous = session.start;
  for (const { word } of session.rungs) {
    if (!isGuess(word)) return false;
    if (!differsInOnePosition(previous, word)) return false;
    if (seen.has(word)) return false;
    seen.add(word);
    previous = word;
  }

  if (session.status === 'solved' && previous !== session.end) return false;

  return true;
}
