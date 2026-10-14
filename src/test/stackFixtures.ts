import { vi } from 'vitest';

import type { RawLists } from '@/dictionary';
import { DICTIONARY_REGISTRY } from '@/dictionary/registry';
import type { WordLength } from '@/engine';

/**
 * Small deterministic 5-letter lists for WordStack component and integration
 * tests. Never use the real lists in UI tests.
 *
 * With `Math.random` pinned to 0 the answers are drawn in order, so a Duo game
 * is PLANT and STORM and a Quad game adds CRANE and MOUND.
 */
export const STACK_FIXTURE_LISTS: Required<Pick<RawLists, 'answers' | 'guesses'>> = {
  answers: ['PLANT', 'STORM', 'CRANE', 'MOUND'],
  guesses: [
    'ADIEU',
    'BLAZE',
    'CRANE',
    'FIGHT',
    'JUMPY',
    'MOUND',
    'PANEL',
    'PLANT',
    'SLOTH',
    'STORM',
    'TRUCK',
    'WHELP',
  ],
};

/** Words that are valid guesses but are no board's answer, for burning turns. */
export const FILLER_GUESSES = [
  'SLOTH',
  'BLAZE',
  'TRUCK',
  'FIGHT',
  'JUMPY',
  'WHELP',
  'ADIEU',
  'PANEL',
  'SLOTH',
];

/** Puts the fixture list behind the registry and pins `Math.random` to 0. */
export function useStackFixtures(): void {
  const registry = DICTIONARY_REGISTRY as Record<WordLength, () => Promise<unknown>>;
  vi.spyOn(registry, 5).mockResolvedValue(STACK_FIXTURE_LISTS);
  vi.spyOn(Math, 'random').mockReturnValue(0);
}
