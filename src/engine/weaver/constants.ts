import type { WeaverLength } from './types';

/**
 * WordWeaver constants (SPEC §15). Pure data, under the same rules as the rest
 * of the engine (ADR-003, NFR-16).
 */

/** Supported WordWeaver lengths (FR-74). A subset of the Wordwright lengths. */
export const WEAVER_LENGTHS = [4, 5] as const;

/** Default length for a first-time player (FR-74). */
export const DEFAULT_WEAVER_LENGTH: WeaverLength = 4;

/**
 * The par range a generated puzzle must fall in (FR-77).
 *
 * Fixed by the T-58 measurement (SPEC §15.1). Repeat that measurement when the
 * word lists are regenerated.
 */
export const PAR_BAND: Readonly<
  Record<WeaverLength, { readonly min: number; readonly max: number }>
> = {
  4: { min: 4, max: 6 },
  5: { min: 4, max: 7 },
};

/** Starts used in the last this-many puzzles of a length are skipped (FR-78). */
export const RECENT_START_WINDOW = 20;

/** Start words tried before the generator gives up on the par band (FR-78). */
export const MAX_START_ATTEMPTS = 20;

/** The fallback accepts any reachable answer at least this far away (FR-78). */
export const FALLBACK_MIN_PAR = 3;

/** Safety cap on accepted rung submissions; Give up still works (FR-85, EC-34). */
export const MAX_MOVES = 500;

/** Buckets in the over-par chart: par, one over, two over, three over, four or more. */
export const OVER_PAR_BUCKETS = 5;

/** The over-par chart bucket for a solve: at par or under is the first, four or more the last. */
export function overParBucketIndex(overPar: number): number {
  return Math.min(Math.max(overPar, 0), OVER_PAR_BUCKETS - 1);
}
