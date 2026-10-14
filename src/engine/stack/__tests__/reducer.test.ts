import { describe, expect, it } from 'vitest';

import { STACK_MODES } from '../constants';
import { createStackGame, stackReducer, type StackAction } from '../reducer';
import type { StackMode, StackState } from '../types';

/**
 * The WordStack state machine (T-75: FR-102 … FR-107, EC-39, EC-40, AC-46,
 * AC-47, AC-48). Every action is tried in every status.
 */

const NOW = 1_000;
const DUO_ANSWERS = ['PLANT', 'STORM'];
const QUAD_ANSWERS = ['PLANT', 'STORM', 'CRANE', 'MOUND'];

function fresh(mode: StackMode = 'duo'): StackState {
  const answers = mode === 'duo' ? DUO_ANSWERS : QUAD_ANSWERS;
  return stackReducer(createStackGame('x', mode, answers), {
    type: 'START',
    id: 'g1',
    mode,
    answers,
  });
}

function run(state: StackState, ...actions: StackAction[]): StackState {
  return actions.reduce(stackReducer, state);
}

const submit = (word: string, now = NOW): StackAction => ({ type: 'SUBMIT_GUESS', word, now });
const reveal: StackAction = { type: 'REVEAL_COMPLETE', now: NOW + 500 };
const typeLetters = (letters: string): StackAction[] =>
  [...letters].map((letter) => ({ type: 'ADD_LETTER', letter, now: NOW }));

/** Submits guesses and finishes each reveal. */
function play(state: StackState, ...words: string[]): StackState {
  return words.reduce((s, word) => run(s, submit(word), reveal), state);
}

function inStatus(status: StackState['status']): StackState {
  switch (status) {
    case 'playing':
      return play(fresh(), 'CRANE');
    case 'revealing':
      return run(fresh(), submit('CRANE'));
    case 'won':
      return play(fresh(), 'PLANT', 'STORM');
    case 'lost':
      return play(fresh(), 'CRANE', 'CRANE', 'CRANE', 'CRANE', 'CRANE', 'CRANE', 'CRANE');
  }
}

describe('modes and set-up (FR-102)', () => {
  it('Duo has 2 boards and 7 guesses, Quad 4 boards and 9 guesses', () => {
    expect(STACK_MODES.duo).toEqual({ boards: 2, maxGuesses: 7 });
    expect(STACK_MODES.quad).toEqual({ boards: 4, maxGuesses: 9 });
  });

  it('starts a game with one empty board per answer, in playing status', () => {
    expect(fresh('quad')).toEqual({
      id: 'g1',
      mode: 'quad',
      boards: QUAD_ANSWERS.map((answer) => ({ answer, guesses: [] })),
      words: [],
      currentInput: '',
      status: 'playing',
      startedAt: null,
      finishedAt: null,
    });
  });

  it('uppercases the answers', () => {
    const state = createStackGame('x', 'duo', ['plant', 'storm']);

    expect(state.boards.map((board) => board.answer)).toEqual(['PLANT', 'STORM']);
  });

  it('START replaces any state in any status', () => {
    for (const status of ['playing', 'revealing', 'won', 'lost'] as const) {
      const next = stackReducer(inStatus(status), {
        type: 'START',
        id: 'g2',
        mode: 'quad',
        answers: QUAD_ANSWERS,
      });

      expect(next.id).toBe('g2');
      expect(next.mode).toBe('quad');
      expect(next.status).toBe('playing');
      expect(next.words).toEqual([]);
    }
  });

  it('RESTORE replaces the state wholesale', () => {
    const saved = play(fresh(), 'CRANE');

    expect(stackReducer(fresh(), { type: 'RESTORE', state: saved })).toBe(saved);
  });
});

describe('ADD_LETTER and REMOVE_LETTER', () => {
  it('types uppercase letters and starts the clock once', () => {
    const state = run(fresh(), { type: 'ADD_LETTER', letter: 'c', now: 5 }, ...typeLetters('RA'));

    expect(state.currentInput).toBe('CRA');
    expect(state.startedAt).toBe(5);
  });

  it('ignores a sixth letter', () => {
    const full = run(fresh(), ...typeLetters('CRANE'));

    expect(stackReducer(full, typeLetters('S')[0] as StackAction)).toBe(full);
  });

  it.each(['1', ' ', '-', 'AB', ''])('ignores %j', (letter) => {
    const state = fresh();

    expect(stackReducer(state, { type: 'ADD_LETTER', letter, now: NOW })).toBe(state);
  });

  it.each(['revealing', 'won', 'lost'] as const)('ignores typing while %s', (status) => {
    const state = inStatus(status);

    expect(stackReducer(state, typeLetters('A')[0] as StackAction)).toBe(state);
    expect(stackReducer(state, { type: 'REMOVE_LETTER' })).toBe(state);
  });

  it('removes the last letter, and does nothing on an empty row', () => {
    const typed = run(fresh(), ...typeLetters('CR'), { type: 'REMOVE_LETTER' });
    const empty = fresh();

    expect(typed.currentInput).toBe('C');
    expect(stackReducer(empty, { type: 'REMOVE_LETTER' })).toBe(empty);
  });
});

