import { vi } from 'vitest';

import type { RawLists } from '@/dictionary';
import { DICTIONARY_REGISTRY } from '@/dictionary/registry';
import type { WordLength } from '@/engine';

/**
 * Small deterministic lists for WordShuffle component and integration tests,
 * one per length. Never use the real lists in UI tests.
 *
 * With `Math.random` pinned to 0 the target is the first answer and the
 * scramble is the first qualifying ordering of its letters in alphabetical
 * order among those that leave no letter in the target's place (ADR-038):
 * LAMB → ABLM, PLANT → ANLTP, LISTEN → ELINST.
 */
export const SHUFFLE_FIXTURE_LISTS: Record<
  WordLength,
  Required<Pick<RawLists, 'answers' | 'guesses'>>
> = {
  4: {
    answers: ['LAMB', 'PLUM'],
    guesses: ['BALM', 'LAMB', 'MUSK', 'PLUM', 'SLOT'],
  },
  5: {
    answers: ['PLANT', 'STORM'],
    guesses: ['CRANE', 'MUSIC', 'PLANT', 'SLATE', 'STORM'],
  },
  6: {
    answers: ['LISTEN', 'GARDEN'],
    guesses: ['DANGER', 'ENLIST', 'GANDER', 'GARDEN', 'INLETS', 'LISTEN', 'SILENT', 'TINSEL'],
  },
};

/** The scramble each length starts with under the pinned random source. */
export const FIRST_SCRAMBLE: Record<WordLength, string> = {
  4: 'ABLM',
  5: 'ANLTP',
  6: 'ELINST',
};

/** Puts the fixture lists behind the registry and pins `Math.random` to 0. */
export function useShuffleFixtures(): void {
  const registry = DICTIONARY_REGISTRY as Record<WordLength, () => Promise<unknown>>;
  for (const length of [4, 5, 6] as const) {
    vi.spyOn(registry, length).mockResolvedValue(SHUFFLE_FIXTURE_LISTS[length]);
  }
  vi.spyOn(Math, 'random').mockReturnValue(0);
}
