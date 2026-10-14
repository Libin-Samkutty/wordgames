import { HEAT_BANDS } from './constants';
import type { Heat } from './types';

/**
 * The position of `word` in a sorted list, by binary search, or -1 when it is
 * absent. The lists are uppercase and sorted, so string order is list order.
 */
export function listIndex(sorted: readonly string[], word: string): number {
  let low = 0;
  let high = sorted.length - 1;

  while (low <= high) {
    const middle = (low + high) >> 1;
    const candidate = sorted[middle] as string;

    if (candidate === word) return middle;
    if (candidate < word) low = middle + 1;
    else high = middle - 1;
  }

  return -1;
}

/**
 * How many positions apart two words are in the sorted guess list (FR-120).
 * Returns null when either word is not in the list, which only happens for a
 * word the list does not hold, such as a sentinel.
 */
export function listDistance(sorted: readonly string[], a: string, b: string): number | null {
  const first = listIndex(sorted, a);
  const second = listIndex(sorted, b);
  if (first === -1 || second === -1) return null;

  return Math.abs(first - second);
}

/**
 * The heat for a distance in list positions (FR-120): Burning up to 20, Hot up
 * to 100, Warm up to 500, Cold up to 2,000, and Freezing beyond that. Heat is
 * monotonic with distance, so a guess inside the range is never colder than
 * the bound on its side of the secret (ADR-030).
 */
export function heatOf(distance: number): Heat {
  for (const band of HEAT_BANDS) {
    if (distance <= band.max) return band.heat;
  }
  return 'freezing';
}
