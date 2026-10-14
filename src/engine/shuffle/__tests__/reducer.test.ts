import { describe, expect, it } from 'vitest';

import { MAX_HINTS } from '../constants';
import { createShuffleGame, shuffleReducer, type ShuffleAction } from '../reducer';
import type { ShuffleState } from '../types';

/**
 * The WordShuffle state machine (T-88: FR-137 … FR-144, EC-46, EC-47, EC-48,
 * AC-53, AC-54). Every action is tried in every status.
 */

const NOW = 1_000;

/** LISTEN, scrambled as NTSELI (a non-word). */
function fresh(target = 'LISTEN', scramble = 'NTSELI'): ShuffleState {
  return shuffleReducer(createShuffleGame('x', 6, 'X'.repeat(6), 'X'.repeat(6)), {
    type: 'START',
    id: 'g1',
    wordLength: target.length as 4 | 5 | 6,
    target,
    scramble,
  });
}

function run(state: ShuffleState, ...actions: ShuffleAction[]): ShuffleState {
  return actions.reduce(shuffleReducer, state);
}

const add = (letters: string): ShuffleAction[] =>
  [...letters].map((letter) => ({ type: 'ADD_LETTER', letter, now: NOW }));
const REMOVE: ShuffleAction = { type: 'REMOVE_LETTER' };
const HINT: ShuffleAction = { type: 'HINT', now: NOW };
const submit = (word: string, anagrams: string[] = [word], now = NOW): ShuffleAction => ({
  type: 'SUBMIT_ANSWER',
  word,
  anagrams,
  now,
});
const giveUp = (anagrams: string[] = ['LISTEN'], now = NOW): ShuffleAction => ({
  type: 'GIVE_UP',
  anagrams,
  now,
});

const sorted = (letters: readonly string[]): string => [...letters].sort().join('');
/** Every letter is somewhere: the tray and the row together are the scramble. */
function expectLettersKept(state: ShuffleState): void {
  const inRow = state.slots.filter((slot): slot is string => slot !== null);
  expect(sorted([...state.tray, ...inRow])).toBe(sorted([...state.scramble]));
}

describe('set-up (FR-137, FR-138)', () => {
  it('starts with every letter in the tray, an empty row and nothing hinted', () => {
    expect(fresh()).toEqual({
      id: 'g1',
      wordLength: 6,
      target: 'LISTEN',
      scramble: 'NTSELI',
      tray: ['N', 'T', 'S', 'E', 'L', 'I'],
      slots: [null, null, null, null, null, null],
      hinted: [],
      status: 'playing',
      found: null,
      anagrams: [],
      startedAt: null,
      finishedAt: null,
    });
  });

  it.each([4, 5, 6] as const)('supports length %i', (length) => {
    const state = createShuffleGame('g', length, 'A'.repeat(length), 'A'.repeat(length));

    expect(state.slots).toHaveLength(length);
    expect(state.tray).toHaveLength(length);
  });

  it('uppercases the target and scramble', () => {
    const state = createShuffleGame('g', 4, 'lamb', 'mbal');

    expect(state.target).toBe('LAMB');
    expect(state.tray).toEqual(['M', 'B', 'A', 'L']);
  });

  it('START replaces any state, and RESTORE replaces it wholesale', () => {
    const solved = run(fresh(), ...add('LISTEN'), submit('LISTEN'));
    const started = shuffleReducer(solved, {
      type: 'START',
      id: 'g2',
      wordLength: 4,
      target: 'LAMB',
      scramble: 'MBAL',
    });

    expect(started).toMatchObject({ id: 'g2', wordLength: 4, status: 'playing', hinted: [] });
    expect(shuffleReducer(fresh(), { type: 'RESTORE', state: solved })).toBe(solved);
  });
});

describe('ADD_LETTER (FR-139, EC-46)', () => {
  it('moves a letter from the tray into the leftmost empty slot, and starts the clock once', () => {
    const state = run(fresh(), { type: 'ADD_LETTER', letter: 's', now: 5 }, ...add('L'));

    expect(state.slots).toEqual(['S', 'L', null, null, null, null]);
    expect(state.tray).toEqual(['N', 'T', 'E', 'I']);
    expect(state.startedAt).toBe(5);
    expectLettersKept(state);
  });

  it('ignores a letter that is not left in the tray, with no change (EC-46)', () => {
    const state = fresh();

    expect(shuffleReducer(state, add('Z')[0] as ShuffleAction)).toBe(state);
  });

  it('uses each copy of a repeated letter once, then ignores the next', () => {
    const state = createShuffleGame('g', 5, 'SPEED', 'EDSEP');
    const typed = run(state, ...add('EE'));

    expect(typed.slots.slice(0, 2)).toEqual(['E', 'E']);
    expect(shuffleReducer(typed, add('E')[0] as ShuffleAction)).toBe(typed);
  });

  it('ignores anything that is not a letter, and a full row', () => {
    const state = fresh();
    for (const letter of ['1', ' ', '', 'AB']) {
      expect(shuffleReducer(state, { type: 'ADD_LETTER', letter, now: NOW })).toBe(state);
    }

    // Every position filled: nothing is left in the tray, so a further letter is ignored.
    const full = run(state, ...add('NTSELI'));
    expect(shuffleReducer(full, add('N')[0] as ShuffleAction)).toBe(full);
  });

  it('skips a locked position and fills the others left to right (FR-142)', () => {
    const state = run(fresh(), HINT, ...add('TS'));

    expect(state.slots).toEqual(['L', 'T', 'S', null, null, null]);
  });

  it('ignores a letter when the row is full but the tray is not, a corrupt state', () => {
    const state: ShuffleState = { ...fresh(), slots: ['A', 'B', 'C', 'D', 'E', 'F'] };

    expect(shuffleReducer(state, add('N')[0] as ShuffleAction)).toBe(state);
  });
});

