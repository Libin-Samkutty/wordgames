import { describe, expect, it } from 'vitest';

import { MAX_MOVES } from '../constants';
import { createWeaverGame, weaverReducer, type WeaverAction } from '../reducer';
import type { Puzzle, WeaverState } from '../types';

/**
 * The WordWeaver state machine (T-62: FR-83, FR-84, FR-85, FR-87, EC-30,
 * EC-34, AC-33). Every action is tried in every status.
 */

const PUZZLE: Puzzle = { length: 4, start: 'COLD', end: 'WARM', par: 4 };
const NOW = 1_000;

function fresh(): WeaverState {
  return weaverReducer(createWeaverGame('x', PUZZLE), {
    type: 'NEW_PUZZLE',
    id: 'p1',
    puzzle: PUZZLE,
  });
}

function run(state: WeaverState, ...actions: WeaverAction[]): WeaverState {
  return actions.reduce(weaverReducer, state);
}

const submit = (word: string, now = NOW): WeaverAction => ({ type: 'SUBMIT_RUNG', word, now });
const reveal: WeaverAction = { type: 'REVEAL_COMPLETE', now: NOW + 500 };
const type = (letters: string): WeaverAction[] =>
  [...letters].map((letter) => ({ type: 'ADD_LETTER', letter, now: NOW }));

/** Submits a rung and finishes its reveal. */
function play(state: WeaverState, ...words: string[]): WeaverState {
  return words.reduce((s, word) => run(s, submit(word), reveal), state);
}

const GIVE_UP: WeaverAction = {
  type: 'GIVE_UP',
  ladder: ['COLD', 'CORD', 'CARD', 'WARD', 'WARM'],
  now: NOW + 900,
};

/** A state in each status, for the every-action-in-every-status checks. */
function inStatus(status: WeaverState['status']): WeaverState {
  switch (status) {
    case 'playing':
      return play(fresh(), 'CORD');
    case 'revealing':
      return run(play(fresh(), 'CORD'), submit('CARD'));
    case 'solved':
      return play(fresh(), 'CORD', 'CARD', 'WARD', 'WARM');
    case 'gave-up':
      return run(play(fresh(), 'CORD'), GIVE_UP);
  }
}

describe('NEW_PUZZLE and createWeaverGame', () => {
  it('starts a puzzle in playing with nothing played and no score (FR-87)', () => {
    expect(fresh()).toEqual({
      id: 'p1',
      length: 4,
      start: 'COLD',
      end: 'WARM',
      par: 4,
      rungs: [],
      moves: 0,
      currentInput: '',
      status: 'playing',
      startedAt: null,
      finishedAt: null,
      optimalLadder: null,
    });
    expect(fresh()).not.toHaveProperty('score');
  });

  it('uppercases the start and the end', () => {
    const state = createWeaverGame('x', { ...PUZZLE, start: 'cold', end: 'warm' });

    expect([state.start, state.end]).toEqual(['COLD', 'WARM']);
  });

  it('replaces any state in any status', () => {
    for (const status of ['playing', 'revealing', 'solved', 'gave-up'] as const) {
      const next = weaverReducer(inStatus(status), {
        type: 'NEW_PUZZLE',
        id: 'p2',
        puzzle: { ...PUZZLE, start: 'WARM', end: 'COLD' },
      });

      expect(next.id).toBe('p2');
      expect(next.status).toBe('playing');
      expect(next.rungs).toEqual([]);
      expect(next.moves).toBe(0);
    }
  });
});

describe('RESTORE', () => {
  it('replaces the state wholesale', () => {
    const saved = play(fresh(), 'CORD');

    expect(weaverReducer(fresh(), { type: 'RESTORE', state: saved })).toBe(saved);
  });
});

describe('ADD_LETTER', () => {
  it('types an uppercase letter and starts the clock once', () => {
    const state = run(fresh(), { type: 'ADD_LETTER', letter: 'c', now: 5 }, ...type('O'));

    expect(state.currentInput).toBe('CO');
    expect(state.startedAt).toBe(5);
  });

  it('ignores a fifth letter in a 4-letter puzzle (FR-79)', () => {
    const full = run(fresh(), ...type('CORD'));

    expect(weaverReducer(full, type('X')[0] as WeaverAction)).toBe(full);
  });

  it.each(['1', ' ', '-', 'AB', ''])('ignores %j', (letter) => {
    const state = fresh();

    expect(weaverReducer(state, { type: 'ADD_LETTER', letter, now: NOW })).toBe(state);
  });

  it.each(['revealing', 'solved', 'gave-up'] as const)('is ignored while %s', (status) => {
    const state = inStatus(status);

    expect(weaverReducer(state, type('A')[0] as WeaverAction)).toBe(state);
  });

  it('is ignored once 500 moves are reached (FR-85, EC-34)', () => {
    const capped = { ...fresh(), moves: MAX_MOVES };

    expect(weaverReducer(capped, type('A')[0] as WeaverAction)).toBe(capped);
  });

  it('still types at 499 moves', () => {
    const almost = { ...fresh(), moves: MAX_MOVES - 1 };

    expect(weaverReducer(almost, type('A')[0] as WeaverAction).currentInput).toBe('A');
  });
});

