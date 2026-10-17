import { describe, expect, it } from 'vitest';

import { createHuntGame, huntReducer, type HuntAction } from '../reducer';
import {
  foundCount,
  huntRecord,
  isGameOver,
  missedWords,
  requiredCount,
  slotGroups,
  usedPositions,
} from '../selectors';
import type { HuntState } from '../types';

/** WordHunt selectors (T-96: FR-160, FR-163, FR-165). */

const PUZZLE = {
  seed: 'STAPLE',
  tray: 'PLATES',
  required: ['LEAP', 'PALE', 'LEAST', 'STALE', 'PLATES'],
};

const add = (letter: string): HuntAction => ({ type: 'ADD_LETTER', letter, now: 1_000 });
const submit = (word: string, now = 1_000): HuntAction => ({ type: 'SUBMIT_WORD', word, now });
const giveUp: HuntAction = { type: 'GIVE_UP', now: 4_000 };

function run(state: HuntState, ...actions: HuntAction[]): HuntState {
  return actions.reduce(huntReducer, state);
}

const fresh = (): HuntState => createHuntGame('g', PUZZLE);

describe('counts and status', () => {
  it('counts the required and the found words', () => {
    const state = run(fresh(), submit('LEAP'), submit('PEAL'));

    expect(requiredCount(state)).toBe(5);
    expect(foundCount(state)).toBe(1);
  });

  it('isGameOver is true for won and gave-up only', () => {
    expect(isGameOver(fresh())).toBe(false);
    expect(isGameOver(run(fresh(), giveUp))).toBe(true);
    const all = run(fresh(), ...PUZZLE.required.map((word) => submit(word)));
    expect(isGameOver(all)).toBe(true);
  });

  it('lists the missed words in board order, none once everything is found', () => {
    const state = run(fresh(), submit('PALE'), submit('PLATES'));

    expect(missedWords(state)).toEqual(['LEAP', 'LEAST', 'STALE']);
    expect(missedWords(run(fresh(), ...PUZZLE.required.map((word) => submit(word))))).toEqual([]);
  });
});

describe('usedPositions', () => {
  it('marks nothing used when nothing is typed', () => {
    expect(usedPositions(fresh())).toEqual([false, false, false, false, false, false]);
  });

  it('marks the tray position of each typed letter', () => {
    // PLATES: P0 L1 A2 T3 E4 S5. Typing P then A uses positions 0 and 2.
    expect(usedPositions(run(fresh(), add('P'), add('A')))).toEqual([
      true,
      false,
      true,
      false,
      false,
      false,
    ]);
  });

  it('uses two positions for two copies of a letter', () => {
    const state = createHuntGame('g', { seed: 'SETTLE', tray: 'TESTLE', required: ['TEST'] });

    expect(usedPositions(run(state, add('T'), add('T')))).toEqual([
      true,
      false,
      false,
      true,
      false,
      false,
    ]);
  });

  it('ignores a typed letter the tray does not hold, as a saved blob could carry', () => {
    const odd = { ...fresh(), currentInput: 'Z' };

    expect(usedPositions(odd)).toEqual([false, false, false, false, false, false]);
  });
});

describe('slotGroups (FR-160)', () => {
  it('groups the required words by length, with found ones marked', () => {
    const state = run(fresh(), submit('PALE'), submit('PLATES'));

    expect(slotGroups(state)).toEqual([
      {
        length: 4,
        slots: [
          { word: 'LEAP', found: false },
          { word: 'PALE', found: true },
        ],
      },
      {
        length: 5,
        slots: [
          { word: 'LEAST', found: false },
          { word: 'STALE', found: false },
        ],
      },
      { length: 6, slots: [{ word: 'PLATES', found: true }] },
    ]);
  });

  it('leaves out a length with no words', () => {
    const state = createHuntGame('g', { ...PUZZLE, required: ['LEAP', 'PALE'] });

    expect(slotGroups(state).map((group) => group.length)).toEqual([4]);
  });
});

describe('huntRecord (FR-165)', () => {
  it('is null while the puzzle is in play', () => {
    expect(huntRecord(fresh())).toBeNull();
  });

  it('records a completed puzzle with its counts and time', () => {
    const state = run(
      fresh(),
      submit('PEAL', 1_000),
      ...PUZZLE.required.map((word, index) => submit(word, 2_000 + index * 1_000)),
    );

    expect(huntRecord(state)).toEqual({
      id: 'g',
      playedAt: 6_000,
      seed: 'STAPLE',
      requiredCount: 5,
      foundCount: 5,
      bonusCount: 1,
      completed: true,
      solveMs: 5_000,
    });
  });

  it('records a give up as not completed, with what was found', () => {
    const state = run(fresh(), submit('LEAP', 1_000), giveUp);

    expect(huntRecord(state)).toMatchObject({
      completed: false,
      foundCount: 1,
      requiredCount: 5,
      playedAt: 4_000,
      solveMs: 3_000,
    });
  });

  it('falls back to 0 times for a finished puzzle with no start or end time', () => {
    const record = huntRecord({ ...fresh(), status: 'gave-up', startedAt: null, finishedAt: null });

    expect(record).toMatchObject({ playedAt: 0, solveMs: 0 });
  });
});