describe('REMOVE_LETTER (FR-139)', () => {
  it('returns the last typed letter to the tray', () => {
    const state = run(fresh(), ...add('SL'), REMOVE);

    expect(state.slots).toEqual(['S', null, null, null, null, null]);
    expect(state.tray).toEqual(['N', 'T', 'E', 'I', 'L']);
    expectLettersKept(state);
  });

  it('does nothing on an empty row', () => {
    const state = fresh();

    expect(shuffleReducer(state, REMOVE)).toBe(state);
  });

  it('never removes a locked letter (FR-142)', () => {
    const hinted = run(fresh(), HINT);

    expect(shuffleReducer(hinted, REMOVE)).toBe(hinted);
    const typed = run(hinted, ...add('T'), REMOVE, REMOVE);
    expect(typed.slots[0]).toBe('L');
    expect(typed.slots[1]).toBeNull();
  });

  it('removes the rightmost typed letter even with a gap before a locked one', () => {
    // Hint twice, so positions 0 and 1 are locked, then type into 2 and 3.
    const state = run(fresh(), HINT, HINT, ...add('SE'), REMOVE);

    expect(state.slots).toEqual(['L', 'I', 'S', null, null, null]);
  });
});

describe('RESHUFFLE (FR-143)', () => {
  it('reorders only the letters left in the tray', () => {
    const typed = run(fresh(), ...add('S'));
    const state = shuffleReducer(typed, { type: 'RESHUFFLE', tray: ['I', 'L', 'E', 'T', 'N'] });

    expect(state.tray).toEqual(['I', 'L', 'E', 'T', 'N']);
    expect(state.slots).toEqual(typed.slots);
    expectLettersKept(state);
  });

  it('ignores an order that gains or loses a letter', () => {
    const state = fresh();

    expect(shuffleReducer(state, { type: 'RESHUFFLE', tray: ['I', 'L', 'E', 'T', 'N'] })).toBe(
      state,
    );
    expect(shuffleReducer(state, { type: 'RESHUFFLE', tray: ['I', 'L', 'E', 'T', 'N', 'Z'] })).toBe(
      state,
    );
  });

  it('can be repeated as often as the player likes, and does not use a hint', () => {
    let state = fresh();
    for (let i = 0; i < 20; i += 1) {
      state = shuffleReducer(state, { type: 'RESHUFFLE', tray: [...state.tray].reverse() });
    }

    expect(state.hinted).toEqual([]);
    expectLettersKept(state);
  });
});

describe('HINT (FR-142, AC-54)', () => {
  it('fixes the leftmost letter of the target and takes it out of the tray', () => {
    const state = run(fresh(), HINT);

    expect(state.slots).toEqual(['L', null, null, null, null, null]);
    expect(state.hinted).toEqual([0]);
    expect(state.tray).toEqual(['N', 'T', 'S', 'E', 'I']);
    expectLettersKept(state);
  });

  it('a second hint fixes the next position, and a third does nothing', () => {
    const two = run(fresh(), HINT, HINT);
    const three = shuffleReducer(two, HINT);

    expect(two.slots.slice(0, 2)).toEqual(['L', 'I']);
    expect(two.hinted).toEqual([0, 1]);
    expect(MAX_HINTS).toBe(2);
    expect(three).toBe(two);
  });

  it('returns typed letters to the tray first, so the hinted letter never collides', () => {
    // L is in the row at position 3 when the hint wants L at position 0.
    const typed = run(fresh(), ...add('NTSL'));
    const state = run(typed, HINT);

    expect(state.slots).toEqual(['L', null, null, null, null, null]);
    expect(state.tray.slice().sort().join('')).toBe('EINST');
    expectLettersKept(state);
  });

  it('keeps an earlier hint locked while it clears typed letters', () => {
    const state = run(fresh(), HINT, ...add('TSE'), HINT);

    expect(state.slots).toEqual(['L', 'I', null, null, null, null]);
    expect(state.hinted).toEqual([0, 1]);
    expectLettersKept(state);
  });

  it('a hint on a repeated letter takes only one copy', () => {
    const state = run(createShuffleGame('g', 5, 'SPEED', 'EDSEP'), HINT, HINT, HINT);

    expect(state.slots.slice(0, 2)).toEqual(['S', 'P']);
    expect(state.tray.slice().sort().join('')).toBe('DEE');
  });

  it('starts the clock if nobody has typed', () => {
    expect(run(fresh(), { type: 'HINT', now: 77 }).startedAt).toBe(77);
    expect(run(fresh(), ...add('S'), { type: 'HINT', now: 99 }).startedAt).toBe(NOW);
  });
});