describe('REMOVE_LETTER', () => {
  it('removes the last typed letter', () => {
    const state = run(fresh(), ...type('COR'), { type: 'REMOVE_LETTER' });

    expect(state.currentInput).toBe('CO');
  });

  it('on an empty row leaves the rungs alone and returns the same state (FR-83)', () => {
    const state = play(fresh(), 'CORD', 'CARD');

    expect(weaverReducer(state, { type: 'REMOVE_LETTER' })).toBe(state);
  });

  it('on an empty row with no rungs does nothing at all (EC-30)', () => {
    const state = fresh();

    expect(weaverReducer(state, { type: 'REMOVE_LETTER' })).toBe(state);
  });

  it('removes a typed letter and keeps the rungs', () => {
    const state = run(play(fresh(), 'CORD'), ...type('CA'), { type: 'REMOVE_LETTER' });

    expect(state.currentInput).toBe('C');
    expect(state.rungs).toHaveLength(1);
  });

  it.each(['revealing', 'solved', 'gave-up'] as const)('is ignored while %s', (status) => {
    const state = inStatus(status);

    expect(weaverReducer(state, { type: 'REMOVE_LETTER' })).toBe(state);
  });
});

describe('SUBMIT_RUNG', () => {
  it('adds an evaluated rung, counts a move, clears the input and starts the reveal', () => {
    const state = run(fresh(), ...type('CORD'), submit('CORD', 77));

    expect(state.rungs).toEqual([
      { word: 'CORD', evaluation: ['absent', 'absent', 'correct', 'absent'] },
    ]);
    expect(state.moves).toBe(1);
    expect(state.currentInput).toBe('');
    expect(state.status).toBe('revealing');
  });

  it('starts the clock if no letter was typed first, and never restarts it', () => {
    const a = run(fresh(), submit('CORD', 77));
    const b = run(play(a, 'CARD'), submit('WARD', 99));

    expect(a.startedAt).toBe(77);
    expect(b.startedAt).toBe(77);
  });

  it('evaluates against the end word (FR-81)', () => {
    const state = run(fresh(), submit('CARD'));

    expect(state.rungs[0]?.evaluation).toEqual(['absent', 'correct', 'correct', 'absent']);
  });

  it('uppercases the word', () => {
    expect(run(fresh(), submit('cord')).rungs[0]?.word).toBe('CORD');
  });

  it('ignores a word of the wrong length', () => {
    const state = fresh();

    expect(weaverReducer(state, submit('CARDS'))).toBe(state);
    expect(weaverReducer(state, submit('CAR'))).toBe(state);
  });

  it.each(['revealing', 'solved', 'gave-up'] as const)('is ignored while %s', (status) => {
    const state = inStatus(status);

    expect(weaverReducer(state, submit('CARD'))).toBe(state);
  });

  it('is ignored once 500 moves are reached (FR-85, EC-34)', () => {
    const capped = { ...fresh(), moves: MAX_MOVES };

    expect(weaverReducer(capped, submit('CORD'))).toBe(capped);
  });

  it('accepts the 500th move', () => {
    const almost = { ...fresh(), moves: MAX_MOVES - 1 };

    expect(weaverReducer(almost, submit('CORD')).moves).toBe(MAX_MOVES);
  });
});

