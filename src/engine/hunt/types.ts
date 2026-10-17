export type HuntStatus = 'playing' | 'won' | 'gave-up';

/** Why a submitted word was rejected, in the order they are checked (FR-161). */
export type WordError = 'too-short' | 'not-from-tray' | 'already-found' | 'not-a-word';

/**
 * The complete state of one puzzle. Serialised into LocalStorage for session
 * restore (FR-164), so every field is a plain JSON-safe value. The required
 * words are part of it, so a saved puzzle never depends on the word lists
 * staying the same.
 */
export interface HuntState {
  /** Stable id; the idempotency key for recording statistics (FR-165). */
  readonly id: string;
  /** The word the tray was made from. */
  readonly seed: string;
  /** The six letters, in the order they are shown. */
  readonly tray: string;
  /** The common words hiding in the tray, by length then alphabet (FR-159). */
  readonly required: readonly string[];
  /** The required words found so far, in the order they were found. */
  readonly found: readonly string[];
  /** Other valid words found: real words that are not in the required list (FR-162). */
  readonly bonus: readonly string[];
  /** Letters typed into the word row but not yet submitted. */
  readonly currentInput: string;
  readonly status: HuntStatus;
  /** Epoch ms of the first letter; null until the player starts typing. */
  readonly startedAt: number | null;
  /** Epoch ms when the puzzle reached `won` or `gave-up`. */
  readonly finishedAt: number | null;
}

/** One slot on the board: a required word and whether it has been found (FR-160). */
export interface Slot {
  readonly word: string;
  readonly found: boolean;
}

/** The slots for one word length. */
export interface SlotGroup {
  readonly length: number;
  readonly slots: readonly Slot[];
}

/** A finished puzzle, as recorded into statistics (FR-165). */
export interface HuntRecord {
  readonly id: string;
  readonly playedAt: number;
  readonly seed: string;
  readonly requiredCount: number;
  readonly foundCount: number;
  readonly bonusCount: number;
  /** True when every required word was found. */
  readonly completed: boolean;
  /** Time from the first letter to the end, in ms. */
  readonly solveMs: number;
}
