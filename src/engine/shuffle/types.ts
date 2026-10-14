import type { WordLength } from '../types';

/** Why a submitted answer was rejected, in FR-140 order. */
export type AnswerError = 'too-short' | 'hint-moved' | 'not-a-word';

/** `playing`, then `solved` by any valid anagram or `gave-up` (FR-141, FR-144). */
export type ShuffleStatus = 'playing' | 'solved' | 'gave-up';

/**
 * The complete state of one puzzle. Serialised into LocalStorage for session
 * restore (FR-147), so every field is a plain JSON-safe value.
 *
 * Invariant: the letters in `tray` plus the letters in `slots` are always the
 * letters of `scramble`, which are the letters of `target`.
 */
export interface ShuffleState {
  /** Stable id; the idempotency key for recording statistics (FR-146). */
  readonly id: string;
  readonly wordLength: WordLength;
  /** The drawn word. Hints follow it, and it is the answer shown on give up. */
  readonly target: string;
  /** The letters in their original scrambled order, for the result panel. */
  readonly scramble: string;
  /** Letters not yet in the answer row, in their current order. */
  readonly tray: readonly string[];
  /** The answer row, one entry per position: a letter, or null while empty. */
  readonly slots: readonly (string | null)[];
  /** Positions locked by a hint, ascending. Their slots hold the target's letters. */
  readonly hinted: readonly number[];
  readonly status: ShuffleStatus;
  /** The word that solved the puzzle; null while playing and after a give up. */
  readonly found: string | null;
  /** Every guess-list word using these letters, filled on solve or give up (FR-144). */
  readonly anagrams: readonly string[];
  /** Epoch ms of the first keystroke; null until the player starts. */
  readonly startedAt: number | null;
  /** Epoch ms when the puzzle was solved or given up. */
  readonly finishedAt: number | null;
}

/** A finished puzzle, as recorded into statistics (FR-146). */
export interface ShuffleRecord {
  readonly id: string;
  readonly playedAt: number;
  readonly length: WordLength;
  readonly target: string;
  /** The word that solved it; null after a give up. */
  readonly found: string | null;
  readonly hintsUsed: number;
  readonly solved: boolean;
  /**
   * The fields below were added later, so a row saved before then has none.
   */
  /** Time from the first keystroke to the end, in ms. */
  readonly solveMs?: number;
  /** How many words used these letters, so a puzzle with several answers can be told apart. */
  readonly anagramCount?: number;
}
