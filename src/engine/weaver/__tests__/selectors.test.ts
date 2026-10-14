import { describe, expect, it } from 'vitest';

import { MAX_MOVES } from '../constants';
import { createWeaverGame, weaverReducer, type WeaverAction } from '../reducer';
import {
  canUndo,
  isGameOver,
  isParHit,
  ladderRows,
  moveLimitReached,
  overPar,
  previousWord,
  resultSummary,
  usedWords,
  weaverRecord,
} from '../selectors';
import type { Puzzle, WeaverState } from '../types';

/**
 * Selectors and the result summary (T-63: FR-84, FR-88, EC-31, AC-30, AC-44).
 * The fixture is the COLD → WARM puzzle with par 4.
 */

const PUZZLE: Puzzle = { length: 4, start: 'COLD', end: 'WARM', par: 4 };
const NOW = 2_000;

const submit = (word: string): WeaverAction => ({ type: 'SUBMIT_RUNG', word, now: NOW });
const reveal: WeaverAction = { type: 'REVEAL_COMPLETE', now: NOW + 100 };
const undo: WeaverAction = { type: 'UNDO' };

function run(state: WeaverState, ...actions: WeaverAction[]): WeaverState {
  return actions.reduce(weaverReducer, state);
}

function play(state: WeaverState, ...words: string[]): WeaverState {
  return words.reduce((s, word) => run(s, submit(word), reveal), state);
}

const fresh = (): WeaverState => createWeaverGame('g1', PUZZLE);

/** Solved in exactly `par` moves by the shortest path. */
const solvedInPar = (): WeaverState => play(fresh(), 'CORD', 'CARD', 'WARD', 'WARM');

describe('resultSummary and the par label (FR-84, FR-91)', () => {
  it('reads "Par!" and counts a par hit for COLD → WARM solved in 4 (AC-30)', () => {
    const summary = resultSummary(solvedInPar());

    expect(summary).toEqual({
      moves: 4,
      par: 4,
      ladderLength: 4,
      overPar: 0,
      parHit: true,
      label: 'Par!',
    });
  });

  it('reads "+2" for 6 moves against par 4 (EC-31)', () => {
    // CORD, CARD, CORE?, … any six accepted submissions ending at the end word.
    const state = play(fresh(), 'CORD', 'CARD', 'CORD', 'CARD', 'WARD', 'WARM');
    const summary = resultSummary(state);

    expect(summary.moves).toBe(6);
    expect(summary.overPar).toBe(2);
    expect(summary.label).toBe('+2');
    expect(summary.parHit).toBe(false);
  });

  it('reads "Under par by 1!" for 3 moves against par 4, a par hit with overPar -1 (AC-44)', () => {
    // A rung outside the ladder list can shortcut: COLD CORE? is not needed here,
    // the engine only counts submissions, so three accepted rungs ending at WARM will do.
    const state = play(fresh(), 'CARD', 'WARD', 'WARM');
    const summary = resultSummary(state);

    expect(summary.moves).toBe(3);
    expect(summary.overPar).toBe(-1);
    expect(summary.label).toBe('Under par by 1!');
    expect(summary.parHit).toBe(true);
  });

  it('counts undone rungs as moves, so undo cannot improve the result (FR-84)', () => {
    const state = play(run(play(fresh(), 'CORD', 'CARD'), undo), 'CARD', 'WARD', 'WARM');
    const summary = resultSummary(state);

    expect(summary.moves).toBe(5);
    expect(summary.ladderLength).toBe(4);
    expect(summary.label).toBe('+1');
  });

  it('has a label for a solve only: none while playing, none after give up', () => {
    const gaveUp = run(play(fresh(), 'CORD'), {
      type: 'GIVE_UP',
      ladder: ['COLD', 'CORD', 'CARD', 'WARD', 'WARM'],
      now: NOW,
    });

    expect(resultSummary(fresh()).label).toBeNull();
    expect(resultSummary(gaveUp).label).toBeNull();
    expect(resultSummary(gaveUp).moves).toBe(1);
    expect(resultSummary(gaveUp).parHit).toBe(false);
  });

  it('has no numeric score (FR-87)', () => {
    expect(resultSummary(solvedInPar())).not.toHaveProperty('score');
  });
});

describe('simple selectors', () => {
  it('isGameOver is true for solved and gave-up only', () => {
    expect(isGameOver(fresh())).toBe(false);
    expect(isGameOver(run(fresh(), submit('CORD')))).toBe(false);
    expect(isGameOver(solvedInPar())).toBe(true);
    expect(isGameOver(run(fresh(), { type: 'GIVE_UP', ladder: ['COLD'], now: NOW }))).toBe(true);
  });

  it('canUndo needs a rung and a settled board (FR-83, EC-30)', () => {
    expect(canUndo(fresh())).toBe(false);
    expect(canUndo(play(fresh(), 'CORD'))).toBe(true);
    expect(canUndo(run(play(fresh(), 'CORD'), submit('CARD')))).toBe(false);
    expect(canUndo(solvedInPar())).toBe(false);
  });

  it('moveLimitReached flips at 500 (FR-85)', () => {
    expect(moveLimitReached({ ...fresh(), moves: MAX_MOVES - 1 })).toBe(false);
    expect(moveLimitReached({ ...fresh(), moves: MAX_MOVES })).toBe(true);
  });

  it('previousWord is the last rung, or the start with none', () => {
    expect(previousWord(fresh())).toBe('COLD');
    expect(previousWord(play(fresh(), 'CORD', 'CARD'))).toBe('CARD');
  });

  it('usedWords is the start plus each rung, and drops undone rungs (FR-83)', () => {
    expect(usedWords(fresh())).toEqual(['COLD']);
    expect(usedWords(play(fresh(), 'CORD', 'CARD'))).toEqual(['COLD', 'CORD', 'CARD']);
    expect(usedWords(run(play(fresh(), 'CORD', 'CARD'), undo))).toEqual(['COLD', 'CORD']);
  });

  it('overPar and isParHit follow moves against par', () => {
    expect(overPar({ ...fresh(), moves: 7 })).toBe(3);
    expect(isParHit(solvedInPar())).toBe(true);
    // Not solved, so never a par hit even with few moves.
    expect(isParHit({ ...fresh(), moves: 1 })).toBe(false);
  });
});