describe('SUBMIT_GUESS (FR-104, FR-105, FR-106, EC-39)', () => {
  it('scores PANEL against both boards as in AC-46', () => {
    const state = run(fresh(), submit('PANEL'));

    expect(state.boards[0]?.guesses[0]?.evaluation).toEqual([
      'correct',
      'present',
      'present',
      'absent',
      'present',
    ]);
    expect(state.boards[1]?.guesses[0]?.evaluation).toEqual([
      'absent',
      'absent',
      'absent',
      'absent',
      'absent',
    ]);
  });

  it('adds the word to the game, clears the input and starts the reveal', () => {
    const state = run(fresh(), ...typeLetters('PA'), submit('PANEL', 77));

    expect(state.words).toEqual(['PANEL']);
    expect(state.currentInput).toBe('');
    expect(state.status).toBe('revealing');
  });

  it('starts the clock if no letter was typed first, and never restarts it', () => {
    const a = run(fresh(), submit('CRANE', 77));
    const b = run(play(a, 'SLOTH'), submit('PANEL', 99));

    expect(a.startedAt).toBe(77);
    expect(b.startedAt).toBe(77);
  });

  it('uppercases the word', () => {
    expect(run(fresh(), submit('panel')).words).toEqual(['PANEL']);
  });

  it('ignores a word of the wrong length', () => {
    const state = fresh();

    expect(stackReducer(state, submit('PAN'))).toBe(state);
    expect(stackReducer(state, submit('PANELS'))).toBe(state);
  });

  it.each(['revealing', 'won', 'lost'] as const)('is ignored while %s', (status) => {
    const state = inStatus(status);

    expect(stackReducer(state, submit('CRANE'))).toBe(state);
  });

  it('is ignored once the mode is out of guesses', () => {
    const full = { ...fresh(), words: Array.from({ length: 7 }, () => 'CRANE') };

    expect(stackReducer(full, submit('PANEL'))).toBe(full);
  });

  it('freezes a solved board: the next guess lands only on the other board (AC-47, EC-39)', () => {
    // Board 1 (PLANT) is solved on guess 3; guess 4 reaches only board 2.
    const state = play(fresh(), 'CRANE', 'SLOTH', 'PLANT', 'MOUND');

    expect(state.boards[0]?.guesses.map((g) => g.word)).toEqual(['CRANE', 'SLOTH', 'PLANT']);
    expect(state.boards[1]?.guesses.map((g) => g.word)).toEqual([
      'CRANE',
      'SLOTH',
      'PLANT',
      'MOUND',
    ]);
    expect(state.words).toEqual(['CRANE', 'SLOTH', 'PLANT', 'MOUND']);
  });

  it('keeps a solved board solved through the rest of the game', () => {
    const state = play(fresh(), 'PLANT', 'CRANE', 'SLOTH');

    expect(state.boards[0]?.guesses).toHaveLength(1);
    expect(state.boards[1]?.guesses).toHaveLength(3);
  });

  it('leaves both boards untouched when the guess is rejected by the guards', () => {
    const state = fresh();

    expect(stackReducer(state, submit('PAN')).boards).toBe(state.boards);
  });

  it('scores repeated letters with the standard algorithm on every board', () => {
    const state = run(createStackGame('d', 'duo', ['SPEED', 'ABBEY']), submit('EEEEE'));

    // SPEED: the two Es at 2 and 3 are exact and use up both copies.
    expect(state.boards[0]?.guesses[0]?.evaluation).toEqual([
      'absent',
      'absent',
      'correct',
      'correct',
      'absent',
    ]);
  });
});

describe('REVEAL_COMPLETE (FR-107, EC-40, AC-48)', () => {
  it('returns to playing after an ordinary guess', () => {
    const state = run(fresh(), submit('CRANE'), reveal);

    expect(state.status).toBe('playing');
    expect(state.finishedAt).toBeNull();
  });

  it('is won when every board is solved', () => {
    const state = inStatus('won');

    expect(state.status).toBe('won');
    expect(state.finishedAt).toBe(NOW + 500);
  });

  it('is not won while one board is still open', () => {
    expect(play(fresh(), 'PLANT').status).toBe('playing');
  });

  it('is lost when the limit is reached with a board unsolved', () => {
    const state = inStatus('lost');

    expect(state.status).toBe('lost');
    expect(state.words).toHaveLength(7);
  });

  it('Quad: two boards unsolved after 9 guesses is lost (AC-48)', () => {
    // Solve boards 1 and 2 early, then burn the remaining guesses.
    const words = ['PLANT', 'STORM', ...Array.from({ length: 7 }, () => 'SLOTH')];
    const state = play(fresh('quad'), ...words);

    expect(state.status).toBe('lost');
    expect(state.words).toHaveLength(9);
  });

  it('is won when the last board is solved on the final allowed guess (EC-40)', () => {
    const words = [...Array.from({ length: 6 }, () => 'SLOTH'), 'PLANT', 'STORM'].slice(0, 7);
    // Duo has 7 guesses: solve board 1 on guess 6 and board 2 on guess 7.
    const state = play(fresh(), ...Array.from({ length: 5 }, () => 'SLOTH'), 'PLANT', 'STORM');

    expect(words).toHaveLength(7);
    expect(state.words).toHaveLength(7);
    expect(state.status).toBe('won');
  });

  it.each(['playing', 'won', 'lost'] as const)('is ignored while %s', (status) => {
    const state = inStatus(status);

    expect(stackReducer(state, reveal)).toBe(state);
  });
});

describe('purity', () => {
  it('does not mutate the state it is given', () => {
    const state = play(fresh(), 'CRANE');
    const snapshot = JSON.stringify(state);

    run(state, ...typeLetters('PA'), submit('PANEL'), reveal);

    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it('is deterministic', () => {
    const actions: StackAction[] = [submit('CRANE'), reveal, submit('PLANT'), reveal];

    expect(run(fresh(), ...actions)).toEqual(run(fresh(), ...actions));
  });
});
