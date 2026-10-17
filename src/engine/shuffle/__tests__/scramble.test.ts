import { describe, expect, it } from 'vitest';

import { seededRandom, type RandomSource } from '../../random';
import { anagramKey } from '../anagram';
import { createPuzzle, makeScramble, shuffleLetters } from '../scramble';

/** Scrambles, reshuffles and puzzle draws (T-88: FR-138, FR-143, EC-49, ADR-038). */

/** How many letters of `order` are where `word` has the same letter. */
const inPlace = (order: string, word: string): number =>
  [...order].filter((letter, index) => letter === word[index]).length;

const fixed = (...values: number[]): RandomSource => {
  let index = 0;
  return {
    next: () => {
      const value = values[Math.min(index, values.length - 1)] as number;
      index += 1;
      return value;
    },
  };
};

describe('makeScramble (FR-138, EC-49)', () => {
  it('uses the same letters in a different order that is not a word', () => {
    const isWord = (word: string): boolean => word === 'SILENT';

    for (let seed = 1; seed <= 200; seed += 1) {
      const result = makeScramble('LISTEN', isWord, seededRandom(seed));

      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.value).not.toBe('LISTEN');
      expect(result.value).not.toBe('SILENT');
      expect(anagramKey(result.value)).toBe(anagramKey('LISTEN'));
    }
  });

  it('can produce every order that leaves no letter in place, not just one', () => {
    const seen = new Set<string>();

    for (let seed = 1; seed <= 400; seed += 1) {
      const result = makeScramble('ABC', () => false, seededRandom(seed));
      if (result.ok) seen.add(result.value);
    }

    // ACB, BAC and CBA each keep one letter where the target has it.
    expect([...seen].sort()).toEqual(['BCA', 'CAB']);
  });

  it('leaves no letter in the target\u2019s place whenever that is possible (ADR-038)', () => {
    for (const target of ['LISTEN', 'PLANT', 'COAT', 'TRAIN', 'ANCHOR', 'STORM']) {
      for (let seed = 1; seed <= 100; seed += 1) {
        const result = makeScramble(target, () => false, seededRandom(seed));

        expect(result.ok).toBe(true);
        if (result.ok) expect(inPlace(result.value, target)).toBe(0);
      }
    }
  });

  it('uses the fewest it can when repeated letters force one into place', () => {
    // AAB has no order with every letter moved: ABA and BAA each keep one.
    const seen = new Set<string>();

    for (let seed = 1; seed <= 200; seed += 1) {
      const result = makeScramble('AAB', () => false, seededRandom(seed));
      if (result.ok) {
        seen.add(result.value);
        expect(inPlace(result.value, 'AAB')).toBe(1);
      }
    }

    expect([...seen].sort()).toEqual(['ABA', 'BAA']);
  });

  it('drops the orders that are words before it counts letters in place', () => {
    // BCA and CAB would leave none in place, but they are words, so one of the rest is used.
    const isWord = (word: string): boolean => word === 'BCA' || word === 'CAB';

    for (let seed = 1; seed <= 100; seed += 1) {
      const result = makeScramble('ABC', isWord, seededRandom(seed));

      expect(result.ok).toBe(true);
      if (result.ok) expect(['ACB', 'BAC', 'CBA']).toContain(result.value);
    }
  });

  it('counts a repeated letter once: ABBA has 6 orders, and only BAAB moves every letter', () => {
    const seen = new Set<string>();

    for (let seed = 1; seed <= 400; seed += 1) {
      const result = makeScramble('ABBA', () => false, seededRandom(seed));
      if (result.ok) seen.add(result.value);
    }

    expect([...seen]).toEqual(['BAAB']);
  });

  it('returns no-scramble when every other order is a word (EC-49)', () => {
    expect(makeScramble('ABC', () => true, fixed(0))).toEqual({ ok: false, error: 'no-scramble' });
  });

  it('returns no-scramble for a word with only one order, such as AAAA', () => {
    expect(makeScramble('AAAA', () => false, fixed(0))).toEqual({
      ok: false,
      error: 'no-scramble',
    });
  });

  it('is deterministic for a seeded source', () => {
    const a = makeScramble('PLANET', () => false, seededRandom(7));
    const b = makeScramble('PLANET', () => false, seededRandom(7));

    expect(a).toEqual(b);
  });

  it('survives a faulty source that returns exactly 1', () => {
    const result = makeScramble('ABC', () => false, fixed(1));

    expect(result.ok).toBe(true);
  });
});

