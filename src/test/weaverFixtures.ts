import { vi } from 'vitest';

import { DICTIONARY_REGISTRY } from '@/dictionary/registry';
import type { RawLists } from '@/dictionary';
import type { WordLength } from '@/engine';

/**
 * Small deterministic lists for WordWeaver component and integration tests.
 * Never use the real lists in UI tests: they are large, slow, and a
 * regenerated list would break unrelated assertions.
 *
 * 4 letters. COLD → WARM has par 4 by three equally short paths, and with the
 * answers [COLD, WARM] the Give up ladder is the alphabetical one:
 *   COLD, CORD, CARD, WARD, WARM
 *
 * 5 letters. A single chain: CRANE, CRATE, GRATE, GRAPE, GRAPH (par 4).
 */
export const WEAVER_FIXTURE_LISTS: Record<
  4 | 5,
  Required<Pick<RawLists, 'answers' | 'ladder' | 'guesses'>>
> = {
  4: {
    answers: ['COLD', 'WARM'],
    ladder: ['BOLD', 'CARD', 'COLD', 'CORD', 'WARD', 'WARM', 'WORD', 'WORM'],
    // CARE and CORE are real but outside the ladder list; CARE is two letters from CORD.
    guesses: ['BOLD', 'CARD', 'CARE', 'COLD', 'CORD', 'CORE', 'WARD', 'WARM', 'WORD', 'WORM'],
  },
  5: {
    answers: ['CRANE', 'GRAPH'],
    ladder: ['CRANE', 'CRATE', 'GRAPE', 'GRAPH', 'GRATE'],
    guesses: ['CRANE', 'CRATE', 'GRAPE', 'GRAPH', 'GRATE', 'SLOTH', 'STAMP'],
  },
};

/**
 * Puts the fixture lists behind the registry for both WordWeaver lengths, and
 * pins `Math.random` to 0 so generation is deterministic: the first start is
 * the first answer, COLD or CRANE. Call `vi.restoreAllMocks()` afterwards.
 */
export function useWeaverFixtures(): void {
  const registry = DICTIONARY_REGISTRY as Record<WordLength, () => Promise<unknown>>;
  for (const length of [4, 5] as const) {
    vi.spyOn(registry, length).mockResolvedValue(WEAVER_FIXTURE_LISTS[length]);
  }
  vi.spyOn(Math, 'random').mockReturnValue(0);
}
