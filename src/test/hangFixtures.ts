import { vi } from 'vitest';

import type { RawLists } from '@/dictionary';
import { DICTIONARY_REGISTRY } from '@/dictionary/registry';
import type { WordLength } from '@/engine';

/**
 * Small deterministic lists for WordHang component and integration tests, one
 * per length. Never use the real lists in UI tests.
 *
 * With `Math.random` pinned to 0 the secret is the first answer: LAMB at length
 * 4, PLANT at length 5 and PLANET at length 6. APPLE is the second 5-letter
 * answer, for a test that needs a repeated letter.
 */
export const HANG_FIXTURE_LISTS: Record<
  WordLength,
  Required<Pick<RawLists, 'answers' | 'guesses'>>
> = {
  4: {
    answers: ['LAMB', 'PLUM'],
    guesses: ['LAMB', 'PLUM'],
  },
  5: {
    answers: ['PLANT', 'APPLE'],
    guesses: ['APPLE', 'PLANT'],
  },
  6: {
    answers: ['PLANET', 'SILVER'],
    guesses: ['PLANET', 'SILVER'],
  },
};

/** Six letters that are in none of PLANT, LAMB or PLANET, so each is a miss. */
export const MISS_LETTERS = 'QZXJKV';

/** Puts the fixture lists behind the registry and pins `Math.random` to 0. */
export function useHangFixtures(): void {
  const registry = DICTIONARY_REGISTRY as Record<WordLength, () => Promise<unknown>>;
  for (const length of [4, 5, 6] as const) {
    vi.spyOn(registry, length).mockResolvedValue(HANG_FIXTURE_LISTS[length]);
  }
  vi.spyOn(Math, 'random').mockReturnValue(0);
}
