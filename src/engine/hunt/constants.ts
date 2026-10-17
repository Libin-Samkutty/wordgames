/**
 * WordHunt constants (SPEC §22, ADR-040). Pure data, under the same rules as
 * the rest of the engine (ADR-003, NFR-19).
 */

/** Letters in every puzzle's tray (FR-158). */
export const TRAY_SIZE = 6;

/** The shortest word that counts. The word lists hold nothing shorter (FR-158). */
export const MIN_WORD_LENGTH = 4;

/** The word lengths a puzzle can hold: 4, 5 and 6. */
export const HUNT_WORD_LENGTHS = [4, 5, 6] as const;

/**
 * How many common words a tray must hide to be a puzzle (FR-159). Fewer would
 * be over too soon. More would be a chore, and the largest trays hide over 30.
 */
export const MIN_REQUIRED = 8;
export const MAX_REQUIRED = 20;

/**
 * The most words a saved game may hold in each list. This is a storage guard so
 * a corrupt blob cannot be enormous. It is not a rule of the game.
 */
export const MAX_SAVED_WORDS = 400;
