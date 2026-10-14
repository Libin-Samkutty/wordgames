import { describe, expect, it } from 'vitest';

import { evaluateGuess } from '../../evaluate';
import { scoreCode } from '../score';

/** Bulls and cows (T-84: FR-129, EC-44, AC-51). */

describe('scoreCode', () => {
  it('PANEL against PLANT is 1 bull and 3 cows (AC-51)', () => {
    expect(scoreCode('PANEL', 'PLANT')).toEqual({ bulls: 1, cows: 3 });
  });

  it('EEEEE against SPEED is 2 bulls and 0 cows (AC-51, EC-44)', () => {
    expect(scoreCode('EEEEE', 'SPEED')).toEqual({ bulls: 2, cows: 0 });
  });

  it('an exact match is every letter a bull', () => {
    expect(scoreCode('CRANE', 'CRANE')).toEqual({ bulls: 5, cows: 0 });
    expect(scoreCode('MAMA', 'MAMA')).toEqual({ bulls: 4, cows: 0 });
  });

  it('a guess sharing no letters is 0 and 0', () => {
    expect(scoreCode('SLOTH', 'CRANE')).toEqual({ bulls: 0, cows: 0 });
  });

  it('an anagram has no bulls only when every letter is displaced', () => {
    expect(scoreCode('TRAIN', 'INTRA')).toEqual({ bulls: 0, cows: 5 });
  });

  // Every row of the SPEC §6.3 truth table. Bulls are its G count and cows its Y count.
  const TABLE: ReadonlyArray<readonly [secret: string, guess: string, pattern: string]> = [
    ['CRANE', 'CRANE', 'GGGGG'],
    ['CRANE', 'SLOTH', '.....'],
    ['ABBEY', 'BABES', 'YYGG.'],
    ['ALLOY', 'LULLS', 'Y.G..'],
    ['SPEED', 'ERASE', 'Y..YY'],
    ['SPEED', 'EEEEE', '..GG.'],
    ['GEESE', 'EEEEE', '.GG.G'],
    ['BOOKS', 'OOZES', 'YG..G'],
    ['LOLLY', 'LILLY', 'G.GGG'],
    ['MAMA', 'AMMA', 'YYGG'],
    ['LABEL', 'LEVEL', 'G..GG'],
  ];

  it.each(TABLE)(
    'secret %s + guess %s counts the same as its %s evaluation (EC-44)',
    (secret, guess, pattern) => {
      const bulls = [...pattern].filter((char) => char === 'G').length;
      const cows = [...pattern].filter((char) => char === 'Y').length;

      expect(scoreCode(guess, secret)).toEqual({ bulls, cows });
    },
  );

  it('always equals the correct and present totals of evaluateGuess, for every row', () => {
    for (const [secret, guess] of TABLE) {
      const states = evaluateGuess(guess, secret);

      expect(scoreCode(guess, secret)).toEqual({
        bulls: states.filter((state) => state === 'correct').length,
        cows: states.filter((state) => state === 'present').length,
      });
    }
  });

  it('never counts a letter twice: bulls plus cows is at most the letters shared', () => {
    const { bulls, cows } = scoreCode('EEEEE', 'GEESE');

    expect(bulls + cows).toBeLessThanOrEqual(3);
  });

  it('is symmetric in total (bulls + cows) between guess and secret', () => {
    const a = scoreCode('PANEL', 'PLANT');
    const b = scoreCode('PLANT', 'PANEL');

    expect(a.bulls + a.cows).toBe(b.bulls + b.cows);
    expect(a.bulls).toBe(b.bulls);
  });
});
