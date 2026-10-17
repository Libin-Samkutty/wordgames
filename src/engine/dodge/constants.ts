import { DEFAULT_WORD_LENGTH, WORD_LENGTHS } from '../constants';

/**
 * WordDodge constants (SPEC §21, ADR-039). Pure data, under the same rules as
 * the rest of the engine (ADR-003, NFR-19).
 */

/** WordDodge plays the same lengths as Wordwright: 4, 5 and 6 (FR-148). */
export const DODGE_LENGTHS = WORD_LENGTHS;

/** The length a first-time player gets (FR-148). */
export const DEFAULT_DODGE_LENGTH = DEFAULT_WORD_LENGTH;

/**
 * Rows in the guess distribution. There is no guess limit, so wins are grouped:
 * the first row is `DISTRIBUTION_FIRST` guesses or fewer, the last is
 * `DISTRIBUTION_FIRST + DISTRIBUTION_BUCKETS - 1` or more (FR-155).
 */
export const DISTRIBUTION_FIRST = 5;
export const DISTRIBUTION_BUCKETS = 8;

/** The distribution row a win in `guesses` guesses belongs to. */
export function distributionIndex(guesses: number): number {
  return Math.min(Math.max(guesses - DISTRIBUTION_FIRST, 0), DISTRIBUTION_BUCKETS - 1);
}

/** Row labels for the distribution chart: "≤5", "6", ... "12+". */
export function distributionLabels(): readonly string[] {
  return Array.from({ length: DISTRIBUTION_BUCKETS }, (_unused, index) => {
    if (index === 0) return `≤${String(DISTRIBUTION_FIRST)}`;
    const guesses = DISTRIBUTION_FIRST + index;
    return index === DISTRIBUTION_BUCKETS - 1 ? `${String(guesses)}+` : String(guesses);
  });
}

/**
 * The most guesses a saved game may hold. This is a storage guard so a corrupt
 * blob cannot be enormous. It is not a rule of the game, which has no limit.
 */
export const MAX_SAVED_GUESSES = 1000;