describe('SUBMIT_ANSWER (FR-140, FR-141, AC-53, EC-47)', () => {
  it('solves with the target and records the anagrams', () => {
    const state = run(fresh(), ...add('LISTEN'), submit('LISTEN', ['LISTEN', 'SILENT'], 500));

    expect(state).toMatchObject({
      status: 'solved',
      found: 'LISTEN',
      anagrams: ['LISTEN', 'SILENT'],
      finishedAt: 500,
    });
  });

  it('solves with a different anagram of the same letters (AC-53)', () => {
    const state = run(fresh(), ...add('SILENT'), submit('SILENT', ['LISTEN', 'SILENT']));

    expect(state.status).toBe('solved');
    expect(state.found).toBe('SILENT');
  });

  it('solves when the answer keeps the hinted letters in place', () => {
    const state = run(fresh(), HINT, ...add('ISTEN'), submit('LISTEN'));

    expect(state.status).toBe('solved');
    expect(state.hinted).toEqual([0]);
  });

  it('uppercases the word', () => {
    expect(run(fresh(), ...add('LISTEN'), submit('listen')).found).toBe('LISTEN');
  });

  it('ignores a word of the wrong length, or one that is not the row', () => {
    const typed = run(fresh(), ...add('LISTEN'));

    expect(shuffleReducer(typed, submit('LIST'))).toBe(typed);
    expect(shuffleReducer(typed, submit('SILENT'))).toBe(typed);
  });

  it('ignores a row with a gap', () => {
    const partial = run(fresh(), ...add('LIST'));

    expect(shuffleReducer(partial, submit('LISTXX'))).toBe(partial);
  });

  it('rejects an answer that moves a hinted letter, as a guard (AC-54, EC-48)', () => {
    // A hand-built state whose locked first slot holds the wrong letter.
    const state: ShuffleState = {
      ...fresh(),
      tray: [],
      slots: ['S', 'I', 'L', 'E', 'N', 'T'],
      hinted: [0, 1].filter((position) => position === 0),
    };
    const moved: ShuffleState = { ...state, target: 'LISTEN' };

    expect(shuffleReducer(moved, submit('SILENT'))).toBe(moved);
  });

  it('does not copy the anagram list by reference', () => {
    const anagrams = ['LISTEN'];
    const state = run(fresh(), ...add('LISTEN'), submit('LISTEN', anagrams));

    expect(state.anagrams).not.toBe(anagrams);
  });
});

describe('GIVE_UP (FR-144)', () => {
  it('ends as given up with every anagram and no found word', () => {
    const state = run(fresh(), ...add('LI'), giveUp(['LISTEN', 'SILENT'], 700));

    expect(state).toMatchObject({
      status: 'gave-up',
      found: null,
      anagrams: ['LISTEN', 'SILENT'],
      finishedAt: 700,
    });
  });

  it('works with nothing typed', () => {
    expect(run(fresh(), giveUp()).status).toBe('gave-up');
  });
});

describe('once the puzzle has ended', () => {
  const ended = (): ShuffleState[] => [
    run(fresh(), ...add('LISTEN'), submit('LISTEN')),
    run(fresh(), giveUp()),
  ];

  it('ignores every action but START and RESTORE', () => {
    for (const state of ended()) {
      for (const action of [
        ...add('S'),
        REMOVE,
        HINT,
        { type: 'RESHUFFLE', tray: [] } as ShuffleAction,
        submit('LISTEN'),
        giveUp(),
      ]) {
        expect(shuffleReducer(state, action)).toBe(state);
      }
    }
  });
});

describe('purity', () => {
  it('does not mutate the state it is given', () => {
    const state = run(fresh(), HINT, ...add('TS'));
    const snapshot = JSON.stringify(state);

    run(state, ...add('E'), REMOVE, HINT, { type: 'RESHUFFLE', tray: [...state.tray] });

    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it('is deterministic', () => {
    const actions: ShuffleAction[] = [HINT, ...add('TS'), REMOVE, ...add('E')];

    expect(run(fresh(), ...actions)).toEqual(run(fresh(), ...actions));
  });

  it('keeps every letter somewhere through any sequence of actions', () => {
    const actions: ShuffleAction[] = [
      ...add('NT'),
      HINT,
      ...add('SE'),
      REMOVE,
      HINT,
      ...add('LIN'),
      REMOVE,
      REMOVE,
      REMOVE,
    ];
    let state = fresh();

    for (const action of actions) {
      state = shuffleReducer(state, action);
      expectLettersKept(state);
    }
  });
});
