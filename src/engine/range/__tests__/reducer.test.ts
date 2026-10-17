import { describe, expect, it } from 'vitest';

import { RANGE_MAX_GUESSES } from '../constants';
import { createRangeGame, rangeReducer, type RangeAction } from '../reducer';
import type { RangeGuess, RangeState } from '../types';

/**
 * The WordRange state machine (T-80: FR-116, FR-118, FR-119, AC-49). Every
 * action is tried in every status.
 */

const NOW = 1_000;

function fresh(secret = 'PLANT'): RangeState {
  return rangeReducer(createRangeGame('x', secret), { type: 'START', id: 'g1', secret });
}

function run(state: RangeState, ...actions: RangeAction[]): RangeState {
  return actions.reduce(rangeReducer, state);
}

const submit = (word: string, distance: number, now = NOW): RangeAction => ({
  type: 'SUBMIT_GUESS',
  word,
  distance,
  now,
});
const type = (letters: string): RangeAction[] =>
  [...letters].map((letter) => ({ type: 'ADD_LETTER', letter, now: NOW }));

const FAR = 5000;

describe('set-up (FR-116)', () => {
  it('starts with the range at its sentinels, in playing, with nothing guessed', () => {
    expect(fresh()).toEqual({
      id: 'g1',
      secret: 'PLANT',
      wordLength: 5,
      guesses: [],
      lower: 'AAAAA',
      upper: 'ZZZZZ',
      currentInput: '',
      status: 'playing',
      startedAt: null,
      finishedAt: null,
    });
  });

  it.each([
    [4, 'PLAN', 'AAAA', 'ZZZZ'],
    [6, 'PLANET', 'AAAAAA', 'ZZZZZZ'],
  ] as const)(
    'a %i-letter game takes its length and sentinels from the secret (FR-115, FR-116)',
    (length, secret, lower, upper) => {
      const game = createRangeGame('x', secret);

      expect([game.wordLength, game.lower, game.upper]).toEqual([length, lower, upper]);
    },
  );

  it('uppercases the secret', () => {
    expect(createRangeGame('x', 'plant').secret).toBe('PLANT');
  });

  it('START replaces any state, and RESTORE replaces it wholesale', () => {
    const won = run(fresh(), submit('PLANT', 0));
    const started = rangeReducer(won, { type: 'START', id: 'g2', secret: 'STORM' });

    expect(started.id).toBe('g2');
    expect(started.status).toBe('playing');
    expect(rangeReducer(fresh(), { type: 'RESTORE', state: won })).toBe(won);
  });
});

describe('ADD_LETTER and REMOVE_LETTER', () => {
  it('types uppercase letters and starts the clock once', () => {
    const state = run(fresh(), { type: 'ADD_LETTER', letter: 'p', now: 5 }, ...type('LA'));

    expect(state.currentInput).toBe('PLA');
    expect(state.startedAt).toBe(5);
  });

  it('ignores a sixth letter and anything that is not A to Z', () => {
    const full = run(fresh(), ...type('PLANT'));

    expect(rangeReducer(full, type('S')[0] as RangeAction)).toBe(full);
    for (const letter of ['1', ' ', '-', 'AB', '']) {
      const state = fresh();
      expect(rangeReducer(state, { type: 'ADD_LETTER', letter, now: NOW })).toBe(state);
    }
  });

  it('removes the last letter, and does nothing on an empty row', () => {
    const typed = run(fresh(), ...type('PL'), { type: 'REMOVE_LETTER' });
    const empty = fresh();

    expect(typed.currentInput).toBe('P');
    expect(rangeReducer(empty, { type: 'REMOVE_LETTER' })).toBe(empty);
  });

  it.each(['won', 'lost'] as const)('both ignore input once %s', (status) => {
    const state: RangeState = { ...fresh(), status };
    const typed: RangeState = { ...state, currentInput: 'AB' };

    expect(rangeReducer(state, type('A')[0] as RangeAction)).toBe(state);
    expect(rangeReducer(typed, { type: 'REMOVE_LETTER' })).toBe(typed);
  });
});

