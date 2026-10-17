import { describe, expect, it } from 'vitest';

import { DICTIONARY_REGISTRY } from '@/dictionary/registry';

import { RANGE_LENGTHS, RANGE_MAX_GUESSES, lowerSentinel, upperSentinel } from '../constants';
import { heatOf, listDistance } from '../heat';
import { createRangeGame, rangeReducer } from '../reducer';
import { validateRangeGuess } from '../validate';

/**
 * WordRange against the real lists (T-80: AC-49, FR-115, FR-120; ADR-037). The
 * one place the range tests use the shipped data, by design.
 */

const HEAT_ORDER = ['burning', 'hot', 'warm', 'cold', 'freezing'];

/** The sizes ADR-030 and ADR-037 size the guess limits against. */
const LIST_SIZE = { 4: 6142, 5: 13_746, 6: 24_637 } as const;

describe.each(RANGE_LENGTHS)('the real %i-letter list', async (length) => {
  const lists = await DICTIONARY_REGISTRY[length]();
  const sorted = lists.guesses;
  const guesses = new Set(sorted);

  it('has the words the guess limit is sized against', () => {
    expect(sorted).toHaveLength(LIST_SIZE[length]);
    expect(Math.log2(sorted.length)).toBeLessThan(RANGE_MAX_GUESSES[length]);
  });

  it('brackets every word between the sentinels, which are not words', () => {
    expect(guesses.has(lowerSentinel(length))).toBe(false);
    expect(guesses.has(upperSentinel(length))).toBe(false);
    expect((sorted[0] as string) > lowerSentinel(length)).toBe(true);
    expect((sorted[sorted.length - 1] as string) < upperSentinel(length)).toBe(true);
  });

  it('a perfect halving finds any answer within the limit, the premise of FR-115', () => {
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
      expect(used).toBeLessThanOrEqual(RANGE_MAX_GUESSES[length]);
    }
  });

  it('keeps the limit tight: one fewer guess would not always be enough', () => {
    // floor(log2 N) + 1 is the fewest guesses that always suffice.
    expect(RANGE_MAX_GUESSES[length]).toBe(Math.floor(Math.log2(sorted.length)) + 1);
  });

  it('plays a game from first guess to the secret', () => {
    const secret = lists.answers[0] as string;
    const first = sorted[0] as string;
    const distance = listDistance(sorted, first, secret) as number;

    let state = createRangeGame('g', secret);
    state = rangeReducer(state, { type: 'SUBMIT_GUESS', word: first, distance, now: 1 });
    expect(state.wordLength).toBe(length);
    expect(state.guesses[0]?.direction).toBe(first < secret ? 'after' : 'before');

    state = rangeReducer(state, { type: 'SUBMIT_GUESS', word: secret, distance: 0, now: 2 });
    expect(state.status).toBe('won');
  });

  it('heat agrees with the range: a guess inside it is never colder than the bound on its side (ADR-030)', () => {
    const secret = lists.answers[Math.floor(lists.answers.length / 2)] as string;
    const index = sorted.indexOf(secret);
    const far = sorted[Math.max(0, index - 3000)] as string;
    const near = sorted[Math.max(0, index - 5)] as string;
    const farther = listDistance(sorted, far, secret) as number;
    const nearer = listDistance(sorted, near, secret) as number;

    expect(nearer).toBeLessThan(farther);
    expect(HEAT_ORDER.indexOf(heatOf(nearer, length))).toBeLessThanOrEqual(
      HEAT_ORDER.indexOf(heatOf(farther, length)),
    );
  });
});

describe('the real 5-letter list, with the spec examples', async () => {
  const lists = await DICTIONARY_REGISTRY[5]();
  const sorted = lists.guesses;
  const guesses = new Set(sorted);

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
      wordLength: 5,
      lower: 'BRAVE',
      upper: 'STORM',
      guessed: ['BRAVE', 'STORM'],
      isAllowed: (word) => guesses.has(word),
    });

    expect(result).toEqual({ ok: false, error: 'outside-range' });
  });
});
