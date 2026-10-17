import { MAX_MOVES } from './constants';
import { evaluateRung } from './evaluate';
import type { Puzzle, Rung, WeaverState } from './types';

/**
 * Actions the puzzle accepts (ARCHITECTURE §3.6).
 *
 * `now` is passed in rather than read from the clock, keeping the reducer pure
 * (ADR-003). `SUBMIT_RUNG` carries an already-validated word: dictionary lookup
 * and the FR-80 checks happen in the provider, because the engine may not
 * depend on the dictionary. `GIVE_UP` carries the ladder for the same reason:
 * the provider holds the graph.
 */
export type WeaverAction =
  | { readonly type: 'NEW_PUZZLE'; readonly id: string; readonly puzzle: Puzzle }
  | { readonly type: 'RESTORE'; readonly state: WeaverState }
  | { readonly type: 'ADD_LETTER'; readonly letter: string; readonly now: number }
  | { readonly type: 'REMOVE_LETTER' }
  | { readonly type: 'SUBMIT_RUNG'; readonly word: string; readonly now: number }
  | { readonly type: 'UNDO' }
  | { readonly type: 'REVEAL_COMPLETE'; readonly now: number }
  | {
      readonly type: 'GIVE_UP';
      readonly ladder: readonly string[];
      readonly now: number;
    };

/** Builds a fresh puzzle in `playing` status. */
export function createWeaverGame(id: string, puzzle: Puzzle): WeaverState {
  return {
    id,
    length: puzzle.length,
    start: puzzle.start.toUpperCase(),
    end: puzzle.end.toUpperCase(),
    par: puzzle.par,
    rungs: [],
    moves: 0,
    currentInput: '',
    status: 'playing',
    startedAt: null,
    finishedAt: null,
    optimalLadder: null,
  };
}

/** True when the puzzle takes input: playing, not mid-reveal and not over (FR-11). */
function acceptsInput(state: WeaverState): boolean {
  return state.status === 'playing';
}

/**
 * Drops the last rung. It does nothing with no rungs, mid-reveal or once the
 * puzzle has ended (FR-83, EC-30). `moves` is untouched: undo is not a move
 * and does not give a move back (FR-84).
 */
function undo(state: WeaverState): WeaverState {
  if (!acceptsInput(state) || state.rungs.length === 0) return state;

  return { ...state, rungs: state.rungs.slice(0, -1), currentInput: '' };
}

/**
 * The puzzle state machine. Pure, synchronous and total.
 *
 * Unknown or illegal actions return the *same reference*, so React skips the
 * re-render and callers can rely on identity comparison.
 *
 * ```
 * NEW_PUZZLE ─▶ playing ──SUBMIT_RUNG──▶ revealing ──REVEAL_COMPLETE──▶ playing
 *                 │  ▲                                    │
 *                 │  └── UNDO (≥ 1 rung)                  └─ rung is the end ─▶ solved
 *                 └── GIVE_UP ─▶ gave-up
 * ```
 */
export function weaverReducer(state: WeaverState, action: WeaverAction): WeaverState {
  switch (action.type) {
    case 'NEW_PUZZLE':
      return createWeaverGame(action.id, action.puzzle);

    case 'RESTORE':
      return action.state;

    case 'ADD_LETTER': {
      if (!acceptsInput(state)) return state;
      // The safety cap disables rung input; Give up and New puzzle still work (FR-85).
      if (state.moves >= MAX_MOVES) return state;
      // Typing past the row length is ignored silently (FR-79).
      if (state.currentInput.length >= state.length) return state;

      const letter = action.letter.toUpperCase();
      if (!/^[A-Z]$/.test(letter)) return state;

      return {
        ...state,
        currentInput: state.currentInput + letter,
        startedAt: state.startedAt ?? action.now,
      };
    }

    case 'REMOVE_LETTER': {
      if (!acceptsInput(state)) return state;
      if (state.currentInput.length > 0) {
        return { ...state, currentInput: state.currentInput.slice(0, -1) };
      }

      // Backspace on an empty row does nothing. Only UNDO removes a rung (FR-83).
      return state;
    }

    case 'SUBMIT_RUNG': {
      if (!acceptsInput(state)) return state;
      if (state.moves >= MAX_MOVES) return state;

      const word = action.word.toUpperCase();
      if (word.length !== state.length) return state;

      const rung: Rung = { word, evaluation: evaluateRung(word, state.end) };

      // The outcome is decided on the next REVEAL_COMPLETE, so the UI never
      // spoils a solve before the flip finishes (FR-89).
      return {
        ...state,
        rungs: [...state.rungs, rung],
        moves: state.moves + 1,
        currentInput: '',
        status: 'revealing',
        startedAt: state.startedAt ?? action.now,
      };
    }

    case 'UNDO':
      return undo(state);

    case 'REVEAL_COMPLETE': {
      if (state.status !== 'revealing') return state;

      const last = state.rungs[state.rungs.length - 1];
      if (last?.word === state.end) {
        return { ...state, status: 'solved', finishedAt: action.now };
      }

      return { ...state, status: 'playing' };
    }

    case 'GIVE_UP': {
      if (!acceptsInput(state)) return state;

      return {
        ...state,
        status: 'gave-up',
        currentInput: '',
        optimalLadder: action.ladder,
        finishedAt: action.now,
      };
    }

    /* v8 ignore next 5 -- unreachable: TypeScript proves the switch is
       exhaustive, so this exists only to fail the build if an action is added
       without a case. There is no runtime input that reaches it. */
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}
