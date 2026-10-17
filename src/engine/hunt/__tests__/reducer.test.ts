import { describe, expect, it } from 'vitest';

import { createHuntGame, huntReducer, type HuntAction } from '../reducer';
import type { HuntState } from '../types';

/** The WordHunt state machine (T-96: FR-158 to FR-165). */

const NOW = 1_000;
const PUZZLE = { seed: 'STAPLE', tray: 'PLATES', required: ['LEAP', 'PALE', 'STALE'] };

const add = (letter: string): HuntAction => ({ type: 'ADD_LETTER', letter, now: NOW });
const submit = (word: string, now = NOW): HuntAction => ({ type: 'SUBMIT_WORD', word, now });
const giveUp: HuntAction = { type: 'GIVE_UP', now: NOW + 9 };

function run(state: HuntState, ...actions: HuntAction[]): HuntState {
  return actions.reduce(huntReducer, state);
}

const fresh = (): HuntState => createHuntGame('g', PUZZLE);

/** Finds every required word, ending the puzzle. */
const won = (): HuntState => run(fresh(), submit('LEAP'), submit('PALE'), submit('STALE', NOW + 5));

describe('starting', () => {
  it('begins with nothing found and nothing typed', () => {
    expect(fresh()).toEqual({
      id: 'g',
      seed: 'STAPLE',
      tray: 'PLATES',
      required: ['LEAP', 'PALE', 'STALE'],
      found: [],
      bonus: [],
      currentInput: '',
      status: 'playing',
      startedAt: null,
      finishedAt: null,
    });
  });

  it('START builds a fresh puzzle and RESTORE swaps in a saved one', () => {
    const started = huntReducer(won(), { type: 'START', id: 'next', puzzle: PUZZLE });
    expect(started).toMatchObject({ id: 'next', status: 'playing', found: [] });

    const saved = run(fresh(), add('P'));
    expect(huntReducer(started, { type: 'RESTORE', state: saved })).toBe(saved);
  });
});

describe('typing', () => {
  it('adds uppercase letters, and starts the clock on the first one', () => {
    const state = run(fresh(), add('p'), add('L'));

    expect(state.currentInput).toBe('PL');
    expect(state.startedAt).toBe(NOW);
  });

  it('keeps the clock from the first letter', () => {
    const state = run(fresh(), add('P'), { type: 'ADD_LETTER', letter: 'L', now: NOW + 50 });

    expect(state.startedAt).toBe(NOW);
  });

  it('ignores a letter the tray lacks, with no change', () => {
    const start = fresh();

    expect(huntReducer(start, add('Z'))).toBe(start);
  });

  it('ignores a letter the tray has run out of', () => {
    // PLATES has one P, so a second P is refused.
    const typed = run(fresh(), add('P'));

    expect(huntReducer(typed, add('P'))).toBe(typed);
  });

  it('ignores anything that is not A to Z', () => {
    const start = fresh();

    expect(huntReducer(start, add('1'))).toBe(start);
  });

  it('ignores a letter past the tray size', () => {
    const full = run(fresh(), ...[...'PLATES'].map(add));

    expect(full.currentInput).toBe('PLATES');
    expect(huntReducer(full, add('S'))).toBe(full);
  });

  it('removes a letter, and does nothing on an empty row', () => {
    const state = run(fresh(), add('P'), add('L'), { type: 'REMOVE_LETTER' });
    expect(state.currentInput).toBe('P');

    const empty = fresh();
    expect(huntReducer(empty, { type: 'REMOVE_LETTER' })).toBe(empty);
  });
});

describe('submitting', () => {
  it('a required word goes to found, clears the row and keeps playing', () => {
    const state = run(fresh(), add('L'), add('E'), submit('leap'));

    expect(state.found).toEqual(['LEAP']);
    expect(state.bonus).toEqual([]);
    expect(state.currentInput).toBe('');
    expect(state.status).toBe('playing');
    expect(state.finishedAt).toBeNull();
  });

  it('a valid word that is not required goes to bonus', () => {
    const state = run(fresh(), submit('PEAL'));

    expect(state.found).toEqual([]);
    expect(state.bonus).toEqual(['PEAL']);
    expect(state.status).toBe('playing');
  });

  it('starts the clock if it had not started, and keeps an earlier start', () => {
    expect(run(fresh(), submit('LEAP')).startedAt).toBe(NOW);

    const typed = run(fresh(), add('P'));
    expect(huntReducer(typed, submit('LEAP', NOW + 80)).startedAt).toBe(NOW);
  });

  it('wins on the last required word, whatever the bonus words', () => {
    const state = run(
      fresh(),
      submit('PEAL'),
      submit('LEAP'),
      submit('PALE'),
      submit('STALE', NOW + 5),
    );

    expect(state.status).toBe('won');
    expect(state.finishedAt).toBe(NOW + 5);
    expect(state.found).toEqual(['LEAP', 'PALE', 'STALE']);
  });

  it('ignores a word under four letters, one the tray cannot spell, and a repeat', () => {
    const start = fresh();
    expect(huntReducer(start, submit('PAL'))).toBe(start);
    expect(huntReducer(start, submit('ZZZZ'))).toBe(start);

    const once = run(start, submit('LEAP'), submit('PEAL'));
    expect(huntReducer(once, submit('LEAP'))).toBe(once);
    expect(huntReducer(once, submit('PEAL'))).toBe(once);
  });

  it('ignores a word once the puzzle is over', () => {
    const over = won();

    expect(huntReducer(over, submit('PEAL'))).toBe(over);
    expect(huntReducer(over, add('P'))).toBe(over);
    expect(huntReducer(over, { type: 'REMOVE_LETTER' })).toBe(over);
  });
});

describe('reshuffling', () => {
  it('changes the order of the tray and nothing else', () => {
    const state = run(fresh(), add('P'), { type: 'RESHUFFLE', tray: 'TASPLE' });

    expect(state.tray).toBe('TASPLE');
    expect(state.currentInput).toBe('P');
  });

  it('ignores the same order, and a tray with different letters', () => {
    const start = fresh();

    expect(huntReducer(start, { type: 'RESHUFFLE', tray: 'PLATES' })).toBe(start);
    expect(huntReducer(start, { type: 'RESHUFFLE', tray: 'PLATEZ' })).toBe(start);
    expect(huntReducer(start, { type: 'RESHUFFLE', tray: 'PLATE' })).toBe(start);
  });

  it('is ignored once the puzzle is over', () => {
    const over = won();

    expect(huntReducer(over, { type: 'RESHUFFLE', tray: 'TASPLE' })).toBe(over);
  });
});

describe('giving up', () => {
  it('ends the puzzle and clears the row', () => {
    const state = run(fresh(), submit('LEAP'), add('P'), giveUp);

    expect(state.status).toBe('gave-up');
    expect(state.finishedAt).toBe(NOW + 9);
    expect(state.currentInput).toBe('');
    expect(state.found).toEqual(['LEAP']);
  });

  it('works before any word is found', () => {
    expect(huntReducer(fresh(), giveUp).status).toBe('gave-up');
  });

  it('is ignored once the puzzle is over', () => {
    const over = run(fresh(), giveUp);

    expect(huntReducer(over, giveUp)).toBe(over);
    expect(huntReducer(won(), giveUp)).toMatchObject({ status: 'won' });
  });
});
