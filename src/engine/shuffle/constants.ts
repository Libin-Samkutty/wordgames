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

/**
 * Upper limits, in ms, of the solve-time buckets in the statistics chart: under 10 seconds,
 * under 30, under 1 minute, under 2 minutes, and anything longer.
 */
export const TIME_BUCKET_LIMITS_MS = [10_000, 30_000, 60_000, 120_000] as const;

/** Buckets in the solve-time chart: one per limit, plus the open-ended last one. */
export const TIME_BUCKET_COUNT = TIME_BUCKET_LIMITS_MS.length + 1;

/** The solve-time bucket a duration falls in. */
export function timeBucketIndex(ms: number): number {
  const index = TIME_BUCKET_LIMITS_MS.findIndex((limit) => ms < limit);
  return index === -1 ? TIME_BUCKET_LIMITS_MS.length : index;
}
