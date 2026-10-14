import { WORD_LENGTHS, DEFAULT_WORD_LENGTH } from '../constants';

/**
 * WordCode constants (SPEC §19, ADR-031). Pure data, under the same rules as
 * the rest of the engine (ADR-003, NFR-19).
 */

/** WordCode plays the same lengths as Wordwright: 4, 5 and 6 (FR-127). */
export const CODE_LENGTHS = WORD_LENGTHS;

/** The length a first-time player gets (FR-127). */
export const DEFAULT_CODE_LENGTH = DEFAULT_WORD_LENGTH;

/** Guesses per game, at every length (FR-127). */
export const CODE_MAX_GUESSES = 10;

/**
 * The marks a player can give a letter in the notes (FR-132), in the order a
 * press cycles through them. A letter with no entry is unmarked, and a press on
 * the last mark clears it.
 */
export const NOTE_MARKS = ['out', 'in'] as const;
