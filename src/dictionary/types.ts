import type { WordLength } from '@/engine/types';

/** The raw shape of a generated `lists-<n>.ts` module. */
export interface RawLists {
  readonly answers: readonly string[];
  readonly guesses: readonly string[];
  /**
   * Common words WordWeaver builds ladders from (FR-75). Present only in the
   * modules for the lengths it plays, 4 and 5. A superset of `answers`, a
   * subset of `guesses`.
   */
  readonly ladder?: readonly string[];
}

/**
 * A loaded, ready-to-use dictionary for one word length.
 *
 * `answers` stays an array because we index into it randomly (FR-3);
 * `guesses` becomes a Set so validation is O(1) per keystroke (FR-17).
 */
export interface Dictionary {
  readonly wordLength: WordLength;
  readonly answers: readonly string[];
  readonly guesses: ReadonlySet<string>;
  /**
   * The guess list as a sorted array, the same array the module exports, not a
   * copy. WordRange measures list distance with it (FR-120) and WordShuffle
   * builds its anagram index from it. Uppercase, unique and sorted, so string
   * order is list order (ARCHITECTURE §8.3, §8.5).
   */
  readonly guessList: readonly string[];
  /** The ladder list, for the lengths that have one (FR-75). */
  readonly ladder?: readonly string[];
}

/** Raised when a dictionary chunk cannot be loaded, so the UI can offer Retry (EC-14). */
export class DictionaryLoadError extends Error {
  readonly wordLength: WordLength;

  constructor(wordLength: WordLength, cause?: unknown) {
    super(`Failed to load the ${wordLength}-letter word list`);
    this.name = 'DictionaryLoadError';
    this.wordLength = wordLength;
    if (cause !== undefined) this.cause = cause;
  }
}
