import type { Guess } from '../types';
import type { STACK_MODES } from './constants';

/** `duo` (2 boards) or `quad` (4 boards). */
export type StackMode = keyof typeof STACK_MODES;

/** Lifecycle of a game (ARCHITECTURE §3.7). */
export type StackStatus = 'playing' | 'revealing' | 'won' | 'lost';

/** One board: its secret and every guess that reached it. */
export interface StackBoard {
  /** The solution. Uppercase, 5 letters. */
  readonly answer: string;
  /**
   * Guesses scored against this board. A solved board takes no more, so this
   * can be shorter than the game's `words` (FR-106).
   */
  readonly guesses: readonly Guess[];
}

/**
 * The complete state of one game.
 *
 * Serialised into LocalStorage for session restore (FR-112), so every field is
 * a plain JSON-safe value.
 */
export interface StackState {
  /** Stable id; the idempotency key for recording statistics (FR-111). */
  readonly id: string;
  readonly mode: StackMode;
  /** 2 boards for Duo, 4 for Quad, each with a different answer (FR-103). */
  readonly boards: readonly StackBoard[];
  /** Every accepted guess, in order. Its length is the guesses used. */
  readonly words: readonly string[];
  /** Letters typed into the active row but not yet submitted. */
  readonly currentInput: string;
  readonly status: StackStatus;
  /** Epoch ms of the first keystroke; null until the player starts typing. */
  readonly startedAt: number | null;
  /** Epoch ms when the game reached `won` or `lost`. */
  readonly finishedAt: number | null;
}

/** Whether a board has been solved, lost to the limit, or is still open. */
export type BoardStatus = 'playing' | 'solved' | 'failed';

/** A finished game, as recorded into statistics (FR-111). */
export interface StackRecord {
  readonly id: string;
  readonly playedAt: number;
  readonly mode: StackMode;
  readonly answers: readonly string[];
  readonly guessesUsed: number;
  readonly boardsSolved: number;
  readonly won: boolean;
  /**
   * The fields below were added later, so a row saved before then has none.
   */
  /** Time from the first keystroke to the end, in ms. */
  readonly solveMs?: number;
  /** Per board, in board order: the guess that solved it, or null if it never was. */
  readonly boardSolveGuesses?: readonly (number | null)[];
}
