/**
 * WordStack constants (SPEC §17, ADR-029). Pure data, under the same rules as
 * the rest of the engine (ADR-003, NFR-19).
 */

/** WordStack plays 5-letter words only (FR-102). */
export const STACK_LENGTH = 5;

/**
 * The two modes (FR-102): Duo has 2 boards and 7 guesses, Quad has 4 boards
 * and 9 guesses.
 */
export const STACK_MODES = {
  duo: { boards: 2, maxGuesses: 7 },
  quad: { boards: 4, maxGuesses: 9 },
} as const;

/** Duo is the default and the mode preference persists (FR-102). */
export const DEFAULT_STACK_MODE = 'duo';

/** Mode ids in display order. */
export const STACK_MODE_IDS = ['duo', 'quad'] as const;
