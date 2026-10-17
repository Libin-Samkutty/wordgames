import { describe, expect, it } from 'vitest';

import { createRangeGame, rangeReducer, type RangeAction } from '../reducer';
import {
  guessedWords,
  guessesUsed,
  isGameOver,
  lastHeat,
  rangeRecord,
  remainingGuesses,
  sortedGuesses,
} from '../selectors';
import type { RangeGuess, RangeState } from '../types';

/** WordRange selectors (T-80, T-82: FR-121, FR-124). */

const NOW = 2_000;
const submit = (word: string, distance: number): RangeAction => ({
  type: 'SUBMIT_GUESS',
  word,
  distance,
  now: NOW,
});

function run(state: RangeState, ...actions: RangeAction[]): RangeState {
  return actions.reduce(rangeReducer, state);
}

const fresh = (): RangeState => createRangeGame('g', 'PLANT');

describe('counts and status', () => {
  it('counts guesses used and left out of 14', () => {
    const state = run(fresh(), submit('BRAVE', 5000), submit('STORM', 300));
    const guess = state.guesses[0] as RangeGuess;

    expect(guessesUsed(state)).toBe(2);
    expect(remainingGuesses(state)).toBe(12);
    expect(remainingGuesses({ ...state, guesses: Array.from({ length: 20 }, () => guess) })).toBe(
      0,
    );
  });

  it('isGameOver is true for won and lost only', () => {
    expect(isGameOver(fresh())).toBe(false);
    expect(isGameOver(run(fresh(), submit('PLANT', 0)))).toBe(true);
    expect(isGameOver({ ...fresh(), status: 'lost' })).toBe(true);
  });

  it('gives the heat of the last guess, null before any and after finding the word', () => {
    expect(lastHeat(fresh())).toBeNull();
    expect(lastHeat(run(fresh(), submit('BRAVE', 5000)))).toBe('freezing');
    expect(lastHeat(run(fresh(), submit('BRAVE', 5000), submit('STORM', 40)))).toBe('hot');
    expect(lastHeat(run(fresh(), submit('PLANT', 0)))).toBeNull();
  });

  it('lists the guessed words in play order for the repeat check', () => {
    expect(guessedWords(run(fresh(), submit('STORM', 300), submit('BRAVE', 5000)))).toEqual([
      'STORM',
      'BRAVE',
    ]);
  });
});

describe('sortedGuesses (FR-121)', () => {
  it('sorts alphabetically, whatever the play order', () => {
    const state = run(fresh(), submit('STORM', 300), submit('BRAVE', 5000), submit('PLAIN', 3));

    expect(sortedGuesses(state).map((guess) => guess.word)).toEqual(['BRAVE', 'PLAIN', 'STORM']);
  });

  it('keeps each guess with its direction and heat', () => {
    const state = run(fresh(), submit('STORM', 300), submit('BRAVE', 5000));

    expect(sortedGuesses(state)).toEqual([
      { word: 'BRAVE', direction: 'after', heat: 'freezing' },
      { word: 'STORM', direction: 'before', heat: 'warm' },
    ]);
  });

  it('does not reorder the game state', () => {
    const state = run(fresh(), submit('STORM', 300), submit('BRAVE', 5000));
    sortedGuesses(state);

    expect(state.guesses.map((g) => g.word)).toEqual(['STORM', 'BRAVE']);
  });

  it('is empty before the first guess', () => {
    expect(sortedGuesses(fresh())).toEqual([]);
  });
});

describe('rangeRecord (FR-124)', () => {
  it('is null while the game is in play', () => {
    expect(rangeRecord(fresh())).toBeNull();
    expect(rangeRecord(run(fresh(), submit('BRAVE', 5000)))).toBeNull();
  });

  it('records a win', () => {
    expect(rangeRecord(run(fresh(), submit('BRAVE', 5000), submit('PLANT', 0)))).toEqual({
      id: 'g',
      playedAt: NOW,
      secret: 'PLANT',
      guessesUsed: 2,
      won: true,
      wordLength: 5,
      solveMs: 0,
      firstBurningGuess: 2,
      opener: 'BRAVE',
    });
  });

  it('records the length of the game', () => {
    const game = createRangeGame('g', 'PLANET');

    expect(rangeRecord(rangeReducer(game, submit('PLANET', 0)))?.wordLength).toBe(6);
  });

  it('records the first Burning guess, and none when no guess got that close', () => {
    expect(rangeRecord(run(fresh(), submit('BRAVE', 10), submit('PLANT', 0)))).toMatchObject({
      firstBurningGuess: 1,
    });

    let state = fresh();
    for (let i = 0; i < 14; i += 1) state = run(state, submit('BRAVE', 5000));
    expect(rangeRecord(state)?.firstBurningGuess).toBeNull();
  });

  it('records a loss', () => {
    let state = fresh();
    for (let i = 0; i < 14; i += 1) state = run(state, submit('BRAVE', 5000));

    expect(rangeRecord(state)).toMatchObject({ guessesUsed: 14, won: false });
  });

  it('falls back to 0 if a finished game has no finish time', () => {
    expect(rangeRecord({ ...run(fresh(), submit('PLANT', 0)), finishedAt: null })?.playedAt).toBe(
      0,
    );
  });
});
