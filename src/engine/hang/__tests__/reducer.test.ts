import { describe, expect, it } from 'vitest';

import { MAX_MISSES } from '../constants';
import { createHangGame, hangReducer, type HangAction } from '../reducer';
import type { HangState } from '../types';

/** The WordHang state machine (T-100: FR-167 to FR-170). */

const NOW = 1_000;
const guess = (letter: string, now = NOW): HangAction => ({ type: 'GUESS_LETTER', letter, now });

function run(state: HangState, ...actions: HangAction[]): HangState {
  return actions.reduce(hangReducer, state);
}

const fresh = (): HangState => createHangGame('g', 5, 'PLANT');

describe('starting', () => {
  it('begins with nothing tried and no clock', () => {
    expect(fresh()).toEqual({
      id: 'g',
      wordLength: 5,
      secret: 'PLANT',
      tried: '',
      status: 'playing',
      startedAt: null,
      finishedAt: null,
    });
  });

  it('upper-cases the secret', () => {
    expect(createHangGame('g', 4, 'lamb').secret).toBe('LAMB');
  });

  it('START builds a fresh game and RESTORE swaps in a saved one', () => {
    const started = hangReducer(fresh(), {
      type: 'START',
      id: 'next',
      wordLength: 4,
      secret: 'LAMB',
    });
    expect(started).toMatchObject({ id: 'next', wordLength: 4, secret: 'LAMB', tried: '' });

    const saved = run(fresh(), guess('P'));
    expect(hangReducer(started, { type: 'RESTORE', state: saved })).toBe(saved);
  });
});

describe('guessing a letter', () => {
  it('adds an uppercase letter to those tried, and starts the clock on the first', () => {
    const state = run(fresh(), guess('p'), guess('Z', NOW + 50));

    expect(state.tried).toBe('PZ');
    expect(state.startedAt).toBe(NOW);
    expect(state.status).toBe('playing');
  });

  it('ignores a letter already tried, with no change', () => {
    const once = run(fresh(), guess('P'));

    expect(hangReducer(once, guess('P'))).toBe(once);
    expect(hangReducer(once, guess('p'))).toBe(once);
  });

  it('ignores anything that is not A to Z', () => {
    const start = fresh();

    expect(hangReducer(start, guess('1'))).toBe(start);
    expect(hangReducer(start, guess('PL'))).toBe(start);
    expect(hangReducer(start, guess(''))).toBe(start);
  });

  it('a miss does not end the game before the sixth', () => {
    const state = run(fresh(), ...[...'QZXJK'].map((letter) => guess(letter)));

    expect(state.status).toBe('playing');
    expect(state.finishedAt).toBeNull();
  });
});

describe('winning', () => {
  it('wins on the letter that completes the word, with the time', () => {
    const state = run(fresh(), guess('P'), guess('L'), guess('A'), guess('N'), guess('T', NOW + 9));

    expect(state.status).toBe('won');
    expect(state.finishedAt).toBe(NOW + 9);
  });

  it('a repeated letter in the secret is revealed by one guess', () => {
    const state = run(createHangGame('g', 4, 'ALLY'), guess('A'), guess('L'), guess('Y', NOW + 3));

    expect(state.status).toBe('won');
  });

  it('can win with five misses already made', () => {
    const state = run(
      fresh(),
      ...[...'QZXJK'].map((letter) => guess(letter)),
      ...[...'PLANT'].map((letter) => guess(letter, NOW + 8)),
    );

    expect(state.status).toBe('won');
    expect(state.finishedAt).toBe(NOW + 8);
  });
});

describe('losing', () => {
  it('loses on the sixth miss, with the time', () => {
    const state = run(fresh(), ...[...'QZXJK'].map((letter) => guess(letter)), guess('B', NOW + 7));

    expect(state.status).toBe('lost');
    expect(state.finishedAt).toBe(NOW + 7);
    expect([...state.tried].filter((letter) => !'PLANT'.includes(letter))).toHaveLength(MAX_MISSES);
  });

  it('does not lose on six wrong letters if the sixth is not wrong', () => {
    const state = run(fresh(), ...[...'QZXJK'].map((letter) => guess(letter)), guess('P'));

    expect(state.status).toBe('playing');
  });
});

describe('after the game', () => {
  it('ignores every further letter once won or lost', () => {
    const won = run(fresh(), ...[...'PLANT'].map((letter) => guess(letter)));
    expect(hangReducer(won, guess('Z'))).toBe(won);

    const lost = run(fresh(), ...[...'QZXJKB'].map((letter) => guess(letter)));
    expect(hangReducer(lost, guess('P'))).toBe(lost);
  });
});
