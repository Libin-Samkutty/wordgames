import type { LetterState, WordLength } from '../types';

/**
 * WordWeaver types (SPEC §15, ARCHITECTURE §3.6).
 *
 * A subset of `WordLength`, so `loadDictionary` and the registry are reused
 * with no new types (FR-74).
 */
export type WeaverLength = Extract<WordLength, 4 | 5>;

/** Feedback for one rung letter: green or grey, never yellow (FR-81, ADR-026). */
export type RungState = Extract<LetterState, 'correct' | 'absent'>;

/** One `RungState` per letter of a rung, in order. */
export type RungEvaluation = readonly RungState[];

/** Lifecycle of a puzzle. There is no lost state (FR-85). */
export type WeaverStatus = 'playing' | 'revealing' | 'solved' | 'gave-up';

/** Why a submitted rung was rejected, in FR-80 order. */
export type RungError = 'too-short' | 'not-a-word' | 'not-one-letter' | 'already-used';

/** Why no puzzle could be generated (EC-32). */
export type GenerateError = 'no-puzzle';

/** A puzzle: a start word, an end word and the shortest distance between them (FR-76). */
export interface Puzzle {
  readonly length: WeaverLength;
  readonly start: string;
  readonly end: string;
  /** Shortest ladder length over the ladder list, counted in rungs. */
  readonly par: number;
}

/** An accepted rung and how it scored against the end word. */
export interface Rung {
  /** Uppercase, exactly `length` characters. */
  readonly word: string;
  readonly evaluation: RungEvaluation;
}

/**
 * The complete state of one puzzle.
 *
 * Serialised into LocalStorage for session restore (FR-93), so every field is
 * a plain JSON-safe value.
 */
export interface WeaverState {
  /** Stable id; the idempotency key for recording statistics (FR-92). */
  readonly id: string;
  readonly length: WeaverLength;
  readonly start: string;
  readonly end: string;
  readonly par: number;
  /** Accepted rungs, in order. The last one is the end word once solved. */
  readonly rungs: readonly Rung[];
  /** Every accepted rung submission, including rungs later undone (FR-84). */
  readonly moves: number;
  /** Letters typed into the input row but not yet submitted. */
  readonly currentInput: string;
  readonly status: WeaverStatus;
  /** Epoch ms of the first keystroke; null until the player starts typing. */
  readonly startedAt: number | null;
  /** Epoch ms when the puzzle reached `solved` or `gave-up`. */
  readonly finishedAt: number | null;
  /** One shortest ladder, start to end, set by Give up (FR-86). */
  readonly optimalLadder: readonly string[] | null;
}

export type LadderRowKind = 'start' | 'rung' | 'input' | 'end';

/** A tile as the ladder board renders it. Reuses Wordwright's tile states. */
export interface LadderTileView {
  readonly letter: string;
  readonly state: 'correct' | 'absent' | 'empty' | 'filled';
}

/** One row of the ladder board (FR-88, A11Y-16). */
export interface LadderRowView {
  readonly kind: LadderRowKind;
  /** Accessible row name: `Start`, `Rung 2`, `Next rung` or `End`. */
  readonly label: string;
  readonly tiles: readonly LadderTileView[];
  /** True for the row the player is typing into. */
  readonly isActive: boolean;
  /** True for a rung that has just been submitted and is mid-reveal. */
  readonly isRevealing: boolean;
}

/** A finished puzzle, as recorded into statistics (FR-92). */
export interface WeaverRecord {
  readonly id: string;
  readonly playedAt: number;
  readonly length: WeaverLength;
  readonly start: string;
  readonly end: string;
  readonly par: number;
  readonly moves: number;
  readonly ladderLength: number;
  readonly solved: boolean;
}

/** How a solved puzzle compares with par (FR-84, FR-91). */
export interface ResultSummary {
  readonly moves: number;
  readonly par: number;
  /** Rungs in the finished ladder, including the end word. */
  readonly ladderLength: number;
  /** `moves - par`; negative when the player beat par (FR-84). */
  readonly overPar: number;
  /** A solve with `moves <= par`. */
  readonly parHit: boolean;
  /** `Par!`, `Under par by n!` or `+n`; null unless solved. */
  readonly label: string | null;
}
