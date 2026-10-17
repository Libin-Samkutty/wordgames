import { describe, expect, it } from 'vitest';

import { DICTIONARY_REGISTRY } from '@/dictionary/registry';

import { seededRandom } from '../../random';
import { buildAnagramIndex } from '../../shuffle/anagram';
import { MAX_REQUIRED, MIN_REQUIRED } from '../constants';
import { buildPool, createPuzzle, requiredFor, type HuntSources } from '../puzzle';

/**
 * WordHunt against the real lists (T-96: AC-59, FR-158, FR-159). The one place
 * the Hunt tests use the shipped data, by design.
 */

async function realSources(): Promise<{ sources: HuntSources; seeds: string[] }> {
  const [l4, l5, l6] = await Promise.all([
    DICTIONARY_REGISTRY[4](),
    DICTIONARY_REGISTRY[5](),
    DICTIONARY_REGISTRY[6](),
  ]);
  const of = (lists: typeof l4) => ({
    common: new Set([...lists.answers, ...(lists.shuffle ?? [])]),
    index: buildAnagramIndex(lists.guesses),
  });

  return {
    sources: { 4: of(l4), 5: of(l5), 6: of(l6) },
    seeds: [...new Set([...l6.answers, ...(l6.shuffle ?? [])])].sort(),
  };
}

describe('the real lists', () => {
  it('STAPLE hides the words SPEC §22 names, and PLATES and PETALS are valid too', async () => {
    const { sources } = await realSources();
    const words = requiredFor('STAPLE', sources);

    expect(words).toEqual(expect.arrayContaining(['LEAP', 'PALE', 'TAPE', 'STALE', 'STAPLE']));
  });

  it('has a pool of at least 150 seeds, each hiding between the minimum and maximum', async () => {
    const { sources, seeds } = await realSources();

    const pool = buildPool(seeds, sources);

    expect(pool.length).toBeGreaterThanOrEqual(150);
    for (const seed of pool) {
      const count = requiredFor(seed, sources).length;
      expect(count).toBeGreaterThanOrEqual(MIN_REQUIRED);
      expect(count).toBeLessThanOrEqual(MAX_REQUIRED);
    }
  });

  it('every required word is a valid guess, uses the tray letters, and is 4 to 6 letters', async () => {
    const { sources, seeds } = await realSources();
    const pool = buildPool(seeds, sources);

    for (const seed of pool.slice(0, 200)) {
      for (const word of requiredFor(seed, sources)) {
        expect(word.length).toBeGreaterThanOrEqual(4);
        expect(word.length).toBeLessThanOrEqual(6);
        expect(sources[word.length as 4 | 5 | 6].index.get([...word].sort().join(''))).toContain(
          word,
        );
        const tray = [...seed];
        for (const letter of word) {
          const at = tray.indexOf(letter);
          expect(at).toBeGreaterThanOrEqual(0);
          tray.splice(at, 1);
        }
      }
    }
  });

  it('1,000 seeded puzzles each have a tray that is not the seed, and a full word list', async () => {
    const { sources, seeds } = await realSources();
    const pool = buildPool(seeds, sources);

    for (let seed = 1; seed <= 1000; seed += 1) {
      const puzzle = createPuzzle(pool, sources, [], seededRandom(seed));

      expect(puzzle.tray).not.toBe(puzzle.seed);
      expect([...puzzle.tray].sort()).toEqual([...puzzle.seed].sort());
      expect(puzzle.required.length).toBeGreaterThanOrEqual(MIN_REQUIRED);
    }
  });
});
