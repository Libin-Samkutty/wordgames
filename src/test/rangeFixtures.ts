import { vi } from 'vitest';

import type { RawLists } from '@/dictionary';
import { DICTIONARY_REGISTRY } from '@/dictionary/registry';
import type { WordLength } from '@/engine';

/**
 * Small deterministic lists for WordRange component and integration tests, with
 * 4 and 6-letter ones beside the 5-letter default. Never use the real lists in UI tests (the engine's own real-list test
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
 * The 4 and 6-letter lists. With `Math.random` pinned to 0 the secret is the
 * first answer, PLAN and PLANET.
 */
export const RANGE_FIXTURE_LISTS_4: Required<Pick<RawLists, 'answers' | 'guesses'>> = {
  answers: ['PLAN', 'STEM'],
  guesses: ['ABLE', 'BRAT', 'CLAY', 'FLAT', 'JUMP', 'PLAN', 'PLUM', 'SLOT', 'STEM', 'TRIM'],
};

export const RANGE_FIXTURE_LISTS_6: Required<Pick<RawLists, 'answers' | 'guesses'>> = {
  answers: ['PLANET', 'SILVER'],
  guesses: [
    'ABROAD',
    'BRIDGE',
    'CASTLE',
    'FLIGHT',
    'JUNGLE',
    'PLANET',
    'SILVER',
    'TANGLE',
    'WINDOW',
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

/** Puts the fixture lists behind the registry and pins `Math.random` to 0. */
export function useRangeFixtures(): void {
  const registry = DICTIONARY_REGISTRY as Record<WordLength, () => Promise<unknown>>;
  vi.spyOn(registry, 4).mockResolvedValue(RANGE_FIXTURE_LISTS_4);
  vi.spyOn(registry, 5).mockResolvedValue(RANGE_FIXTURE_LISTS);
  vi.spyOn(registry, 6).mockResolvedValue(RANGE_FIXTURE_LISTS_6);
  vi.spyOn(Math, 'random').mockReturnValue(0);
}
