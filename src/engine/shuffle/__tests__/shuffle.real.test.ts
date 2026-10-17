import { describe, expect, it } from 'vitest';

import { DICTIONARY_REGISTRY } from '@/dictionary/registry';

import { seededRandom } from '../../random';
import type { WordLength } from '../../types';
import { anagramKey, anagramsOf, buildAnagramIndex } from '../anagram';
import { createPuzzle, makeScramble } from '../scramble';

/**
 * WordShuffle against the real lists (T-88: AC-53, FR-138, EC-49). The one
 * place the shuffle tests use the shipped data, by design.
 */

describe('the real lists', () => {
  it('LISTEN has the six anagrams SPEC §20 names, and SILENT is one of them (AC-53)', async () => {
    const lists = await DICTIONARY_REGISTRY[6]();
    const index = buildAnagramIndex(lists.guesses);

    expect(anagramsOf(index, 'LISTEN')).toEqual(
      expect.arrayContaining(['ELINTS', 'ENLIST', 'INLETS', 'LISTEN', 'SILENT', 'TINSEL']),
    );
  });

  it.each([4, 5, 6] as const)(
    '1,000 seeded puzzles at length %i have a scramble that differs from the target and is not a word',
    async (length: WordLength) => {
      const lists = await DICTIONARY_REGISTRY[length]();
      const guesses = new Set(lists.guesses);
      const pool = new Set(lists.shuffle);

      for (let seed = 1; seed <= 1000; seed += 1) {
        const puzzle = createPuzzle(
          { targets: lists.shuffle ?? [], isWord: (word) => guesses.has(word) },
          [],
          seededRandom(seed),
        );

        expect(puzzle.ok).toBe(true);
        if (!puzzle.ok) return;
        const { target, scramble } = puzzle.value;
        expect(pool.has(target)).toBe(true);
        expect(scramble).not.toBe(target);
        expect(guesses.has(scramble)).toBe(false);
        expect(anagramKey(scramble)).toBe(anagramKey(target));
      }
    },
  );

  it.each([4, 5, 6] as const)(
    'every target at length %i has a valid scramble, so EC-49 never has to redraw',
    async (length: WordLength) => {
      const lists = await DICTIONARY_REGISTRY[length]();
      const guesses = new Set(lists.guesses);

      for (const target of lists.shuffle ?? []) {
        expect(makeScramble(target, (word) => guesses.has(word), seededRandom(1)).ok).toBe(true);
      }
    },
  );

  it.each([4, 5, 6] as const)(
    'a scramble at length %i leaves no letter in the target\u2019s place, bar the few words that cannot (ADR-038)',
    async (length: WordLength) => {
      const lists = await DICTIONARY_REGISTRY[length]();
      const guesses = new Set(lists.guesses);
      const inPlace = (order: string, word: string): number =>
        [...order].filter((letter, index) => letter === word[index]).length;

      let somePlace = 0;
      for (const target of lists.shuffle ?? []) {
        const result = makeScramble(target, (word) => guesses.has(word), seededRandom(3));
        if (result.ok && inPlace(result.value, target) > 0) somePlace += 1;
      }

      // Only words whose repeated letters force one into place, or whose every
      // moved order is a word, can keep a letter. That is a small share of the pool.
      expect(somePlace / (lists.shuffle?.length ?? 1)).toBeLessThan(0.05);
    },
  );
});
