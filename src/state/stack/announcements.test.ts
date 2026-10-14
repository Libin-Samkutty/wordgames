import { describe, expect, it } from 'vitest';

import { createStackGame, stackReducer, type StackAction, type StackState } from '@/engine/stack';

import { guessAnnouncement, outcomeAnnouncement } from './announcements';

/** WordStack announcements (T-79: A11Y-21, A11Y-3). */

const NOW = 1;
const submit = (word: string): StackAction => ({ type: 'SUBMIT_GUESS', word, now: NOW });
const reveal: StackAction = { type: 'REVEAL_COMPLETE', now: NOW };

function run(state: StackState, ...actions: StackAction[]): StackState {
  return actions.reduce(stackReducer, state);
}

const duo = (): StackState => createStackGame('g', 'duo', ['PLANT', 'STORM']);

describe('guessAnnouncement (A11Y-21)', () => {
  it('summarises each board, then the guesses left', () => {
    // PANEL vs PLANT: P correct; A, N, L present. PANEL vs STORM: nothing.
    expect(guessAnnouncement(run(duo(), submit('PANEL')))).toBe(
      'PANEL. Board 1: 1 correct, 3 present. Board 2: no matches. 6 guesses left.',
    );
  });

  it('reads the example shape: counts for an open board, "solved" for a solved one', () => {
    // CRANE vs STORM: R present, E not... S,T,O,R,M vs C,R,A,N,E: R is present (pos 2 vs 4).
    const state = run(duo(), submit('CRANE'), reveal, submit('PLANT'));

    expect(guessAnnouncement(state)).toBe(
      'PLANT. Board 1: solved. Board 2: 1 present. 5 guesses left.',
    );
  });

  it('keeps saying "solved" for a board solved earlier', () => {
    const state = run(duo(), submit('PLANT'), reveal, submit('CRANE'));

    expect(guessAnnouncement(state)).toContain('Board 1: solved');
    expect(guessAnnouncement(state)).toContain('Board 2: 1 present');
  });

  it('says "1 guess left" in the singular and "0 guesses left" at the end', () => {
    const almost = { ...duo(), words: ['CRANE', 'CRANE', 'CRANE', 'CRANE', 'CRANE', 'CRANE'] };
    const one = run(almost, submit('CRANE'));

    expect(guessAnnouncement(one)).toMatch(/0 guesses left\.$/);
    const six = { ...duo(), words: ['CRANE', 'CRANE', 'CRANE', 'CRANE', 'CRANE'] };
    expect(guessAnnouncement(run(six, submit('CRANE')))).toMatch(/1 guess left\.$/);
  });

  it('covers every board in Quad', () => {
    const quad = createStackGame('q', 'quad', ['PLANT', 'STORM', 'CRANE', 'MOUND']);
    const text = guessAnnouncement(run(quad, submit('CRANE')));

    expect(text).toMatch(
      /^CRANE\. Board 1: .*\. Board 2: .*\. Board 3: solved\. Board 4: .*\. 8 guesses left\.$/,
    );
  });
});

describe('outcomeAnnouncement', () => {
  it('announces a win with the guess count, in the singular and plural', () => {
    const won = run(duo(), submit('PLANT'), reveal, submit('STORM'), reveal);

    expect(outcomeAnnouncement(won)).toBe('You won in 2 guesses.');
    expect(outcomeAnnouncement({ ...won, words: ['PLANT'] })).toBe('You won in 1 guess.');
  });

  it('announces a loss with every unsolved answer (FR-107)', () => {
    let state = run(duo(), submit('PLANT'), reveal);
    for (let i = 0; i < 6; i += 1) state = run(state, submit('CRANE'), reveal);

    expect(state.status).toBe('lost');
    expect(outcomeAnnouncement(state)).toBe('Game over. Unsolved: STORM.');
  });
});
