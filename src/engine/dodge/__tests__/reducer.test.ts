import { describe, expect, it } from 'vitest';

import { createDodgeGame, dodgeReducer, restoreGame, type DodgeAction } from '../reducer';
import { dodgeSession } from '../selectors';
import type { DodgeState } from '../types';

/** The WordDodge state machine (T-92: FR-148 to FR-153). */

const NOW = 1_000;
// PLANK splits these three to two: PLANT, PLANE and PLANS answer it alike.
const ANSWERS = ['PLANT', 'PLANE', 'PLANS', 'STORM', 'MUSIC'];

const add = (letter: string): DodgeAction => ({ type: 'ADD_LETTER', letter, now: NOW });
const submit = (word: string): DodgeAction => ({ type: 'SUBMIT_GUESS', word, now: NOW });
const reveal: DodgeAction = { type: 'REVEAL_COMPLETE', now: NOW + 5 };
const giveUp: DodgeAction = { type: 'GIVE_UP', now: NOW + 9 };

function run(state: DodgeState, ...actions: DodgeAction[]): DodgeState {
  return actions.reduce(dodgeReducer, state);
}

const fresh = (): DodgeState => createDodgeGame('g', 5, ANSWERS);

describe('starting', () => {
  it('begins with every answer possible and nothing typed', () => {
    const state = fresh();

    expect(state.candidates).toEqual(ANSWERS);
    expect(state.guesses).toEqual([]);
    expect(state.status).toBe('playing');
    expect(state.startedAt).toBeNull();
  });

  it('START builds a fresh game and RESTORE swaps in a saved one', () => {
    const started = dodgeReducer(fresh(), {
      type: 'START',
      id: 'next',
      wordLength: 4,
      answers: ['LAMB'],
    });
    expect(started).toMatchObject({ id: 'next', wordLength: 4, candidates: ['LAMB'] });

    const saved = run(fresh(), add('P'));
    expect(dodgeReducer(started, { type: 'RESTORE', state: saved })).toBe(saved);
  });
});

describe('typing', () => {
  it('adds uppercase letters, and starts the clock on the first one', () => {
    const state = run(fresh(), add('p'), add('L'));

    expect(state.currentInput).toBe('PL');
    expect(state.startedAt).toBe(NOW);
  });

  it('keeps the clock from the first letter', () => {
    const state = run(fresh(), add('P'), { type: 'ADD_LETTER', letter: 'L', now: NOW + 50 });

    expect(state.startedAt).toBe(NOW);
  });

  it('ignores a letter past the word length', () => {
    const full = run(fresh(), add('P'), add('L'), add('A'), add('N'), add('T'));

    expect(dodgeReducer(full, add('S'))).toBe(full);
  });

  it('ignores anything that is not A to Z', () => {
    const start = fresh();

    expect(dodgeReducer(start, add('1'))).toBe(start);
  });

  it('removes a letter, and does nothing on an empty row', () => {
    const state = run(fresh(), add('P'), add('L'), { type: 'REMOVE_LETTER' });
    expect(state.currentInput).toBe('P');

    const empty = fresh();
    expect(dodgeReducer(empty, { type: 'REMOVE_LETTER' })).toBe(empty);
  });

  it('ignores typing while a guess is revealing', () => {
    const revealing = run(fresh(), submit('PLANK'));

    expect(dodgeReducer(revealing, add('P'))).toBe(revealing);
    expect(dodgeReducer(revealing, { type: 'REMOVE_LETTER' })).toBe(revealing);
  });
});

