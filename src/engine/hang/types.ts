import type { WordLength } from '../types';

export type HangStatus = 'playing' | 'won' | 'lost';

/**
 * The complete state of one game. Serialised into LocalStorage for session
 * restore (FR-173), so every field is a plain JSON-safe value.
 *
 * The misses and the revealed letters are not stored. Both follow from the
 * secret and the letters tried, so they can never disagree with them.
 */
export interface HangState {
  /** Stable id; the idempotency key for recording statistics (FR-174). */
  readonly id: string;
  readonly wordLength: WordLength;
  /** The hidden word. Uppercase. */
  readonly secret: string;
  /** Every letter guessed, in order, each once. Uppercase A to Z. */
  readonly tried: string;
  readonly status: HangStatus;
  /** Epoch ms of the first letter; null until the player guesses (FR-22). */
  readonly startedAt: number | null;
  /** Epoch ms when the game reached `won` or `lost`. */
  readonly finishedAt: number | null;
}

/** A finished game, as recorded into statistics (FR-174). */
export interface HangRecord {
  readonly id: string;
  readonly playedAt: number;
  readonly length: WordLength;
  readonly secret: string;
  /** Wrong letters guessed. 6 for a loss, 0 to 5 for a win. */
  readonly misses: number;
  readonly won: boolean;
  /** Time from the first letter to the end, in ms. */
  readonly solveMs: number;
}
