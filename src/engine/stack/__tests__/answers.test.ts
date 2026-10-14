import { describe, expect, it } from 'vitest';

import { seededRandom } from '../../random';
import { pickAnswers } from '../answers';

/** WordStack answer drawing (T-75: FR-103, EC-41). */

const POOL = Array.from(
  { length: 60 },
  (_unused, i) => `WORD${String.fromCharCode(65 + (i % 26))}${String(i)}`,
);

describe('pickAnswers', () => {
  it('draws one answer per board', () => {
    expect(pickAnswers(POOL, [], 2, seededRandom(1))).toHaveLength(2);
    expect(pickAnswers(POOL, [], 4, seededRandom(1))).toHaveLength(4);
  });

  it('draws only words from the pool', () => {
    for (const word of pickAnswers(POOL, [], 4, seededRandom(2))) expect(POOL).toContain(word);
  });

  it('never repeats an answer within a game, over 1,000 seeded draws (EC-41)', () => {
    for (let seed = 0; seed < 1000; seed += 1) {
      const count = seed % 2 === 0 ? 2 : 4;
      const drawn = pickAnswers(POOL, [], count, seededRandom(seed));

      expect(new Set(drawn).size).toBe(count);
    }
  });

  it('never repeats even when the pool is only as big as the board count', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const drawn = pickAnswers(['AAAAA', 'BBBBB', 'CCCCC', 'DDDDD'], [], 4, seededRandom(seed));

      expect([...drawn].sort()).toEqual(['AAAAA', 'BBBBB', 'CCCCC', 'DDDDD']);
    }
  });

  it('avoids recent answers while it can (FR-103, FR-4)', () => {
    // 60 words: the window is min(50, floor(n / 4)), 14 or 15 as boards are drawn,
    // so a buffer of 12 is always fully inside it.
    const recent = POOL.slice(0, 12);

    for (let seed = 0; seed < 200; seed += 1) {
      for (const word of pickAnswers(POOL, recent, 4, seededRandom(seed))) {
        expect(recent).not.toContain(word);
      }
    }
  });

  it('is deterministic for a given seed (ADR-009)', () => {
    expect(pickAnswers(POOL, [], 4, seededRandom(7))).toEqual(
      pickAnswers(POOL, [], 4, seededRandom(7)),
    );
  });

  it('gives different draws for different seeds', () => {
    const draws = new Set(
      Array.from({ length: 20 }, (_unused, seed) =>
        pickAnswers(POOL, [], 2, seededRandom(seed)).join(),
      ),
    );

    expect(draws.size).toBeGreaterThan(1);
  });

  it('throws when the pool cannot supply that many different answers', () => {
    expect(() => pickAnswers(['AAAAA', 'BBBBB'], [], 4, seededRandom(1))).toThrow(
      /Cannot draw 4 different answers from 2/,
    );
  });
});
