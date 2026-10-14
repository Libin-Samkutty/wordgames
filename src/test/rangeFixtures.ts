import { vi } from 'vitest';

import type { RawLists } from '@/dictionary';
import { DICTIONARY_REGISTRY } from '@/dictionary/registry';
import type { WordLength } from '@/engine';

/**
 * Small deterministic 5-letter lists for WordRange component and integration
 * tests. Never use the real lists in UI tests (the engine's own real-list test
 * is the one exception).
 *
 * With `Math.random` pinned to 0 the secret is the first answer, PLANT. The
 * list is tiny, so every distance is inside the Burning band: the other heat
 * levels are tested at component level.
 */
export const RANGE_FIXTURE_LISTS: Required<Pick<RawLists, 'answers' | 'guesses'>> = {
  answers: ['PLANT', 'STORM', 'CRANE'],
  guesses: [
    'ABOUT',
    'ADIEU',
    'BLAZE',
    'BRAVE',
    'CRANE',
    'FIGHT',
    'JUMPY',
    'MOUND',
    'PANEL',
    'PLAIN',
    'PLANT',
    'SLOTH',
    'STORM',
    'TRUCK',
    'WHELP',
  ],
};

/**
 * Fourteen valid guesses that are not PLANT, in an order that keeps each one
 * inside the range left by the one before: the words before PLANT ascending,
 * then the words after it descending. Playing all of them loses.
 */
export const LOSING_GUESSES = [
  'ABOUT',
  'ADIEU',
  'BLAZE',
  'BRAVE',
  'CRANE',
  'FIGHT',
  'JUMPY',
  'MOUND',
  'PANEL',
  'PLAIN',
  'WHELP',
  'TRUCK',
  'STORM',
  'SLOTH',
];

/** Puts the fixture list behind the registry and pins `Math.random` to 0. */
export function useRangeFixtures(): void {
  const registry = DICTIONARY_REGISTRY as Record<WordLength, () => Promise<unknown>>;
  vi.spyOn(registry, 5).mockResolvedValue(RANGE_FIXTURE_LISTS);
  vi.spyOn(Math, 'random').mockReturnValue(0);
}
