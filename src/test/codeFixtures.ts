import { vi } from 'vitest';

import type { RawLists } from '@/dictionary';
import { DICTIONARY_REGISTRY } from '@/dictionary/registry';
import type { WordLength } from '@/engine';

/**
 * Small deterministic lists for WordCode component and integration tests, one
 * per length. Never use the real lists in UI tests.
 *
 * With `Math.random` pinned to 0 the secret is the first answer: LAMB at
 * length 4, PLANT at length 5 and PLANET at length 6.
 */
export const CODE_FIXTURE_LISTS: Record<
  WordLength,
  Required<Pick<RawLists, 'answers' | 'guesses'>>
> = {
  4: {
    answers: ['LAMB', 'PLUM'],
    guesses: ['BALM', 'CRAB', 'LAMB', 'LAMP', 'MUSK', 'PLUM', 'SLOT', 'TEND'],
  },
  5: {
    answers: ['PLANT', 'STORM'],
    guesses: ['CRANE', 'FIGHT', 'MUSIC', 'PANEL', 'PLANK', 'PLANT', 'SLATE', 'SLOTH', 'STORM'],
  },
  6: {
    answers: ['PLANET', 'SILVER'],
    guesses: ['PLANET', 'PLANTS', 'SILVER', 'TANGLE', 'WINDOW'],
  },
};

/** A valid guess that is never a secret, so repeating it burns turns. */
export const FILLER_GUESS = 'SLOTH';

/** Puts the fixture lists behind the registry and pins `Math.random` to 0. */
export function useCodeFixtures(): void {
  const registry = DICTIONARY_REGISTRY as Record<WordLength, () => Promise<unknown>>;
  for (const length of [4, 5, 6] as const) {
    vi.spyOn(registry, length).mockResolvedValue(CODE_FIXTURE_LISTS[length]);
  }
  vi.spyOn(Math, 'random').mockReturnValue(0);
}
