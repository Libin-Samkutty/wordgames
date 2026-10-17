import { vi } from 'vitest';

import type { RawLists } from '@/dictionary';
import { DICTIONARY_REGISTRY } from '@/dictionary/registry';
import type { WordLength } from '@/engine';

/**
 * Small deterministic lists for WordDodge component and integration tests, one
 * per length. Never use the real lists in UI tests.
 *
 * The game draws no secret, so nothing needs pinning. At length 5, PLANK keeps
 * PLANT, PLANE and PLANS (four green, K grey). PLANT then keeps PLANE and
 * PLANS, PLANE keeps PLANS, and PLANS wins on the fourth guess. At length 4,
 * LAMB leaves only PLUM, and at length 6, PLANET leaves only SILVER.
 */
export const DODGE_FIXTURE_LISTS: Record<
  WordLength,
  Required<Pick<RawLists, 'answers' | 'guesses'>>
> = {
  4: {
    answers: ['LAMB', 'PLUM'],
    guesses: ['BALM', 'CRAB', 'LAMB', 'LAMP', 'MUSK', 'PLUM', 'SLOT', 'TEND'],
  },
  5: {
    answers: ['MUSIC', 'PLANE', 'PLANS', 'PLANT', 'STORM'],
    guesses: [
      'CRANE',
      'FIGHT',
      'MUSIC',
      'PANEL',
      'PLANE',
      'PLANK',
      'PLANS',
      'PLANT',
      'SLATE',
      'SLOTH',
      'STORM',
    ],
  },
  6: {
    answers: ['PLANET', 'SILVER'],
    guesses: ['PLANET', 'PLANTS', 'SILVER', 'TANGLE', 'WINDOW'],
  },
};

/** The four guesses that win at length 5, in order. */
export const WINNING_FIVE = ['PLANK', 'PLANT', 'PLANE', 'PLANS'] as const;

/** Puts the fixture lists behind the registry. */
export function useDodgeFixtures(): void {
  const registry = DICTIONARY_REGISTRY as Record<WordLength, () => Promise<unknown>>;
  for (const length of [4, 5, 6] as const) {
    vi.spyOn(registry, length).mockResolvedValue(DODGE_FIXTURE_LISTS[length]);
  }
}

/**
 * Gives the 5-letter fixture list a shuffle list, which the game adds to its
 * candidates (ADR-042). Call after `useDodgeFixtures`.
 */
export function useDodgeShuffle(words: readonly string[]): void {
  const registry = DICTIONARY_REGISTRY as Record<WordLength, () => Promise<unknown>>;
  vi.spyOn(registry, 5).mockResolvedValue({ ...DODGE_FIXTURE_LISTS[5], shuffle: words });
}
