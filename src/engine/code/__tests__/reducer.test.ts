import { describe, expect, it } from 'vitest';

import { CODE_MAX_GUESSES } from '../constants';
import { codeReducer, createCodeGame, nextNote, type CodeAction } from '../reducer';
import type { CodeGuess, CodeState } from '../types';

/**
 * The WordCode state machine (T-84: FR-127, FR-128, FR-130, FR-132, EC-44, EC-45).
 * Every action is tried in every status.
 */

const NOW = 1_000;

function fresh(secret = 'PLANT', length: 4 | 5 | 6 = 5): CodeState {
  return codeReducer(createCodeGame('x', length, secret), {
    type: 'START',
    id: 'g1',
    wordLength: length,
    secret,
  });
}

function run(state: CodeState, ...actions: CodeAction[]): CodeState {
  return actions.reduce(codeReducer, state);
}

const submit = (word: string, now = NOW): CodeAction => ({ type: 'SUBMIT_GUESS', word, now });
const type = (letters: string): CodeAction[] =>
  [...letters].map((letter) => ({ type: 'ADD_LETTER', letter, now: NOW }));
const note = (letter: string): CodeAction => ({ type: 'CYCLE_NOTE', letter });

describe('set-up (FR-127)', () => {
  it('starts in playing with nothing guessed and a clean notepad', () => {
    expect(fresh()).toEqual({
      id: 'g1',
      wordLength: 5,
      secret: 'PLANT',
      guesses: [],
      currentInput: '',
      notes: {},
      status: 'playing',
      startedAt: null,
      finishedAt: null,
    });
  });

  it.each([4, 5, 6] as const)('supports length %i', (length) => {
    expect(fresh('A'.repeat(length), length).wordLength).toBe(length);
  });

  it('uppercases the secret', () => {
    expect(createCodeGame('x', 5, 'plant').secret).toBe('PLANT');
  });

  it('START replaces any state, and RESTORE replaces it wholesale', () => {
    const won = run(fresh(), submit('PLANT'));
    const started = codeReducer(won, { type: 'START', id: 'g2', wordLength: 4, secret: 'LAMB' });

    expect(started).toMatchObject({ id: 'g2', wordLength: 4, status: 'playing', notes: {} });
    expect(codeReducer(fresh(), { type: 'RESTORE', state: won })).toBe(won);
  });
});

describe('ADD_LETTER and REMOVE_LETTER (FR-128)', () => {
  it('types uppercase letters and starts the clock once', () => {
    const state = run(fresh(), { type: 'ADD_LETTER', letter: 'p', now: 5 }, ...type('LA'));

    expect(state.currentInput).toBe('PLA');
    expect(state.startedAt).toBe(5);
  });

  it('ignores a letter past the length and anything that is not A to Z', () => {
    const full = run(fresh(), ...type('PLANT'));

    expect(codeReducer(full, type('S')[0] as CodeAction)).toBe(full);
    for (const letter of ['1', ' ', '-', 'AB', '']) {
      const state = fresh();
      expect(codeReducer(state, { type: 'ADD_LETTER', letter, now: NOW })).toBe(state);
    }
  });

  it('a 4-letter game stops at 4', () => {
    const full = run(fresh('LAMB', 4), ...type('LAMB'));

    expect(codeReducer(full, type('S')[0] as CodeAction)).toBe(full);
  });

  it('removes the last letter, and does nothing on an empty row', () => {
    const typed = run(fresh(), ...type('PL'), { type: 'REMOVE_LETTER' });
    const empty = fresh();

    expect(typed.currentInput).toBe('P');
    expect(codeReducer(empty, { type: 'REMOVE_LETTER' })).toBe(empty);
  });

  it.each(['won', 'lost'] as const)('both ignore input once %s', (status) => {
    const state: CodeState = { ...fresh(), status };
    const typed: CodeState = { ...state, currentInput: 'AB' };

    expect(codeReducer(state, type('A')[0] as CodeAction)).toBe(state);
    expect(codeReducer(typed, { type: 'REMOVE_LETTER' })).toBe(typed);
  });
});

describe('SUBMIT_GUESS (FR-129, FR-130, AC-51)', () => {
  it('scores PANEL against PLANT as 1 bull and 3 cows', () => {
    const state = run(fresh(), submit('PANEL'));

    expect(state.guesses).toEqual([{ word: 'PANEL', bulls: 1, cows: 3 }]);
    expect(state.status).toBe('playing');
  });

  it('scores repeated letters by the evaluation rules: EEEEE against SPEED', () => {
    expect(run(fresh('SPEED'), submit('EEEEE')).guesses[0]).toEqual({
      word: 'EEEEE',
      bulls: 2,
      cows: 0,
    });
  });

  it('keeps the guesses in play order, clears the input and uppercases the word', () => {
    const state = run(fresh(), ...type('PL'), submit('panel'), submit('slate'));

    expect(state.guesses.map((guess) => guess.word)).toEqual(['PANEL', 'SLATE']);
    expect(state.currentInput).toBe('');
  });

  it('starts the clock if nobody typed, and never restarts it', () => {
    const state = run(fresh(), submit('PANEL', 77), submit('SLATE', 99));

    expect(state.startedAt).toBe(77);
  });

  it('ignores a word of the wrong length', () => {
    const state = fresh();

    expect(codeReducer(state, submit('PLAN'))).toBe(state);
    expect(codeReducer(state, submit('PLANTS'))).toBe(state);
  });

  it('does not touch the notes: a guess never sets a mark (FR-132)', () => {
    const marked = run(fresh(), note('P'), note('Q'), note('Q'));
    const state = run(marked, submit('PANEL'));

    expect(state.notes).toEqual(marked.notes);
  });
});

