import type { HEAT_LEVELS } from './constants';

/** How near a guess is to the secret, in words (FR-120). */
export type Heat = (typeof HEAT_LEVELS)[number];

/** Why a submitted guess was rejected, in FR-117 order. */
export type RangeError = 'too-short' | 'not-a-word' | 'already-guessed' | 'outside-range';

/** Where the secret lies relative to a guess that was not the secret (FR-118). */
export type RangeDirection = 'before' | 'after';

export type RangeStatus = 'playing' | 'won' | 'lost';

/** An accepted guess. */
export interface RangeGuess {
  /** Uppercase, 5 letters. */
  readonly word: string;
  /** `after`: the secret comes later. `before`: it comes earlier. Null for the secret itself. */
  readonly direction: RangeDirection | null;
  /** Null for the secret itself. */
  readonly heat: Heat | null;
}

/**
 * The complete state of one game. Serialised into LocalStorage for session
 * restore (FR-125), so every field is a plain JSON-safe value.
 */
export interface RangeState {
  /** Stable id; the idempotency key for recording statistics (FR-124). */
  readonly id: string;
  readonly secret: string;
  /** In play order. The view sorts them alphabetically. */
  readonly guesses: readonly RangeGuess[];
  /** The secret comes after this word. Starts at the lower sentinel. */
  readonly lower: string;
  /** The secret comes before this word. Starts at the upper sentinel. */
  readonly upper: string;
  /** Letters typed into the input row but not yet submitted. */
  readonly currentInput: string;
  readonly status: RangeStatus;
  /** Epoch ms of the first keystroke; null until the player starts typing. */
  readonly startedAt: number | null;
  /** Epoch ms when the game reached `won` or `lost`. */
  readonly finishedAt: number | null;
}

/** A finished game, as recorded into statistics (FR-124). */
export interface RangeRecord {
  readonly id: string;
  readonly playedAt: number;
  readonly secret: string;
  readonly guessesUsed: number;
  readonly won: boolean;
}
