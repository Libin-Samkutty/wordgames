/**
 * WordRange constants (SPEC §18, ADR-030). Pure data, under the same rules as
 * the rest of the engine (ADR-003, NFR-19).
 */

/** WordRange plays 5-letter words only (FR-115). */
export const RANGE_LENGTH = 5;

/**
 * Guesses per game (FR-115). The 5-letter guess list has 13,746 words and
 * log2(13,746) is about 13.7, so a player who halves the range every time
 * always finds the word.
 */
export const RANGE_MAX_GUESSES = 14;

/** The range starts between two sentinels that are not words (FR-116). */
export const LOWER_SENTINEL = 'AAAAA';
export const UPPER_SENTINEL = 'ZZZZZ';

/**
 * Heat bands by distance in positions in the sorted 5-letter guess list
 * (FR-120). A distance up to `max` is that heat; anything further is
 * `freezing`. They may be tuned after play-testing, which is a constant change.
 */
export const HEAT_BANDS = [
  { heat: 'burning', max: 20 },
  { heat: 'hot', max: 100 },
  { heat: 'warm', max: 500 },
  { heat: 'cold', max: 2000 },
] as const;

/** Heat levels from nearest to furthest. */
export const HEAT_LEVELS = ['burning', 'hot', 'warm', 'cold', 'freezing'] as const;
