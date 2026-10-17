/**
 * WordRange constants (SPEC §18, ADR-030, ADR-037). Pure data, under the same
 * rules as the rest of the engine (ADR-003, NFR-19).
 */

import { WORD_LENGTHS } from '../constants';
import type { WordLength } from '../types';

/** WordRange plays 4, 5 and 6-letter words, the suite's three lengths (FR-115). */
export const RANGE_LENGTHS = WORD_LENGTHS;

/** Default word length for a first-time player (FR-115). */
export const DEFAULT_RANGE_LENGTH: WordLength = 5;

/**
 * Guesses per game, by length (FR-115). The guess lists hold 6,142, 13,746 and
 * 24,637 words, and floor(log2 N) + 1 is 13, 14 and 15, so a player who halves
 * the range every time always finds the word.
 */
export const RANGE_MAX_GUESSES: Readonly<Record<WordLength, number>> = {
  4: 13,
  5: 14,
  6: 15,
};

/** The most guesses any length allows. It sizes the overall distribution. */
export const RANGE_MAX_GUESSES_OVERALL = 15;

/** The lower sentinel: a run of A that is not a word and sorts before every word (FR-116). */
export function lowerSentinel(length: number): string {
  return 'A'.repeat(length);
}

/** The upper sentinel: a run of Z that is not a word and sorts after every word (FR-116). */
export function upperSentinel(length: number): string {
  return 'Z'.repeat(length);
}

/** Heat levels from nearest to furthest. */
export const HEAT_LEVELS = ['burning', 'hot', 'warm', 'cold', 'freezing'] as const;

/**
 * Heat bands by distance in positions in the sorted guess list (FR-120). A
 * distance up to `max` is that heat; anything further is `freezing`. The
 * 5-letter bands are the original ones. The 4 and 6-letter bands scale them by
 * list size over 13,746, so a band covers about the same share of its list.
 * They may be tuned after play-testing, which is a constant change.
 */
export const HEAT_BANDS: Readonly<
  Record<
    WordLength,
    readonly { readonly heat: (typeof HEAT_LEVELS)[number]; readonly max: number }[]
  >
> = {
  4: [
    { heat: 'burning', max: 9 },
    { heat: 'hot', max: 45 },
    { heat: 'warm', max: 223 },
    { heat: 'cold', max: 894 },
  ],
  5: [
    { heat: 'burning', max: 20 },
    { heat: 'hot', max: 100 },
    { heat: 'warm', max: 500 },
    { heat: 'cold', max: 2000 },
  ],
  6: [
    { heat: 'burning', max: 36 },
    { heat: 'hot', max: 179 },
    { heat: 'warm', max: 896 },
    { heat: 'cold', max: 3585 },
  ],
};
