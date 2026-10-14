import { describe, expect, it } from 'vitest';

import { DICTIONARY_REGISTRY } from '@/dictionary/registry';

import { LOWER_SENTINEL, UPPER_SENTINEL } from '../constants';
import { heatOf, listDistance } from '../heat';
import { createRangeGame, rangeReducer } from '../reducer';
import { validateRangeGuess } from '../validate';

/**
 * WordRange against the real 5-letter list (T-80: AC-49, FR-115, FR-120). The
 * one place the range tests use the shipped data, by design.
 */

const HEAT_ORDER = ['burning', 'hot', 'warm', 'cold', 'freezing'];

describe('the real 5-letter list', async () => {
  const lists = await DICTIONARY_REGISTRY[5]();
  const sorted = lists.guesses;
  const guesses = new Set(sorted);

  it('has the 13,746 words ADR-030 sizes the 14-guess limit against', () => {
    expect(sorted).toHaveLength(13_746);
    expect(Math.log2(sorted.length)).toBeLessThan(14);
  });

  it('brackets every word between the sentinels, which are not words', () => {
    expect(guesses.has(LOWER_SENTINEL)).toBe(false);
    expect(guesses.has(UPPER_SENTINEL)).toBe(false);
    expect((sorted[0] as string) > LOWER_SENTINEL).toBe(true);
    expect((sorted[sorted.length - 1] as string) < UPPER_SENTINEL).toBe(true);
  });

  it('AC-49: with secret PLANT, BRAVE is "after" with range BRAVE to ZZZZZ and Freezing, PLAIN is Burning', () => {
    let state = createRangeGame('g', 'PLANT');

    const brave = listDistance(sorted, 'BRAVE', 'PLANT') as number;
    state = rangeReducer(state, { type: 'SUBMIT_GUESS', word: 'BRAVE', distance: brave, now: 1 });
    expect(state.guesses[0]?.direction).toBe('after');
    expect([state.lower, state.upper]).toEqual(['BRAVE', 'ZZZZZ']);
    expect(state.guesses[0]?.heat).toBe('freezing');

    const plain = listDistance(sorted, 'PLAIN', 'PLANT') as number;
    state = rangeReducer(state, { type: 'SUBMIT_GUESS', word: 'PLAIN', distance: plain, now: 2 });
    expect(state.guesses[1]?.heat).toBe('burning');
  });

  it('AC-50: with range BRAVE to STORM, ABOUT is outside the range and uses no guess', () => {
    const result = validateRangeGuess('ABOUT', {
      lower: 'BRAVE',
      upper: 'STORM',
      guessed: ['BRAVE', 'STORM'],
      isAllowed: (word) => guesses.has(word),
    });

    expect(result).toEqual({ ok: false, error: 'outside-range' });
  });

  it('a perfect halving finds any answer within 14 guesses, the premise of FR-115', () => {
    for (const secret of lists.answers.slice(0, 50)) {
      let low = -1;
      let high = sorted.length;
      let used = 0;

      for (;;) {
        const middle = (low + high) >> 1;
        used += 1;
        if (sorted[middle] === secret) break;
        if ((sorted[middle] as string) < secret) low = middle;
        else high = middle;
      }
      expect(used).toBeLessThanOrEqual(14);
    }
  });

  it('heat agrees with the range: a guess inside it is never colder than the bound on its side (ADR-030)', () => {
    const secret = 'PLANT';
    const farther = listDistance(sorted, 'BRAVE', secret) as number;
    const nearer = listDistance(sorted, 'MANGO', secret) as number;

    expect(guesses.has('MANGO')).toBe(true);
    expect(nearer).toBeLessThan(farther);
    expect(HEAT_ORDER.indexOf(heatOf(nearer))).toBeLessThanOrEqual(
      HEAT_ORDER.indexOf(heatOf(farther)),
    );
  });
});