describe('submitting', () => {
  it('answers with the colours that keep the most words, and goes to revealing', () => {
    const state = run(fresh(), submit('PLANK'));

    expect(state.status).toBe('revealing');
    expect(state.guesses).toHaveLength(1);
    expect(state.guesses[0]?.word).toBe('PLANK');
    expect(state.candidates).toEqual(['PLANT', 'PLANE', 'PLANS']);
    expect(state.currentInput).toBe('');
    expect(state.startedAt).toBe(NOW);
  });

  it('upper-cases the word', () => {
    expect(run(fresh(), submit('plank')).guesses[0]?.word).toBe('PLANK');
  });

  it('ignores a word of the wrong length, and a guess while revealing', () => {
    const start = fresh();
    expect(dodgeReducer(start, submit('PLAN'))).toBe(start);

    const revealing = run(fresh(), submit('PLANK'));
    expect(dodgeReducer(revealing, submit('STORM'))).toBe(revealing);
  });

  it('keeps an earlier start time', () => {
    const typed = run(fresh(), add('P'));
    const state = dodgeReducer(typed, { type: 'SUBMIT_GUESS', word: 'PLANK', now: NOW + 80 });

    expect(state.startedAt).toBe(NOW);
  });
});

describe('revealing', () => {
  it('goes back to playing while words are left', () => {
    const state = run(fresh(), submit('PLANK'), reveal);

    expect(state.status).toBe('playing');
    expect(state.finishedAt).toBeNull();
  });

  it('wins when the guess is the last word standing', () => {
    // PLANK keeps three, PLANT keeps PLANE and PLANS, PLANE keeps PLANS, then PLANS wins.
    const state = run(
      fresh(),
      submit('PLANK'),
      reveal,
      submit('PLANT'),
      reveal,
      submit('PLANE'),
      reveal,
    );
    expect(state.candidates).toEqual(['PLANS']);
    expect(state.status).toBe('playing');

    const won = run(state, submit('PLANS'), reveal);

    expect(won.status).toBe('won');
    expect(won.finishedAt).toBe(NOW + 5);
    expect(won.guesses).toHaveLength(4);
  });

  it('does nothing outside the revealing status', () => {
    const state = fresh();

    expect(dodgeReducer(state, reveal)).toBe(state);
  });
});

describe('giving up', () => {
  it('ends the game after at least one guess, and clears the row', () => {
    const state = run(fresh(), submit('PLANK'), reveal, add('S'), giveUp);

    expect(state.status).toBe('gave-up');
    expect(state.finishedAt).toBe(NOW + 9);
    expect(state.currentInput).toBe('');
  });

  it('is ignored before the first guess', () => {
    const start = fresh();

    expect(dodgeReducer(start, giveUp)).toBe(start);
  });

  it('is ignored while revealing and once over', () => {
    const revealing = run(fresh(), submit('PLANK'));
    expect(dodgeReducer(revealing, giveUp)).toBe(revealing);

    const over = run(fresh(), submit('PLANK'), reveal, giveUp);
    expect(dodgeReducer(over, giveUp)).toBe(over);
  });

  it('ignores typing once over', () => {
    const over = run(fresh(), submit('PLANK'), reveal, giveUp);

    expect(dodgeReducer(over, add('P'))).toBe(over);
  });
});

describe('restoreGame', () => {
  it('rebuilds the candidates by replaying the guesses', () => {
    const played = run(fresh(), submit('PLANK'), reveal);

    expect(restoreGame(dodgeSession(played), ANSWERS)).toEqual(played);
  });

  it('keeps a finished status', () => {
    const played = run(fresh(), submit('PLANK'), reveal, giveUp);
    const restored = restoreGame(dodgeSession(played), ANSWERS);

    expect(restored?.status).toBe('gave-up');
    expect(restored?.candidates).toEqual(played.candidates);
  });

  it('returns null when a guess no longer gets the colours it was shown', () => {
    const played = run(fresh(), submit('PLANK'), reveal);

    expect(restoreGame(dodgeSession(played), ['STORM', 'MUSIC', 'CRANE'])).toBeNull();
  });

  it('returns null when the answers have run out part-way through a replay', () => {
    const played = run(fresh(), submit('PLANK'), reveal);

    expect(restoreGame(dodgeSession(played), [])).toBeNull();
  });

  it('restores a game with no guesses', () => {
    const start = fresh();

    expect(restoreGame(dodgeSession(start), ANSWERS)).toEqual(start);
  });
});
