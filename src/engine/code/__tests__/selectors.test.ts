import { describe, expect, it } from 'vitest';

import { codeReducer, createCodeGame, type CodeAction } from '../reducer';
import { codeRecord, guessesUsed, isGameOver, noteOf, remainingGuesses } from '../selectors';
import type { CodeGuess, CodeState } from '../types';

/** WordCode selectors (T-84, T-86: FR-134). */

const NOW = 2_000;
const submit = (word: string): CodeAction => ({ type: 'SUBMIT_GUESS', word, now: NOW });

function run(state: CodeState, ...actions: CodeAction[]): CodeState {
  return actions.reduce(codeReducer, state);
}

const fresh = (): CodeState => createCodeGame('g', 5, 'PLANT');

describe('counts and status', () => {
  it('counts guesses used and left out of 10', () => {
    const state = run(fresh(), submit('PANEL'), submit('SLOTH'));
    const guess = state.guesses[0] as CodeGuess;

    expect(guessesUsed(state)).toBe(2);
    expect(remainingGuesses(state)).toBe(8);
    expect(remainingGuesses({ ...state, guesses: Array.from({ length: 15 }, () => guess) })).toBe(
      0,
    );
  });

  it('isGameOver is true for won and lost only', () => {
    expect(isGameOver(fresh())).toBe(false);
    expect(isGameOver(run(fresh(), submit('PLANT')))).toBe(true);
    expect(isGameOver({ ...fresh(), status: 'lost' })).toBe(true);
  });
});

describe('noteOf', () => {
  it('reads a mark, case-insensitively, and undefined for an unmarked letter', () => {
    const state = run(
      fresh(),
      { type: 'CYCLE_NOTE', letter: 'P' },
      { type: 'CYCLE_NOTE', letter: 'Q' },
      { type: 'CYCLE_NOTE', letter: 'Q' },
    );

    expect(noteOf(state, 'p')).toBe('out');
    expect(noteOf(state, 'Q')).toBe('in');
    expect(noteOf(state, 'Z')).toBeUndefined();
  });
});

describe('codeRecord (FR-134)', () => {
  it('is null while the game is in play', () => {
    expect(codeRecord(fresh())).toBeNull();
    expect(codeRecord(run(fresh(), submit('PANEL')))).toBeNull();
  });

  it('records a win with its length', () => {
    expect(codeRecord(run(fresh(), submit('PANEL'), submit('PLANT')))).toEqual({
      id: 'g',
      playedAt: NOW,
      length: 5,
      secret: 'PLANT',
      guessesUsed: 2,
      won: true,
    });
  });

  it('records a loss', () => {
    let state = fresh();
    for (let i = 0; i < 10; i += 1) state = run(state, submit('SLOTH'));

    expect(codeRecord(state)).toMatchObject({ guessesUsed: 10, won: false });
  });

  it('falls back to 0 if a finished game has no finish time', () => {
    expect(codeRecord({ ...run(fresh(), submit('PLANT')), finishedAt: null })?.playedAt).toBe(0);
  });
});
