import { describe, expect, it } from 'vitest';

import { DICTIONARY_REGISTRY } from '@/dictionary/registry';

import type { WordLength } from '../../types';
import { chooseReply, isAllCorrect } from '../adversary';
import { candidatePool } from '../pool';

/**
 * WordDodge against the real lists (T-92: AC-58, FR-148, FR-149). The one place
 * the Dodge tests use the shipped data, by design.
 */

/** How many words the first guess sorts into one reply, at most, when guessing `guess`. */
function worstGroup(guess: string, candidates: readonly string[]): number {
  return chooseReply(guess, candidates).candidates.length;
}

/**
 * A sensible player: from the words still possible, guess the one that leaves
 * the fewest words in the worst case. Only the first few are tried, to keep the
 * test quick.
 */
function guessesToWin(answers: readonly string[]): number {
  let candidates = answers;
  let guesses = 0;

  while (guesses < 50) {
    guesses += 1;
    const tried = candidates.slice(0, 40);
    let best = tried[0] as string;
    let bestSize = Infinity;
    for (const word of tried) {
      const size = worstGroup(word, candidates);
      if (size < bestSize) {
        best = word;
        bestSize = size;
      }
    }

    const reply = chooseReply(best, candidates);
    if (isAllCorrect(reply.evaluation)) return guesses;
    candidates = reply.candidates;
  }
  return guesses;
}

describe('the real lists', () => {
  it.each([4, 5, 6] as const)(
    'at length %i the pool is the answers and the shuffle list, and every word in it is a valid guess',
    async (length: WordLength) => {
      const lists = await DICTIONARY_REGISTRY[length]();
      const guesses = new Set(lists.guesses);
      const pool = candidatePool(lists.answers, lists.shuffle);

      expect(pool.length).toBe({ 4: 1412, 5: 1844, 6: 1751 }[length]);
      expect(pool.length).toBeGreaterThan(2 * lists.answers.length);
      expect(pool.every((word) => guesses.has(word))).toBe(true);
      expect(pool).toEqual([...pool].sort());
    },
  );

  it.each([4, 5, 6] as const)(
    'at length %i a player who guesses well wins within 12 guesses',
    async (length: WordLength) => {
      const lists = await DICTIONARY_REGISTRY[length]();

      const guesses = guessesToWin(candidatePool(lists.answers, lists.shuffle));

      expect(guesses).toBeGreaterThan(1);
      expect(guesses).toBeLessThanOrEqual(12);
    },
    30_000,
  );

  it.each([4, 5, 6] as const)(
    'at length %i the first guess leaves fewer words than there were',
    async (length: WordLength) => {
      const lists = await DICTIONARY_REGISTRY[length]();
      const pool = candidatePool(lists.answers, lists.shuffle);
      const first = pool[0] as string;

      const reply = chooseReply(first, pool);

      expect(reply.candidates.length).toBeLessThan(pool.length);
      expect(reply.candidates.length).toBeGreaterThan(0);
    },
  );
});
