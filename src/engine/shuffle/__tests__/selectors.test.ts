import { describe, expect, it } from 'vitest';

import { createShuffleGame, shuffleReducer, type ShuffleAction } from '../reducer';
import {
  canHint,
  hasInput,
  hintsLeft,
  hintsUsed,
  isGameOver,
  otherAnagrams,
  remainingOf,
  shuffleRecord,
} from '../selectors';
import type { ShuffleState } from '../types';

/** WordShuffle selectors (T-88, T-90: FR-142, FR-145, FR-146, A11Y-24). */

const NOW = 2_000;
const HINT: ShuffleAction = { type: 'HINT', now: NOW };
const add = (letters: string): ShuffleAction[] =>
  [...letters].map((letter) => ({ type: 'ADD_LETTER', letter, now: NOW }));

function run(state: ShuffleState, ...actions: ShuffleAction[]): ShuffleState {
  return actions.reduce(shuffleReducer, state);
}

const fresh = (): ShuffleState => createShuffleGame('g', 6, 'LISTEN', 'NTSELI');

describe('status and hints', () => {
  it('isGameOver is true for solved and gave-up only', () => {
    expect(isGameOver(fresh())).toBe(false);
    expect(
      isGameOver(
        run(fresh(), ...add('LISTEN'), {
          type: 'SUBMIT_ANSWER',
          word: 'LISTEN',
          anagrams: [],
          now: NOW,
        }),
      ),
    ).toBe(true);
    expect(isGameOver(run(fresh(), { type: 'GIVE_UP', anagrams: [], now: NOW }))).toBe(true);
  });

  it('counts hints used and left, out of 2', () => {
    expect([hintsUsed(fresh()), hintsLeft(fresh())]).toEqual([0, 2]);
    expect([hintsUsed(run(fresh(), HINT)), hintsLeft(run(fresh(), HINT))]).toEqual([1, 1]);
    expect([hintsUsed(run(fresh(), HINT, HINT)), hintsLeft(run(fresh(), HINT, HINT))]).toEqual([
      2, 0,
    ]);
  });

  it('hintsLeft never goes below zero', () => {
    expect(hintsLeft({ ...fresh(), hinted: [0, 1, 2, 3] })).toBe(0);
  });

  it('canHint is true while playing with a hint left only', () => {
    expect(canHint(fresh())).toBe(true);
    expect(canHint(run(fresh(), HINT))).toBe(true);
    expect(canHint(run(fresh(), HINT, HINT))).toBe(false);
    expect(canHint(run(fresh(), { type: 'GIVE_UP', anagrams: [], now: NOW }))).toBe(false);
  });
});

describe('hasInput', () => {
  it('is false for a fresh puzzle and true after a letter or a hint', () => {
    expect(hasInput(fresh())).toBe(false);
    expect(hasInput(run(fresh(), ...add('S')))).toBe(true);
    expect(hasInput(run(fresh(), HINT))).toBe(true);
  });

  it('is false again once the letters are removed', () => {
    expect(hasInput(run(fresh(), ...add('S'), { type: 'REMOVE_LETTER' }))).toBe(false);
  });
});

describe('otherAnagrams (FR-145)', () => {
  const anagrams = ['ENLIST', 'LISTEN', 'SILENT'];

  it('excludes the word found after a solve', () => {
    const state = run(fresh(), ...add('SILENT'), {
      type: 'SUBMIT_ANSWER',
      word: 'SILENT',
      anagrams,
      now: NOW,
    });

    expect(otherAnagrams(state)).toEqual(['ENLIST', 'LISTEN']);
  });

  it('excludes the target after a give up', () => {
    const state = run(fresh(), { type: 'GIVE_UP', anagrams, now: NOW });

    expect(otherAnagrams(state)).toEqual(['ENLIST', 'SILENT']);
  });

  it('is empty when the word is the only one', () => {
    const state = run(fresh(), { type: 'GIVE_UP', anagrams: ['LISTEN'], now: NOW });

    expect(otherAnagrams(state)).toEqual([]);
  });
});

describe('remainingOf (A11Y-24)', () => {
  it('counts the copies of a letter still in the tray', () => {
    const state = createShuffleGame('g', 5, 'SPEED', 'EDSEP');

    expect(remainingOf(state, 'E')).toBe(2);
    expect(remainingOf(state, 'S')).toBe(1);
    expect(remainingOf(state, 'Z')).toBe(0);
    expect(remainingOf(run(state, ...add('E')), 'E')).toBe(1);
  });
});

describe('shuffleRecord (FR-146)', () => {
  it('is null while the puzzle is in play', () => {
    expect(shuffleRecord(fresh())).toBeNull();
    expect(shuffleRecord(run(fresh(), HINT, ...add('S')))).toBeNull();
  });

  it('records a solve with the word found and the hints used', () => {
    const state = run(fresh(), HINT, ...add('ISTEN'), {
      type: 'SUBMIT_ANSWER',
      word: 'LISTEN',
      anagrams: ['LISTEN'],
      now: NOW,
    });

    expect(shuffleRecord(state)).toEqual({
      id: 'g',
      playedAt: NOW,
      length: 6,
      target: 'LISTEN',
      found: 'LISTEN',
      hintsUsed: 1,
      solved: true,
      solveMs: expect.any(Number) as number,
      anagramCount: 1,
    });
  });

  it('records a give up with no word found', () => {
    expect(shuffleRecord(run(fresh(), { type: 'GIVE_UP', anagrams: [], now: NOW }))).toEqual({
      id: 'g',
      playedAt: NOW,
      length: 6,
      target: 'LISTEN',
      found: null,
      hintsUsed: 0,
      solved: false,
      solveMs: expect.any(Number) as number,
      anagramCount: 0,
    });
  });

  it('falls back to 0 if a finished puzzle has no finish time', () => {
    const state = run(fresh(), { type: 'GIVE_UP', anagrams: [], now: NOW });

    expect(shuffleRecord({ ...state, finishedAt: null })?.playedAt).toBe(0);
  });
});