describe('REVEAL_COMPLETE', () => {
  it('returns to playing after an ordinary rung', () => {
    const state = run(fresh(), submit('CORD'), reveal);

    expect(state.status).toBe('playing');
    expect(state.finishedAt).toBeNull();
  });

  it('marks the puzzle solved when the rung is the end word (FR-82)', () => {
    const state = inStatus('solved');

    expect(state.status).toBe('solved');
    expect(state.finishedAt).toBe(NOW + 500);
  });

  it('does not treat reaching par as solving: only the end word does', () => {
    const state = play(fresh(), 'CORD', 'CARD', 'WARD');

    expect(state.moves).toBe(3);
    expect(state.status).toBe('playing');
  });

  it.each(['playing', 'solved', 'gave-up'] as const)('is ignored while %s', (status) => {
    const state = inStatus(status);

    expect(weaverReducer(state, reveal)).toBe(state);
  });

  it('settles to playing if a revealing state somehow has no rungs', () => {
    const odd: WeaverState = { ...fresh(), status: 'revealing' };

    expect(weaverReducer(odd, reveal).status).toBe('playing');
  });

  it('stays playing at the move cap without solving, so Give up remains possible (EC-34)', () => {
    const capped = run({ ...fresh(), moves: MAX_MOVES - 1 }, submit('CORD'), reveal);

    expect(capped.moves).toBe(MAX_MOVES);
    expect(capped.status).toBe('playing');
  });
});

describe('UNDO (FR-83, FR-84)', () => {
  it('removes the last rung and clears the input row', () => {
    const state = run(play(fresh(), 'CORD', 'CARD'), ...type('WA'), { type: 'UNDO' });

    expect(state.rungs.map((r) => r.word)).toEqual(['CORD']);
    expect(state.currentInput).toBe('');
  });

  it('does not give a move back: undo is not a move and does not refund one', () => {
    const state = run(play(fresh(), 'CORD', 'CARD'), { type: 'UNDO' });

    expect(state.moves).toBe(2);
  });

  it('counts CORD, CARD, undo, CARD as 3 moves (AC-33)', () => {
    const state = run(play(fresh(), 'CORD', 'CARD'), { type: 'UNDO' });
    const again = play(state, 'CARD');

    expect(again.moves).toBe(3);
    expect(again.rungs.map((r) => r.word)).toEqual(['CORD', 'CARD']);
  });

  it('never removes the start word: with no rungs it returns the same state (EC-30)', () => {
    const state = fresh();

    expect(weaverReducer(state, { type: 'UNDO' })).toBe(state);
  });

  it('can undo all the way back to just the start', () => {
    const state = run(play(fresh(), 'CORD', 'CARD'), { type: 'UNDO' }, { type: 'UNDO' });

    expect(state.rungs).toEqual([]);
    expect(weaverReducer(state, { type: 'UNDO' })).toBe(state);
  });

  it.each(['revealing', 'solved', 'gave-up'] as const)('is blocked while %s', (status) => {
    const state = inStatus(status);

    expect(weaverReducer(state, { type: 'UNDO' })).toBe(state);
  });

  it('works at the move cap', () => {
    const capped = { ...play(fresh(), 'CORD'), moves: MAX_MOVES };

    expect(weaverReducer(capped, { type: 'UNDO' }).rungs).toEqual([]);
  });
});

describe('GIVE_UP (FR-86, EC-34)', () => {
  it('ends the puzzle as gave-up and stores the ladder', () => {
    const state = inStatus('gave-up');

    expect(state.status).toBe('gave-up');
    expect(state.optimalLadder).toEqual(['COLD', 'CORD', 'CARD', 'WARD', 'WARM']);
    expect(state.finishedAt).toBe(NOW + 900);
  });

  it('works with no rungs played', () => {
    const state = run(fresh(), GIVE_UP);

    expect(state.status).toBe('gave-up');
    expect(state.moves).toBe(0);
  });

  it('clears the input row but keeps the rungs and moves', () => {
    const state = run(play(fresh(), 'CORD'), ...type('CA'), GIVE_UP);

    expect(state.currentInput).toBe('');
    expect(state.rungs).toHaveLength(1);
    expect(state.moves).toBe(1);
  });

  it('still works at the move cap (EC-34)', () => {
    const capped = { ...fresh(), moves: MAX_MOVES };

    expect(weaverReducer(capped, GIVE_UP).status).toBe('gave-up');
  });

  it.each(['revealing', 'solved', 'gave-up'] as const)('is ignored while %s', (status) => {
    const state = inStatus(status);

    expect(weaverReducer(state, GIVE_UP)).toBe(state);
  });
});

describe('purity', () => {
  it('does not mutate the state it is given', () => {
    const state = play(fresh(), 'CORD');
    const snapshot = JSON.stringify(state);

    run(state, ...type('CA'), submit('CARD'), reveal, { type: 'UNDO' }, GIVE_UP);

    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it('is deterministic', () => {
    const actions: WeaverAction[] = [...type('CORD'), submit('CORD'), reveal];

    expect(run(fresh(), ...actions)).toEqual(run(fresh(), ...actions));
  });
});