describe('shuffleLetters (FR-143)', () => {
  it('keeps the multiset of letters', () => {
    const tray = ['E', 'E', 'L', 'S', 'T'];

    for (let seed = 1; seed <= 100; seed += 1) {
      const shuffled = shuffleLetters(tray, seededRandom(seed));

      expect([...shuffled].sort()).toEqual([...tray].sort());
    }
  });

  it('does not change its input', () => {
    const tray = ['A', 'B', 'C'];

    shuffleLetters(tray, seededRandom(3));

    expect(tray).toEqual(['A', 'B', 'C']);
  });

  it('always visibly changes the order when the letters are not all alike', () => {
    const tray = ['A', 'B', 'C', 'D'];

    for (let seed = 1; seed <= 300; seed += 1) {
      expect(shuffleLetters(tray, seededRandom(seed))).not.toEqual(tray);
    }
  });

  it('can produce every other order when there is nothing to avoid', () => {
    const seen = new Set<string>();

    for (let seed = 1; seed <= 400; seed += 1) {
      seen.add(shuffleLetters(['A', 'B', 'C'], seededRandom(seed)).join(''));
    }

    expect([...seen].sort()).toEqual(['ACB', 'BAC', 'BCA', 'CAB', 'CBA']);
  });

  describe('with avoid (ADR-038)', () => {
    const none = (): boolean => false;

    it('leaves no letter where the target has it, whenever that is possible', () => {
      const avoid = { reference: ['A', 'B', 'C'], isWord: none };

      for (let seed = 1; seed <= 200; seed += 1) {
        const tray = shuffleLetters(['A', 'B', 'C'], seededRandom(seed), avoid).join('');

        expect(['BCA', 'CAB']).toContain(tray);
      }
    });

    it('skips an order that is a word', () => {
      const avoid = {
        reference: ['A', 'B', 'C'],
        isWord: (w: string) => w === 'BCA' || w === 'CAB',
      };

      for (let seed = 1; seed <= 200; seed += 1) {
        const tray = shuffleLetters(['A', 'B', 'C'], seededRandom(seed), avoid).join('');

        expect(['ACB', 'BAC', 'CBA']).toContain(tray);
      }
    });

    it('still changes the order when every other order is a word', () => {
      const avoid = { reference: ['A', 'B', 'C'], isWord: () => true };

      for (let seed = 1; seed <= 50; seed += 1) {
        const tray = shuffleLetters(['A', 'B', 'C'], seededRandom(seed), avoid);

        expect(tray).not.toEqual(['A', 'B', 'C']);
        expect([...tray].sort()).toEqual(['A', 'B', 'C']);
      }
    });

    it('works on a tray with letters taken out, against the letters still to place', () => {
      // After a hint locks the first letter, the tray holds the rest of the target.
      const avoid = { reference: ['T', 'A', 'R'], isWord: none };

      for (let seed = 1; seed <= 100; seed += 1) {
        const tray = shuffleLetters(['T', 'A', 'R'], seededRandom(seed), avoid);

        expect(tray.filter((letter, index) => letter === avoid.reference[index])).toEqual([]);
      }
    });

    it('swaps a two-letter tray, the only other order', () => {
      expect(
        shuffleLetters(['C', 'D'], fixed(0.5), { reference: ['C', 'D'], isWord: none }),
      ).toEqual(['D', 'C']);
    });
  });

  it('returns the same letters when they are all alike, or there is only one', () => {
    expect(shuffleLetters(['E', 'E', 'E'], fixed(0.5))).toEqual(['E', 'E', 'E']);
    expect(shuffleLetters(['E'], fixed(0.5))).toEqual(['E']);
    expect(shuffleLetters([], fixed(0.5))).toEqual([]);
  });

  it('survives a faulty source that returns exactly 1', () => {
    expect(shuffleLetters(['A', 'B', 'C'], fixed(1)).sort()).toEqual(['A', 'B', 'C']);
  });
});

describe('createPuzzle (FR-138)', () => {
  const lists = (words: string[], isWord: (word: string) => boolean) => ({
    targets: words,
    isWord,
  });

  it('draws a target from the pool with a valid scramble', () => {
    const result = createPuzzle(
      lists(['PLANT', 'STORM'], () => false),
      [],
      seededRandom(1),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(['PLANT', 'STORM']).toContain(result.value.target);
    expect(result.value.scramble).not.toBe(result.value.target);
    expect(anagramKey(result.value.scramble)).toBe(anagramKey(result.value.target));
  });

  it('avoids a recent target', () => {
    const words = Array.from({ length: 8 }, (_, i) => `WORD${String(i)}`);

    for (let seed = 1; seed <= 50; seed += 1) {
      const result = createPuzzle(
        lists(words, () => false),
        ['WORD0', 'WORD1'],
        seededRandom(seed),
      );

      expect(result.ok).toBe(true);
      if (result.ok) expect(['WORD0', 'WORD1']).not.toContain(result.value.target);
    }
  });

  it('draws another target when no scramble exists for the first (EC-49)', () => {
    // Every order of ABC is a word, so only XYZ can be a target.
    const isWord = (word: string): boolean => anagramKey(word) === 'ABC';

    for (let seed = 1; seed <= 50; seed += 1) {
      const result = createPuzzle(lists(['ABC', 'XYZ'], isWord), [], seededRandom(seed));

      expect(result).toMatchObject({ ok: true });
      if (result.ok) expect(result.value.target).toBe('XYZ');
    }
  });

  it('returns no-puzzle only when every answer fails', () => {
    expect(
      createPuzzle(
        lists(['ABC', 'BCA'], () => true),
        [],
        seededRandom(1),
      ),
    ).toEqual({
      ok: false,
      error: 'no-puzzle',
    });
    expect(
      createPuzzle(
        lists([], () => false),
        [],
        seededRandom(1),
      ),
    ).toEqual({
      ok: false,
      error: 'no-puzzle',
    });
  });
});
