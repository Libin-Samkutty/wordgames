import { describe, expect, it } from 'vitest';

import { seededRandom } from '../../random';
import { buildAnagramIndex } from '../../shuffle/anagram';
import { MAX_REQUIRED, MIN_REQUIRED } from '../constants';
import {
  buildPool,
  createPuzzle,
  requiredFor,
  subsetKeys,
  type HuntSources,
  type LengthSource,
} from '../puzzle';

/** Finding the words in a tray and drawing a puzzle (T-96: FR-158, FR-159). */

function source(words: readonly string[], common: readonly string[]): LengthSource {
  return { common: new Set(common), index: buildAnagramIndex(words) };
}

/** A small world: every word is valid, and the common ones are the first of each length. */
const FOUR = ['ALES', 'ELAS', 'LEAP', 'PALE', 'PEAL', 'PLEA', 'SALE', 'SEAL', 'TAPE', 'LAST'];
const FIVE = ['LEAPS', 'PALES', 'PEALS', 'PLEAS', 'SALEP', 'STALE', 'LEAST', 'TALES'];
const SIX = ['STAPLE', 'PLATES', 'PASTEL', 'PETALS', 'PALEST'];
const SOURCES: HuntSources = {
  4: source(FOUR, ['LEAP', 'PALE', 'SALE', 'SEAL', 'TAPE']),
  5: source(FIVE, ['LEAPS', 'STALE', 'LEAST']),
  6: source(SIX, ['STAPLE', 'PLATES']),
};

describe('subsetKeys', () => {
  it('lists each distinct way to pick letters, as sorted keys', () => {
    expect(subsetKeys('ABC', 2).sort()).toEqual(['AB', 'AC', 'BC']);
    expect(subsetKeys('ABC', 3)).toEqual(['ABC']);
  });

  it('counts repeated letters once', () => {
    // Picking two of A, A, B gives AA or AB, not three ways.
    expect(subsetKeys('AAB', 2).sort()).toEqual(['AA', 'AB']);
  });

  it('gives 15, 6 and 1 keys for six different letters at sizes 4, 5 and 6', () => {
    expect(subsetKeys('STAPLE', 4)).toHaveLength(15);
    expect(subsetKeys('STAPLE', 5)).toHaveLength(6);
    expect(subsetKeys('STAPLE', 6)).toHaveLength(1);
  });
});

describe('requiredFor', () => {
  it('finds the common words of each length, shortest first and alphabetical', () => {
    expect(requiredFor('STAPLE', SOURCES)).toEqual([
      'LEAP',
      'PALE',
      'SALE',
      'SEAL',
      'TAPE',
      'LEAPS',
      'LEAST',
      'STALE',
      'PLATES',
      'STAPLE',
    ]);
  });

  it('leaves out words that are valid but not common', () => {
    const words = requiredFor('STAPLE', SOURCES);

    expect(words).not.toContain('PEAL');
    expect(words).not.toContain('PASTEL');
  });

  it('never uses a letter more often than the tray has it', () => {
    // LAST needs one S, one T, one L, one A. A tray with one of each is fine.
    expect(requiredFor('LASTEP', SOURCES)).toContain('LEAP');
    // A tray with no P cannot make LEAP.
    expect(requiredFor('LASTEE', SOURCES)).not.toContain('LEAP');
  });

  it('lists a word once even when several keys could reach it', () => {
    const words = requiredFor('STAPLE', SOURCES);

    expect(new Set(words).size).toBe(words.length);
  });
});

/** Every 4-letter word from distinct letters of ABCDEF: 360 of them, all hiding in the seed ABCDEF. */
const PERMS4: string[] = [];
for (const a of 'ABCDEF')
  for (const b of 'ABCDEF')
    for (const c of 'ABCDEF')
      for (const d of 'ABCDEF') if (new Set([a, b, c, d]).size === 4) PERMS4.push(a + b + c + d);

/** Sources in which the seed ABCDEF hides exactly `count` common words. */
function sourcesWith(count: number): HuntSources {
  const words = PERMS4.slice(0, count);
  return { 4: source(words, words), 5: source([], []), 6: source([], []) };
}

describe('buildPool', () => {
  it('drops a seed with one word fewer than the minimum, and keeps the minimum', () => {
    expect(buildPool(['ABCDEF'], sourcesWith(MIN_REQUIRED - 1))).toEqual([]);
    expect(buildPool(['ABCDEF'], sourcesWith(MIN_REQUIRED))).toEqual(['ABCDEF']);
  });

  it('keeps a seed at the maximum, and drops one with a word more', () => {
    expect(buildPool(['ABCDEF'], sourcesWith(MAX_REQUIRED))).toEqual(['ABCDEF']);
    expect(buildPool(['ABCDEF'], sourcesWith(MAX_REQUIRED + 1))).toEqual([]);
  });

  it('keeps the order of the seeds it was given, and handles none', () => {
    const sources = sourcesWith(10);

    expect(buildPool(['FEDCBA', 'ABCDEF', 'BCDEFA'], sources)).toEqual([
      'FEDCBA',
      'ABCDEF',
      'BCDEFA',
    ]);
    expect(buildPool([], sources)).toEqual([]);
  });
});

describe('createPuzzle', () => {
  const POOL = ['STAPLE', 'PLATES'];

  it('draws a seed from the pool, scrambles it to another order, and lists its words', () => {
    const puzzle = createPuzzle(POOL, SOURCES, [], seededRandom(7));

    expect(POOL).toContain(puzzle.seed);
    expect(puzzle.tray).not.toBe(puzzle.seed);
    expect([...puzzle.tray].sort()).toEqual([...puzzle.seed].sort());
    expect(puzzle.required).toEqual(requiredFor(puzzle.seed, SOURCES));
  });

  it('is the same for the same random source', () => {
    expect(createPuzzle(POOL, SOURCES, [], seededRandom(3))).toEqual(
      createPuzzle(POOL, SOURCES, [], seededRandom(3)),
    );
  });

  it('keeps away from recent seeds when the pool is large enough', () => {
    const big = Array.from(
      { length: 40 },
      (_unused, index) => `SEED${String(index).padStart(2, '0')}`,
    );
    for (let seed = 1; seed <= 50; seed += 1) {
      const puzzle = createPuzzle(big, SOURCES, big.slice(0, 10), seededRandom(seed));

      expect(big.slice(0, 10)).not.toContain(puzzle.seed);
    }
  });

  it('throws when the pool is empty', () => {
    expect(() => createPuzzle([], SOURCES, [], seededRandom(1))).toThrow();
  });
});
