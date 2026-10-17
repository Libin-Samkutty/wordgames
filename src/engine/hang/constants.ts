import { DEFAULT_WORD_LENGTH, WORD_LENGTHS } from '../constants';

/**
 * WordHang constants (SPEC §23, ADR-041). Pure data, under the same rules as
 * the rest of the engine (ADR-003, NFR-19).
 */

/** WordHang plays the same lengths as Wordwright: 4, 5 and 6 (FR-167). */
export const HANG_LENGTHS = WORD_LENGTHS;

/** The length a first-time player gets (FR-167). */
export const DEFAULT_HANG_LENGTH = DEFAULT_WORD_LENGTH;

/**
 * Misses allowed before the game is lost, at every length (FR-167). Each miss
 * adds one part to the figure: head, body, two arms and two legs.
 */
export const MAX_MISSES = 6;