describe('weaverRecord (FR-92)', () => {
  it('is null while the puzzle is in play', () => {
    expect(weaverRecord(fresh())).toBeNull();
    expect(weaverRecord(play(fresh(), 'CORD'))).toBeNull();
  });

  it('records a solve', () => {
    expect(weaverRecord(solvedInPar())).toEqual({
      id: 'g1',
      playedAt: NOW + 100,
      length: 4,
      start: 'COLD',
      end: 'WARM',
      par: 4,
      moves: 4,
      ladderLength: 4,
      solved: true,
    });
  });

  it('records a give up as not solved', () => {
    const gaveUp = run(play(fresh(), 'CORD'), {
      type: 'GIVE_UP',
      ladder: ['COLD', 'CORD', 'CARD', 'WARD', 'WARM'],
      now: 9,
    });

    expect(weaverRecord(gaveUp)).toMatchObject({
      solved: false,
      moves: 1,
      ladderLength: 1,
      playedAt: 9,
    });
  });

  it('falls back to 0 if a finished state has no finish time', () => {
    expect(weaverRecord({ ...solvedInPar(), finishedAt: null })?.playedAt).toBe(0);
  });
});

describe('ladderRows (FR-88, A11Y-16)', () => {
  it('shows start, input and end for a new puzzle', () => {
    const rows = ladderRows(fresh());

    expect(rows.map((r) => [r.kind, r.label])).toEqual([
      ['start', 'Start'],
      ['input', 'Next rung'],
      ['end', 'End'],
    ]);
  });

  it('scores the start row against the end word (FR-81)', () => {
    const start = ladderRows(fresh())[0];

    expect(start?.tiles).toEqual([
      { letter: 'C', state: 'absent' },
      { letter: 'O', state: 'absent' },
      { letter: 'L', state: 'absent' },
      { letter: 'D', state: 'absent' },
    ]);
  });

  it('shows the end row as all correct, always', () => {
    for (const state of [fresh(), play(fresh(), 'CORD'), solvedInPar()]) {
      const end = ladderRows(state).at(-1);

      expect(end?.kind).toBe('end');
      expect(end?.tiles.every((t) => t.state === 'correct')).toBe(true);
      expect(end?.tiles.map((t) => t.letter).join('')).toBe('WARM');
    }
  });

  it('adds a labelled, evaluated row for each rung', () => {
    const rows = ladderRows(play(fresh(), 'CORD', 'CARD'));

    expect(rows.map((r) => r.label)).toEqual(['Start', 'Rung 1', 'Rung 2', 'Next rung', 'End']);
    expect(rows[2]?.tiles.map((t) => t.state)).toEqual(['absent', 'correct', 'correct', 'absent']);
  });

  it('puts the typed letters in the input row as filled, then empty', () => {
    const state = [...'WA'].reduce(
      (s, letter) => weaverReducer(s, { type: 'ADD_LETTER', letter, now: NOW }),
      fresh(),
    );
    const input = ladderRows(state).find((r) => r.kind === 'input');

    expect(input?.isActive).toBe(true);
    expect(input?.tiles).toEqual([
      { letter: 'W', state: 'filled' },
      { letter: 'A', state: 'filled' },
      { letter: '', state: 'empty' },
      { letter: '', state: 'empty' },
    ]);
  });

  it('marks the newest rung as revealing and the input row inactive during a reveal', () => {
    const rows = ladderRows(run(play(fresh(), 'CORD'), submit('CARD')));

    expect(rows.find((r) => r.label === 'Rung 1')?.isRevealing).toBe(false);
    expect(rows.find((r) => r.label === 'Rung 2')?.isRevealing).toBe(true);
    const input = rows.find((r) => r.kind === 'input');
    expect(input?.isActive).toBe(false);
    expect(input?.tiles.every((t) => t.state === 'empty')).toBe(true);
  });

  it('drops the input row once the puzzle has ended', () => {
    const solved = ladderRows(solvedInPar());
    const gaveUp = ladderRows(run(fresh(), { type: 'GIVE_UP', ladder: ['COLD'], now: NOW }));

    expect(solved.some((r) => r.kind === 'input')).toBe(false);
    expect(gaveUp.some((r) => r.kind === 'input')).toBe(false);
  });

  it('has no row marked revealing outside a reveal', () => {
    expect(ladderRows(play(fresh(), 'CORD')).some((r) => r.isRevealing)).toBe(false);
  });

  it('sizes every row to the word length, for 5 letters too', () => {
    const five = createWeaverGame('g5', { length: 5, start: 'CRANE', end: 'SLOTH', par: 5 });

    for (const row of ladderRows(five)) expect(row.tiles).toHaveLength(5);
  });
});
