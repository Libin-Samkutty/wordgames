import { describe, expect, it } from 'vitest';

import {
  DISTRIBUTION_BUCKETS,
  DISTRIBUTION_FIRST,
  distributionIndex,
  distributionLabels,
} from '../constants';
import { createDodgeGame, dodgeReducer, type DodgeAction } from '../reducer';
import {
  canGiveUp,
  dodgeRecord,
  dodgeRows,
  dodgeSession,
  guessesUsed,
  isGameOver,
  revealedWord,
  wordsLeft,
} from '../selectors';
import type { DodgeState } from '../types';

/** WordDodge selectors (T-92: FR-150, FR-152, FR-155). */

const NOW = 2_000;
const ANSWERS = ['PLANT', 'PLANE', 'PLANS', 'STORM', 'MUSIC'];

const add = (letter: string): DodgeAction => ({ type: 'ADD_LETTER', letter, now: 1_000 });
const submit = (word: string): DodgeAction => ({ type: 'SUBMIT_GUESS', word, now: 1_000 });
const reveal: DodgeAction = { type: 'REVEAL_COMPLETE', now: NOW };
const giveUp: DodgeAction = { type: 'GIVE_UP', now: NOW };

function run(state: DodgeState, ...actions: DodgeAction[]): DodgeState {
  return actions.reduce(dodgeReducer, state);
}

const fresh = (): DodgeState => createDodgeGame('g', 5, ANSWERS);

/** PLANK, PLANT, PLANE, then PLANS, each revealed: a win on guess 4. */
const won = (): DodgeState =>
  run(
    fresh(),
    submit('PLANK'),
    reveal,
    submit('PLANT'),
    reveal,
    submit('PLANE'),
    reveal,
    submit('PLANS'),
    reveal,
  );

describe('counts and status', () => {
  it('counts guesses and the words left', () => {
    const state = run(fresh(), submit('PLANK'), reveal);

    expect(guessesUsed(state)).toBe(1);
    expect(wordsLeft(fresh())).toBe(5);
    expect(wordsLeft(state)).toBe(3);
  });

  it('isGameOver is true for won and gave-up only', () => {
    expect(isGameOver(fresh())).toBe(false);
    expect(isGameOver(run(fresh(), submit('PLANK')))).toBe(false);
    expect(isGameOver(won())).toBe(true);
    expect(isGameOver(run(fresh(), submit('PLANK'), reveal, giveUp))).toBe(true);
  });

  it('allows Give up only in play with a guess made', () => {
    expect(canGiveUp(fresh())).toBe(false);
    expect(canGiveUp(run(fresh(), submit('PLANK')))).toBe(false);
    expect(canGiveUp(run(fresh(), submit('PLANK'), reveal))).toBe(true);
    expect(canGiveUp(won())).toBe(false);
  });

  it('reveals the first word left, and nothing when none is', () => {
    expect(revealedWord(run(fresh(), submit('PLANK'), reveal))).toBe('PLANT');
    expect(revealedWord({ ...fresh(), candidates: [] })).toBe('');
  });
});

describe('dodgeRows (FR-150)', () => {
  it('is one empty row at the start', () => {
    const rows = dodgeRows(fresh());

    expect(rows).toHaveLength(1);
    expect(rows[0]?.isActive).toBe(true);
    expect(rows[0]?.tiles.map((tile) => tile.state)).toEqual(Array<string>(5).fill('empty'));
  });

  it('shows typed letters as filled tiles in the active row', () => {
    const rows = dodgeRows(run(fresh(), add('P'), add('L')));

    expect(rows[0]?.tiles.map((tile) => `${tile.letter}:${tile.state}`)).toEqual([
      'P:filled',
      'L:filled',
      ':empty',
      ':empty',
      ':empty',
    ]);
  });

  it('adds one row per guess, with the active row last', () => {
    const rows = dodgeRows(run(fresh(), submit('PLANK'), reveal, add('S')));

    expect(rows).toHaveLength(2);
    expect(rows[0]?.tiles.map((tile) => tile.letter).join('')).toBe('PLANK');
    expect(rows[0]?.isActive).toBe(false);
    expect(rows[1]?.isActive).toBe(true);
    expect(rows[1]?.tiles[0]?.letter).toBe('S');
  });

  it('marks the newest row as revealing and has no active row meanwhile', () => {
    const rows = dodgeRows(run(fresh(), submit('PLANK')));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.isRevealing).toBe(true);
    expect(rows[0]?.isActive).toBe(false);
  });

  it('has no active row once the game is over', () => {
    const rows = dodgeRows(won());

    expect(rows).toHaveLength(4);
    expect(rows.some((row) => row.isActive || row.isRevealing)).toBe(false);
  });
});

describe('dodgeSession', () => {
  it('keeps everything but the candidates', () => {
    const state = run(fresh(), submit('PLANK'), reveal);
    const session = dodgeSession(state);

    expect(session).not.toHaveProperty('candidates');
    expect(session).toEqual({
      id: 'g',
      wordLength: 5,
      guesses: state.guesses,
      currentInput: '',
      status: 'playing',
      startedAt: 1_000,
      finishedAt: null,
    });
  });
});

describe('dodgeRecord (FR-155)', () => {
  it('is null while the game is in play', () => {
    expect(dodgeRecord(fresh())).toBeNull();
    expect(dodgeRecord(run(fresh(), submit('PLANK')))).toBeNull();
  });

  it('records a win with the word found, guesses, time and opener', () => {
    expect(dodgeRecord(won())).toEqual({
      id: 'g',
      playedAt: NOW,
      length: 5,
      word: 'PLANS',
      guessesUsed: 4,
      won: true,
      solveMs: 1_000,
      opener: 'PLANK',
    });
  });

  it('records a give up with the word the game showed', () => {
    const record = dodgeRecord(run(fresh(), submit('PLANK'), reveal, giveUp));

    expect(record).toMatchObject({ won: false, word: 'PLANT', guessesUsed: 1 });
  });

  it('falls back to 0 times and an empty word for a finished game with no data', () => {
    const record = dodgeRecord({
      ...won(),
      guesses: [],
      candidates: [],
      startedAt: null,
      finishedAt: null,
    });

    expect(record).toMatchObject({ playedAt: 0, solveMs: 0, word: '' });
    expect(record).not.toHaveProperty('opener');
  });
});

describe('distribution rows (FR-155)', () => {
  it('puts the first rows at five guesses or fewer, then one row per guess, then an open end', () => {
    expect(distributionIndex(1)).toBe(0);
    expect(distributionIndex(DISTRIBUTION_FIRST)).toBe(0);
    expect(distributionIndex(DISTRIBUTION_FIRST + 1)).toBe(1);
    expect(distributionIndex(DISTRIBUTION_FIRST + DISTRIBUTION_BUCKETS - 1)).toBe(
      DISTRIBUTION_BUCKETS - 1,
    );
    expect(distributionIndex(500)).toBe(DISTRIBUTION_BUCKETS - 1);
  });

  it('labels the rows ≤5, 6 to 11 and 12+', () => {
    expect(distributionLabels()).toEqual(['≤5', '6', '7', '8', '9', '10', '11', '12+']);
  });
});