describe('winning and losing (FR-130)', () => {
  it('wins when bulls equal the length, with the finish time', () => {
    const state = run(fresh(), submit('PANEL'), submit('PLANT', 500));

    expect(state.status).toBe('won');
    expect(state.finishedAt).toBe(500);
    expect(state.guesses.at(-1)).toEqual({ word: 'PLANT', bulls: 5, cows: 0 });
  });

  it('wins at length 4 and length 6', () => {
    expect(run(fresh('LAMB', 4), submit('LAMB')).status).toBe('won');
    expect(run(fresh('PLANET', 6), submit('PLANET')).status).toBe('won');
  });

  it('wins on the 10th and last guess', () => {
    let state = fresh();
    for (let i = 0; i < CODE_MAX_GUESSES - 1; i += 1) state = run(state, submit('SLOTH'));
    state = run(state, submit('PLANT'));

    expect(state.status).toBe('won');
    expect(state.guesses).toHaveLength(10);
  });

  it('loses on the 10th wrong guess, with the finish time', () => {
    let state = fresh();
    for (let i = 0; i < CODE_MAX_GUESSES; i += 1) state = run(state, submit('SLOTH', 900 + i));

    expect(state.status).toBe('lost');
    expect(state.finishedAt).toBe(909);
    expect(state.guesses).toHaveLength(10);
  });

  it('is still playing after the 9th wrong guess', () => {
    let state = fresh();
    for (let i = 0; i < CODE_MAX_GUESSES - 1; i += 1) state = run(state, submit('SLOTH'));

    expect(state.status).toBe('playing');
    expect(state.finishedAt).toBeNull();
  });

  it.each(['won', 'lost'] as const)('ignores a guess once %s', (status) => {
    const state: CodeState = { ...fresh(), status };

    expect(codeReducer(state, submit('SLOTH'))).toBe(state);
  });

  it('ignores a guess when 10 are already in, whatever the status says', () => {
    const guess: CodeGuess = { word: 'SLOTH', bulls: 0, cows: 1 };
    const full: CodeState = { ...fresh(), guesses: Array.from({ length: 10 }, () => guess) };

    expect(codeReducer(full, submit('CRANE'))).toBe(full);
  });
});

describe('letter notes (FR-132, EC-45)', () => {
  it('cycles unmarked → ruled out → in the word → unmarked', () => {
    const once = run(fresh(), note('P'));
    const twice = run(once, note('P'));
    const thrice = run(twice, note('P'));

    expect(once.notes).toEqual({ P: 'out' });
    expect(twice.notes).toEqual({ P: 'in' });
    expect(thrice.notes).toEqual({});
  });

  it('keeps each letter apart and accepts lowercase', () => {
    const state = run(fresh(), note('p'), note('Q'), note('Q'), note('r'));

    expect(state.notes).toEqual({ P: 'out', Q: 'in', R: 'out' });
  });

  it('ignores anything that is not a letter', () => {
    const state = fresh();

    for (const letter of ['1', ' ', 'AB', '']) {
      expect(codeReducer(state, note(letter))).toBe(state);
    }
  });

  it.each(['won', 'lost'] as const)('ignores a note once %s', (status) => {
    const state: CodeState = { ...fresh(), status };

    expect(codeReducer(state, note('P'))).toBe(state);
  });

  it('does not change the guesses or the input', () => {
    const typed = run(fresh(), ...type('PL'), submit('PANEL'), ...type('SL'));
    const state = run(typed, note('Z'));

    expect(state.guesses).toBe(typed.guesses);
    expect(state.currentInput).toBe('SL');
  });

  it('nextNote walks the cycle', () => {
    expect(nextNote(undefined)).toBe('out');
    expect(nextNote('out')).toBe('in');
    expect(nextNote('in')).toBeUndefined();
  });
});

describe('purity', () => {
  it('does not mutate the state it is given', () => {
    const state = run(fresh(), note('P'), submit('PANEL'));
    const snapshot = JSON.stringify(state);

    run(state, ...type('ST'), note('P'), note('Z'), submit('STORM'));

    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it('is deterministic', () => {
    const actions: CodeAction[] = [note('P'), submit('PANEL'), submit('SLOTH')];

    expect(run(fresh(), ...actions)).toEqual(run(fresh(), ...actions));
  });
});
