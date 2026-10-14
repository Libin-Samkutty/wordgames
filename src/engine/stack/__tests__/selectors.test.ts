import { describe, expect, it } from 'vitest';

import { createStackGame, stackReducer, type StackAction } from '../reducer';
import {
  boardKeyStates,
  boardRows,
  boardStatus,
  boardsSolved,
  guessesUsed,
  isGameOver,
  maxGuesses,
  remainingGuesses,
  stackRecord,
  unsolvedAnswers,
} from '../selectors';
import type { StackMode, StackState } from '../types';

/** WordStack selectors (T-75, T-76: FR-106, FR-108, FR-109, FR-110, FR-111). */

const NOW = 2_000;
const submit = (word: string): StackAction => ({ type: 'SUBMIT_GUESS', word, now: NOW });
const reveal: StackAction = { type: 'REVEAL_COMPLETE', now: NOW + 100 };

function run(state: StackState, ...actions: StackAction[]): StackState {
  return actions.reduce(stackReducer, state);
}

function play(state: StackState, ...words: string[]): StackState {
  return words.reduce((s, word) => run(s, submit(word), reveal), state);
}

const duo = (): StackState => createStackGame('g', 'duo', ['PLANT', 'STORM']);
const quad = (): StackState => createStackGame('g', 'quad', ['PLANT', 'STORM', 'CRANE', 'MOUND']);
const type = (state: StackState, letters: string): StackState =>
  [...letters].reduce(
    (s, letter) => stackReducer(s, { type: 'ADD_LETTER', letter, now: NOW }),
    state,
  );

describe('counts and status', () => {
  it('reports the guess limit for each mode', () => {
    expect(maxGuesses(duo())).toBe(7);
    expect(maxGuesses(quad())).toBe(9);
  });

  it('counts guesses used and left', () => {
    const state = play(duo(), 'CRANE', 'SLOTH');

    expect(guessesUsed(state)).toBe(2);
    expect(remainingGuesses(state)).toBe(5);
    expect(remainingGuesses({ ...state, words: Array.from({ length: 9 }, () => 'CRANE') })).toBe(0);
  });

  it('isGameOver is true for won and lost only', () => {
    expect(isGameOver(duo())).toBe(false);
    expect(isGameOver(run(duo(), submit('CRANE')))).toBe(false);
    expect(isGameOver(play(duo(), 'PLANT', 'STORM'))).toBe(true);
    expect(isGameOver(play(duo(), ...Array.from({ length: 7 }, () => 'CRANE')))).toBe(true);
  });

  it('counts boards solved and lists the unsolved answers (FR-107)', () => {
    const state = play(quad(), 'PLANT', 'CRANE');

    expect(boardsSolved(state)).toBe(2);
    expect(unsolvedAnswers(state)).toEqual(['STORM', 'MOUND']);
  });

  it('marks each board playing, solved or failed (FR-106)', () => {
    const open = play(duo(), 'PLANT');
    const lost = play(duo(), 'PLANT', ...Array.from({ length: 6 }, () => 'CRANE'));

    expect([boardStatus(open, 0), boardStatus(open, 1)]).toEqual(['solved', 'playing']);
    expect([boardStatus(lost, 0), boardStatus(lost, 1)]).toEqual(['solved', 'failed']);
    expect(boardStatus(open, 5)).toBe('playing');
  });

  it('does not reveal a solve until the reveal has finished (FR-52)', () => {
    const revealing = run(duo(), submit('PLANT'));

    expect(boardStatus(revealing, 0)).toBe('playing');
    expect(boardsSolved(revealing)).toBe(0);
    expect(unsolvedAnswers(revealing)).toEqual(['PLANT', 'STORM']);
    expect(boardKeyStates(revealing)[0]).not.toBeNull();
    expect(boardStatus(stackReducer(revealing, reveal), 0)).toBe('solved');
  });
});

