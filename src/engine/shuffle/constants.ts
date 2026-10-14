import { DEFAULT_WORD_LENGTH, WORD_LENGTHS } from '../constants';

/**
 * WordShuffle constants (SPEC §20, ADR-032). Pure data, under the same rules
 * as the rest of the engine (ADR-003, NFR-19).
 */

/** WordShuffle plays the same lengths as Wordwright: 4, 5 and 6 (FR-137). */
export const SHUFFLE_LENGTHS = WORD_LENGTHS;

/** The length a first-time player gets (FR-137). */
export const DEFAULT_SHUFFLE_LENGTH = DEFAULT_WORD_LENGTH;

/** Hints per puzzle (FR-142). There is no guess limit and no timer (FR-137). */
export const MAX_HINTS = 2;