describe('SUBMIT_GUESS (FR-118, AC-49)', () => {
  it('marks a guess before the secret "after" and raises the lower bound', () => {
    const state = run(fresh(), submit('BRAVE', FAR));

    expect(state.guesses).toEqual([{ word: 'BRAVE', direction: 'after', heat: 'freezing' }]);
    expect(state.lower).toBe('BRAVE');
    expect(state.upper).toBe('ZZZZZ');
  });

  it('marks a guess after the secret "before" and lowers the upper bound', () => {
    const state = run(fresh(), submit('STORM', 300));

    expect(state.guesses).toEqual([{ word: 'STORM', direction: 'before', heat: 'warm' }]);
    expect(state.lower).toBe('AAAAA');
    expect(state.upper).toBe('STORM');
  });

  it('narrows from both sides as in the example (BRAVE then STORM)', () => {
    const state = run(fresh(), submit('BRAVE', FAR), submit('STORM', 300));

    expect([state.lower, state.upper]).toEqual(['BRAVE', 'STORM']);
  });

  it('records the heat from the distance it is given (AC-49)', () => {
    expect(run(fresh(), submit('PLAIN', 4)).guesses[0]?.heat).toBe('burning');
    expect(run(fresh(), submit('PLAIN', 50)).guesses[0]?.heat).toBe('hot');
    expect(run(fresh(), submit('PLAIN', 2500)).guesses[0]?.heat).toBe('freezing');
  });

  it('clears the input, starts the clock if nobody typed, and never restarts it', () => {
    const state = run(fresh(), ...type('PLA'), submit('BRAVE', FAR, 77));
    const other = run(fresh(), submit('BRAVE', FAR, 77), submit('CRANE', FAR, 99));

    expect(state.currentInput).toBe('');
    expect(other.startedAt).toBe(77);
  });

  it('uppercases the word', () => {
    expect(run(fresh(), submit('brave', FAR)).guesses[0]?.word).toBe('BRAVE');
  });

  it('ignores a word of the wrong length', () => {
    const state = fresh();

    expect(rangeReducer(state, submit('PLAN', 3))).toBe(state);
    expect(rangeReducer(state, submit('PLANTS', 3))).toBe(state);
  });

  it('keeps the game in progress while guesses remain', () => {
    const state = run(fresh(), submit('BRAVE', FAR));

    expect(state.status).toBe('playing');
    expect(state.finishedAt).toBeNull();
  });
});

describe('winning and losing (FR-119)', () => {
  it('wins when a guess equals the secret, with no direction or heat', () => {
    const state = run(fresh(), submit('BRAVE', FAR), submit('PLANT', 0, 500));

    expect(state.status).toBe('won');
    expect(state.finishedAt).toBe(500);
    expect(state.guesses.at(-1)).toEqual({ word: 'PLANT', direction: null, heat: null });
  });

  it('leaves the bounds alone when the secret is found', () => {
    const state = run(fresh(), submit('BRAVE', FAR), submit('PLANT', 0));

    expect([state.lower, state.upper]).toEqual(['BRAVE', 'ZZZZZ']);
  });

  it('wins on the 14th and last guess', () => {
    let state = fresh();
    for (let i = 0; i < RANGE_MAX_GUESSES[5] - 1; i += 1) state = run(state, submit('BRAVE', FAR));
    state = run(state, submit('PLANT', 0));

    expect(state.status).toBe('won');
    expect(state.guesses).toHaveLength(14);
  });

  it('loses on the 14th wrong guess', () => {
    let state = fresh();
    for (let i = 0; i < RANGE_MAX_GUESSES[5]; i += 1)
      state = run(state, submit('BRAVE', FAR, 900 + i));

    expect(state.status).toBe('lost');
    expect(state.finishedAt).toBe(913);
    expect(state.guesses).toHaveLength(14);
  });

  it('is still playing after the 13th wrong guess', () => {
    let state = fresh();
    for (let i = 0; i < RANGE_MAX_GUESSES[5] - 1; i += 1) state = run(state, submit('BRAVE', FAR));

    expect(state.status).toBe('playing');
  });

  it.each(['won', 'lost'] as const)('ignores a guess once %s', (status) => {
    const state: RangeState = { ...fresh(), status };

    expect(rangeReducer(state, submit('BRAVE', FAR))).toBe(state);
  });

  it('ignores a guess when 14 are already in, whatever the status says', () => {
    const guess: RangeGuess = { word: 'BRAVE', direction: 'after', heat: 'cold' };
    const full: RangeState = { ...fresh(), guesses: Array.from({ length: 14 }, () => guess) };

    expect(rangeReducer(full, submit('CRANE', FAR))).toBe(full);
  });
});

describe('word lengths (FR-115)', () => {
  const CASES = [
    [4, 'PLAN', 'BRAT', 13],
    [6, 'PLANET', 'BRAVER', 15],
  ] as const;

  it.each(CASES)(
    'a %i-letter game is lost on the last of its guesses, not before',
    (_length, secret, wrong, limit) => {
      let state = fresh(secret);
      for (let i = 0; i < limit - 1; i += 1) state = run(state, submit(wrong, FAR));
      expect(state.status).toBe('playing');

      state = run(state, submit(wrong, FAR));
      expect(state.status).toBe('lost');
      expect(state.guesses).toHaveLength(limit);
    },
  );

  it.each(CASES)('a %i-letter game stops typing at its length', (length, secret) => {
    const state = run(fresh(secret), ...type('ABCDEFGHIJ'));

    expect(state.currentInput).toHaveLength(length);
  });

  it.each(CASES)('a %i-letter game ignores a word of another length', (_length, secret) => {
    const state = fresh(secret);

    expect(rangeReducer(state, submit('PLANT', FAR))).toBe(state);
  });
});

describe('purity', () => {
  it('does not mutate the state it is given', () => {
    const state = run(fresh(), submit('BRAVE', FAR));
    const snapshot = JSON.stringify(state);

    run(state, ...type('ST'), submit('STORM', 300));

    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it('is deterministic', () => {
    const actions: RangeAction[] = [submit('BRAVE', FAR), submit('STORM', 300)];

    expect(run(fresh(), ...actions)).toEqual(run(fresh(), ...actions));
  });
});
