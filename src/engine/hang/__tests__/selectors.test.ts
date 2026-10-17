import { describe, expect, it } from 'vitest';

import { createHangGame, hangReducer, type HangAction } from '../reducer';
import {
  hangRecord,
  isGameOver,
  isSolved,
  letterStates,
  maskedWord,
  missedLetters,
  misses,
  missesLeft,
  occurrences,
} from '../selectors';
import type { HangState } from '../types';

/** WordHang selectors (T-100: FR-170, FR-171, FR-174). */

const guess = (letter: string, now = 1_000): HangAction => ({ type: 'GUESS_LETTER', letter, now });

function played(...letters: string[]): HangState {
  return letters.reduce(
    (state, letter, index) => hangReducer(state, guess(letter, 1_000 + index * 500)),
    createHangGame('g', 5, 'PLANT'),
  );
}

describe('misses', () => {
  it('lists the wrong letters in the order they were tried, and counts them', () => {
    const state = played('Z', 'P', 'Q', 'L');

    expect(missedLetters(state)).toEqual(['Z', 'Q']);
    expect(misses(state)).toBe(2);
    expect(missesLeft(state)).toBe(4);
  });

  it('has none at the start, and never goes below zero left', () => {
    expect(misses(played())).toBe(0);
    expect(missesLeft(played())).toBe(6);
    expect(missesLeft({ ...played(), tried: 'QZXJKBVW' })).toBe(0);
  });
});

describe('the word', () => {
  it('is hidden at the start, and reveals every place of a letter tried', () => {
    expect(maskedWord(played())).toEqual([null, null, null, null, null]);
    expect(maskedWord(played('A', 'T'))).toEqual([null, null, 'A', null, 'T']);
  });

  it('reveals both places of a repeated letter at once', () => {
    const state = hangReducer(createHangGame('g', 4, 'ALLY'), guess('L'));

    expect(maskedWord(state)).toEqual([null, 'L', 'L', null]);
    expect(occurrences(state, 'L')).toBe(2);
    expect(occurrences(state, 'A')).toBe(1);
    expect(occurrences(state, 'Z')).toBe(0);
  });

  it('is solved only when every letter has been tried', () => {
    expect(isSolved(played('P', 'L', 'A', 'N'))).toBe(false);
    expect(isSolved(played('P', 'L', 'A', 'N', 'T'))).toBe(true);
  });
});

describe('letterStates', () => {
  it('marks a tried letter correct if in the word and absent if not, and leaves others out', () => {
    const states = letterStates(played('P', 'Z'));

    expect(states.get('P')).toBe('correct');
    expect(states.get('Z')).toBe('absent');
    expect(states.has('A')).toBe(false);
    expect(states.size).toBe(2);
  });
});

describe('isGameOver', () => {
  it('is true for won and lost only', () => {
    expect(isGameOver(played())).toBe(false);
    expect(isGameOver(played(...'PLANT'))).toBe(true);
    expect(isGameOver(played(...'QZXJKB'))).toBe(true);
  });
});

describe('hangRecord (FR-174)', () => {
  it('is null while the game is in play', () => {
    expect(hangRecord(played('P'))).toBeNull();
  });

  it('records a win with its misses and time', () => {
    expect(hangRecord(played('Z', ...'PLANT'))).toEqual({
      id: 'g',
      playedAt: 3_500,
      length: 5,
      secret: 'PLANT',
      misses: 1,
      won: true,
      solveMs: 2_500,
    });
  });

  it('records a loss with six misses', () => {
    expect(hangRecord(played(...'QZXJKB'))).toMatchObject({ misses: 6, won: false });
  });

  it('falls back to 0 times for a finished game with no start or end time', () => {
    const record = hangRecord({ ...played(), status: 'lost', startedAt: null, finishedAt: null });

    expect(record).toMatchObject({ playedAt: 0, solveMs: 0 });
  });
});
