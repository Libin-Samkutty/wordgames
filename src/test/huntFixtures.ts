import { vi } from 'vitest';

import type { RawLists } from '@/dictionary';
import { DICTIONARY_REGISTRY } from '@/dictionary/registry';
import type { WordLength } from '@/engine';

/**
 * Small deterministic lists for WordHunt component and integration tests, one
 * per length. Never use the real lists in UI tests.
 *
 * One 6-letter word, STAPLE, is the only seed. It hides twelve common words:
 * eight of 4 letters, three of 5 and STAPLE itself. Other real words made from
 * its letters, such as PEAL, are valid but not common, so they are bonus words.
 */
export const HUNT_FIXTURE_LISTS: Record<
  WordLength,
  Required<Pick<RawLists, 'answers' | 'guesses'>>
> = {
  4: {
    answers: ['LATE', 'LEAP', 'PALE', 'PAST', 'SALE', 'SEAL', 'TALE', 'TAPE'],
    guesses: [
      'LATE',
      'LEAP',
      'PALE',
      'PAST',
      'PEAL',
      'PEAT',
      'PLEA',
      'SALE',
      'SEAL',
      'SLAP',
      'TALE',
      'TAPE',
      'TEAL',
    ],
  },
  5: {
    answers: ['LEAST', 'PLATE', 'STALE'],
    guesses: ['LEAPS', 'LEAST', 'PALES', 'PASTE', 'PLATE', 'SPELT', 'STALE'],
  },
  6: {
    answers: ['STAPLE'],
    guesses: ['PASTEL', 'PETALS', 'PLATES', 'STAPLE'],
  },
};

/** The twelve words a player must find, as the board orders them. */
export const HUNT_REQUIRED = [
  'LATE',
  'LEAP',
  'PALE',
  'PAST',
  'SALE',
  'SEAL',
  'TALE',
  'TAPE',
  'LEAST',
  'PLATE',
  'STALE',
  'STAPLE',
] as const;

/** Valid words made from STAPLE's letters that are not required. */
export const HUNT_BONUS = ['PEAL', 'PLEA', 'PEAT'] as const;

/** Puts the fixture lists behind the registry and pins `Math.random` to 0. */
export function useHuntFixtures(): void {
  const registry = DICTIONARY_REGISTRY as Record<WordLength, () => Promise<unknown>>;
  for (const length of [4, 5, 6] as const) {
    vi.spyOn(registry, length).mockResolvedValue(HUNT_FIXTURE_LISTS[length]);
  }
  vi.spyOn(Math, 'random').mockReturnValue(0);
}