describe('boardRows (FR-108)', () => {
  it('returns maxGuesses rows of five tiles for each mode, so the layout never reflows', () => {
    expect(boardRows(duo(), 0)).toHaveLength(7);
    expect(boardRows(quad(), 3)).toHaveLength(9);
    for (const row of boardRows(duo(), 0)) expect(row.tiles).toHaveLength(5);
  });

  it('shows an evaluated guess on each board it reached', () => {
    const state = play(duo(), 'PANEL');

    expect(boardRows(state, 0)[0]?.tiles.map((t) => t.state)).toEqual([
      'correct',
      'present',
      'present',
      'absent',
      'present',
    ]);
    expect(boardRows(state, 1)[0]?.tiles.every((t) => t.state === 'absent')).toBe(true);
    expect(
      boardRows(state, 0)[0]
        ?.tiles.map((t) => t.letter)
        .join(''),
    ).toBe('PANEL');
  });

  it('shows typed letters in the active row of every open board', () => {
    const state = type(play(duo(), 'CRANE'), 'SL');

    for (const board of [0, 1]) {
      const row = boardRows(state, board)[1];
      expect(row?.isActive).toBe(true);
      expect(row?.tiles.slice(0, 3).map((t) => t.state)).toEqual(['filled', 'filled', 'empty']);
    }
  });

  it('freezes a solved board: its later rows stay empty and none is active (FR-106)', () => {
    const state = type(play(duo(), 'PLANT', 'CRANE'), 'SL');

    const solved = boardRows(state, 0);
    expect(solved.slice(1).every((row) => row.tiles.every((t) => t.state === 'empty'))).toBe(true);
    expect(solved.some((row) => row.isActive)).toBe(false);
    expect(boardRows(state, 1)[2]?.isActive).toBe(true);
  });

  it('marks the newest row as revealing on every board that received it', () => {
    const state = run(play(duo(), 'PLANT'), submit('CRANE'));

    expect(boardRows(state, 1)[1]?.isRevealing).toBe(true);
    // Board 1 was solved earlier, so it received nothing to reveal.
    expect(boardRows(state, 0).some((row) => row.isRevealing)).toBe(false);
  });

  it('has no active row once the game is over', () => {
    const state = play(duo(), 'PLANT', 'STORM');

    for (const board of [0, 1]) expect(boardRows(state, board).some((r) => r.isActive)).toBe(false);
  });

  it('returns empty rows for a board index that does not exist', () => {
    const rows = boardRows(duo(), 9);

    expect(rows).toHaveLength(7);
    expect(rows.every((row) => row.tiles.every((t) => t.state === 'empty'))).toBe(true);
  });
});

describe('boardKeyStates (T-76: FR-109)', () => {
  it('gives each board its own state for a letter', () => {
    // A is present on PLANT (board 1) and absent on STORM (board 2).
    const states = boardKeyStates(play(duo(), 'PANEL'));

    expect(states[0]?.get('A')).toBe('present');
    expect(states[1]?.get('A')).toBe('absent');
    expect(states[0]?.get('P')).toBe('correct');
    expect(states[1]?.get('P')).toBe('absent');
  });

  it('has no state for a letter nobody has guessed', () => {
    const states = boardKeyStates(play(duo(), 'PANEL'));

    expect(states[0]?.get('Z')).toBeUndefined();
    expect(states[1]?.get('Z')).toBeUndefined();
  });

  it('is null for a solved board, so its key segment is blank', () => {
    const states = boardKeyStates(play(duo(), 'PLANT'));

    expect(states[0]).toBeNull();
    expect(states[1]).not.toBeNull();
  });

  it('returns one entry per board in each mode', () => {
    expect(boardKeyStates(duo())).toHaveLength(2);
    expect(boardKeyStates(quad())).toHaveLength(4);
  });

  it('keeps the best state per letter and never downgrades it', () => {
    // Board 2 (STORM): T is present in SLOTH, then correct in STORM-like positions.
    const states = boardKeyStates(play(duo(), 'SLOTH', 'SHORT'));

    expect(states[1]?.get('S')).toBe('correct');
  });
});

describe('stackRecord (FR-111)', () => {
  it('is null while the game is in play', () => {
    expect(stackRecord(duo())).toBeNull();
    expect(stackRecord(play(duo(), 'CRANE'))).toBeNull();
  });

  it('records a win', () => {
    expect(stackRecord(play(duo(), 'PLANT', 'STORM'))).toEqual({
      id: 'g',
      playedAt: NOW + 100,
      mode: 'duo',
      answers: ['PLANT', 'STORM'],
      guessesUsed: 2,
      boardsSolved: 2,
      won: true,
      solveMs: expect.any(Number) as number,
      boardSolveGuesses: [1, 2],
    });
  });

  it('records the guess that solved each board, null for one never solved', () => {
    const state = play(
      quad(),
      'PLANT',
      'CRANE',
      'STORM',
      ...Array.from({ length: 6 }, () => 'SLOTH'),
    );

    expect(stackRecord(state)?.boardSolveGuesses).toEqual([1, 3, 2, null]);
  });

  it('records a loss with the boards that were solved', () => {
    const mode: StackMode = 'quad';
    const state = play(quad(), 'PLANT', ...Array.from({ length: 8 }, () => 'CRANE'));
    const record = stackRecord(state);

    expect(record).toMatchObject({ mode, guessesUsed: 9, boardsSolved: 2, won: false });
  });

  it('falls back to 0 if a finished game has no finish time', () => {
    const won = { ...play(duo(), 'PLANT', 'STORM'), finishedAt: null };

    expect(stackRecord(won)?.playedAt).toBe(0);
  });
});
