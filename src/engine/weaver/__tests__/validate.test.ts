import { describe, expect, it } from 'vitest';

import { differsByOneLetter, validateRung, type RungContext } from '../validate';
import { GUESSABLE } from './fixtures';

/**
 * Rung validation, in the FR-80 order (T-61: FR-79, FR-80, FR-82, EC-29,
 * AC-31, AC-32). One test per rule.
 */

function context(overrides: Partial<RungContext> = {}): RungContext {
  return {
    length: 4,
    previous: 'CORD',
    used: ['COLD', 'CORD'],
    isAllowed: (word) => GUESSABLE.has(word),
    ...overrides,
  };
}

describe('differsByOneLetter (FR-80)', () => {
  it.each([
    ['COLD', 'CORD', true],
    ['BOOK', 'BOOT', true],
    ['CRANE', 'CRATE', true],
    ['COLD', 'COLD', false],
    ['COLD', 'CARD', false],
    ['BOOK', 'BOKO', false],
    ['COLD', 'WARM', false],
  ])('%s vs %s is %s', (a, b, expected) => {
    expect(differsByOneLetter(a, b)).toBe(expected);
  });
});

describe('validateRung (FR-80 order)', () => {
  it('accepts a real word one letter from the word above and returns it uppercase', () => {
    expect(validateRung('card', context())).toEqual({ ok: true, value: 'CARD' });
  });

  it('1. rejects fewer letters than the word length with too-short', () => {
    expect(validateRung('CAR', context())).toEqual({ ok: false, error: 'too-short' });
    expect(validateRung('', context())).toEqual({ ok: false, error: 'too-short' });
  });

  it('1. rejects more letters than the word length with too-short, as Wordwright does', () => {
    expect(validateRung('CARDS', context())).toEqual({ ok: false, error: 'too-short' });
  });

  it('2. rejects a word that is not in the guess list with not-a-word', () => {
    expect(validateRung('CZRD', context())).toEqual({ ok: false, error: 'not-a-word' });
  });

  it('3. rejects a real word that changes two letters with not-one-letter (AC-31)', () => {
    // CARE after CORD changes two letters (O→A, D→E).
    expect(validateRung('CARE', context())).toEqual({ ok: false, error: 'not-one-letter' });
  });

  it('3. rejects the same word as the one above, which changes no letter', () => {
    expect(validateRung('CORD', context())).toEqual({ ok: false, error: 'not-one-letter' });
  });

  it('3. compares position by position, so BOOK → BOKO is two letters, not one', () => {
    const above = context({ previous: 'BOOK', used: ['BOOK'] });

    expect(validateRung('BOOT', above)).toEqual({ ok: true, value: 'BOOT' });
    expect(validateRung('BOKO', above)).toEqual({ ok: false, error: 'not-one-letter' });
  });

  it('4. rejects the start word with already-used (EC-29, AC-32)', () => {
    // COLD is the start: one letter from CORD, but already in the ladder.
    expect(validateRung('COLD', context())).toEqual({ ok: false, error: 'already-used' });
  });

  it('4. rejects an earlier rung with already-used', () => {
    const deep = context({ previous: 'CARD', used: ['COLD', 'CORD', 'CARD'] });

    expect(validateRung('CORD', deep)).toEqual({ ok: false, error: 'already-used' });
  });

  it('allows a word that was undone, because it is no longer in the ladder', () => {
    // CARD was undone, so `used` no longer holds it.
    expect(validateRung('CARD', context({ used: ['COLD', 'CORD'] }))).toEqual({
      ok: true,
      value: 'CARD',
    });
  });

  it('checks length before the dictionary: a short unknown word is too-short', () => {
    expect(validateRung('ZZ', context())).toEqual({ ok: false, error: 'too-short' });
  });

  it('checks the dictionary before the one-letter rule: an unknown two-letter change is not-a-word', () => {
    expect(validateRung('ZZZZ', context())).toEqual({ ok: false, error: 'not-a-word' });
  });

  it('checks the one-letter rule before already-used: the word above is not-one-letter', () => {
    // CORD is both the word above and in `used`; rule 3 reports first.
    expect(validateRung('CORD', context())).toEqual({ ok: false, error: 'not-one-letter' });
  });

  it('lets the end word in from a neighbour (FR-82)', () => {
    const nearEnd = context({ previous: 'WARD', used: ['COLD', 'CORD', 'CARD', 'WARD'] });

    expect(validateRung('WARM', nearEnd)).toEqual({ ok: true, value: 'WARM' });
  });

  it('does not let the end word in from anywhere else (FR-82)', () => {
    expect(validateRung('WARM', context())).toEqual({ ok: false, error: 'not-one-letter' });
  });

  it('accepts a guess-list word that is outside the ladder list, so under par is possible (FR-76)', () => {
    // CORE is guessable but not a ladder word.
    expect(validateRung('CORE', context())).toEqual({ ok: true, value: 'CORE' });
  });

  it('trims surrounding whitespace like Wordwright', () => {
    expect(validateRung(' card ', context())).toEqual({ ok: true, value: 'CARD' });
  });

  it('works for 5-letter words', () => {
    const five = context({
      length: 5,
      previous: 'CRANE',
      used: ['CRANE'],
      isAllowed: (word) => word === 'CRATE',
    });

    expect(validateRung('crate', five)).toEqual({ ok: true, value: 'CRATE' });
    expect(validateRung('CARD', five)).toEqual({ ok: false, error: 'too-short' });
  });
});
