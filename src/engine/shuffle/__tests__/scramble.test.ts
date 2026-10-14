import { describe, expect, it } from 'vitest';

import { seededRandom, type RandomSource } from '../../random';
import { anagramKey } from '../anagram';
import { createPuzzle, makeScramble, shuffleLetters } from '../scramble';

/** Scrambles, reshuffles and puzzle draws (T-88: FR-138, FR-143, EC-49). */

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

  it('can produce every qualifying order, not just a few', () => {
    const seen = new Set<string>();

    for (let seed = 1; seed <= 400; seed += 1) {
      const result = makeScramble('ABC', () => false, seededRandom(seed));
      if (result.ok) seen.add(result.value);
    }

    expect([...seen].sort()).toEqual(['ACB', 'BAC', 'BCA', 'CAB', 'CBA']);
  });

  it('counts a repeated letter once: ABBA has 6 orders, 5 other than itself', () => {
    const seen = new Set<string>();

    for (let seed = 1; seed <= 400; seed += 1) {
      const result = makeScramble('ABBA', () => false, seededRandom(seed));
      if (result.ok) seen.add(result.value);
    }

    expect([...seen].sort()).toEqual(['AABB', 'BAAB', 'BABA', 'BBAA', 'ABAB'].sort());
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

  it('rotates when the shuffle lands on the same order', () => {
    // Always picking the last index keeps every element in place.
    const keepOrder = fixed(0.999);

    expect(shuffleLetters(['A', 'B', 'C'], keepOrder)).toEqual(['B', 'C', 'A']);
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
    answers: words,
    isWord,
  });

  it('draws a target from the answers with a valid scramble', () => {
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
