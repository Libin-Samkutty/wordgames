import { describe, expect, it } from 'vitest';

import { validateRangeGuess, type RangeContext } from '../validate';

/**
 * Guess validation in the FR-117 order (T-80: FR-117, EC-42, EC-43, AC-50). One
 * test per rule.
 */

const WORDS = new Set(['ABOUT', 'BRAVE', 'CRANE', 'PLAIN', 'PLANT', 'STORM', 'WORLD']);

function context(over: Partial<RangeContext> = {}): RangeContext {
  return {
    lower: 'AAAAA',
    upper: 'ZZZZZ',
    guessed: [],
    isAllowed: (word) => WORDS.has(word),
    ...over,
  };
}

describe('validateRangeGuess (FR-117)', () => {
  it('accepts a real word strictly inside the range, uppercase', () => {
    expect(validateRangeGuess('plant', context())).toEqual({ ok: true, value: 'PLANT' });
  });

  it('1. rejects fewer than 5 letters with too-short', () => {
    expect(validateRangeGuess('PLAN', context())).toEqual({ ok: false, error: 'too-short' });
    expect(validateRangeGuess('', context())).toEqual({ ok: false, error: 'too-short' });
  });

  it('2. rejects a word not in the guess list with not-a-word', () => {
    expect(validateRangeGuess('ZZXXZ', context())).toEqual({ ok: false, error: 'not-a-word' });
  });

  it('2. rejects a sentinel, which is not a word', () => {
    expect(validateRangeGuess('AAAAA', context())).toEqual({ ok: false, error: 'not-a-word' });
    expect(validateRangeGuess('ZZZZZ', context())).toEqual({ ok: false, error: 'not-a-word' });
  });

  it('3. rejects a repeat with already-guessed (EC-43)', () => {
    expect(validateRangeGuess('PLANT', context({ guessed: ['PLANT'] }))).toEqual({
      ok: false,
      error: 'already-guessed',
    });
  });

  it('4. rejects a word before the lower bound with outside-range (AC-50, EC-42)', () => {
    const range = context({ lower: 'BRAVE', upper: 'STORM', guessed: ['BRAVE', 'STORM'] });

    expect(validateRangeGuess('ABOUT', range)).toEqual({ ok: false, error: 'outside-range' });
  });

  it('4. rejects a word after the upper bound with outside-range', () => {
    const range = context({ lower: 'BRAVE', upper: 'STORM', guessed: ['BRAVE', 'STORM'] });

    expect(validateRangeGuess('WORLD', range)).toEqual({ ok: false, error: 'outside-range' });
  });

  it('accepts a word between the bounds', () => {
    const range = context({ lower: 'BRAVE', upper: 'STORM', guessed: ['BRAVE', 'STORM'] });

    expect(validateRangeGuess('PLANT', range)).toEqual({ ok: true, value: 'PLANT' });
  });

  it('a guess equal to a bound is a repeat, so it stops at already-guessed (EC-42)', () => {
    const range = context({ lower: 'BRAVE', upper: 'STORM', guessed: ['BRAVE', 'STORM'] });

    expect(validateRangeGuess('BRAVE', range)).toEqual({ ok: false, error: 'already-guessed' });
    expect(validateRangeGuess('STORM', range)).toEqual({ ok: false, error: 'already-guessed' });
  });

  it('reports rules in order: a short word that is also outside the range is too-short', () => {
    expect(validateRangeGuess('AB', context({ lower: 'BRAVE' }))).toEqual({
      ok: false,
      error: 'too-short',
    });
  });

  it('reports a repeat before the range check: a repeated, outside word is already-guessed', () => {
    const range = context({ lower: 'BRAVE', guessed: ['ABOUT'] });

    expect(validateRangeGuess('ABOUT', range)).toEqual({ ok: false, error: 'already-guessed' });
  });

  it('reports the dictionary before the repeat check', () => {
    expect(validateRangeGuess('ZZXXZ', context({ guessed: ['ZZXXZ'] }))).toEqual({
      ok: false,
      error: 'not-a-word',
    });
  });

  it('treats the bounds as exclusive on both sides', () => {
    const range = context({ lower: 'CRANE', upper: 'PLANT' });

    // A word equal to a bound that somehow was not recorded as guessed is still outside.
    expect(validateRangeGuess('CRANE', range)).toEqual({ ok: false, error: 'outside-range' });
    expect(validateRangeGuess('PLANT', range)).toEqual({ ok: false, error: 'outside-range' });
    expect(validateRangeGuess('PLAIN', range)).toEqual({ ok: true, value: 'PLAIN' });
  });
});
