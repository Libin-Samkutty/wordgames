import { MIN_WORD_LENGTH, TRAY_SIZE } from './constants';
import type { Puzzle } from './puzzle';
import { isFormableFrom } from './validate';
import type { HuntState } from './types';

/**
 * Actions the game accepts (ARCHITECTURE §3.12).
 *
 * `now` is passed in rather than read from the clock, keeping the reducer pure
 * (ADR-003). `SUBMIT_WORD` carries a word the provider has already run through
 * \`validateWord\`: the dictionary lookup happens there, because the engine may
 * not depend on the dictionary.
 */
export type HuntAction =
  | { readonly type: 'START'; readonly id: string; readonly puzzle: Puzzle }
  | { readonly type: 'RESTORE'; readonly state: HuntState }
  | { readonly type: 'ADD_LETTER'; readonly letter: string; readonly now: number }
  | { readonly type: 'REMOVE_LETTER' }
  | { readonly type: 'SUBMIT_WORD'; readonly word: string; readonly now: number }
  | { readonly type: 'RESHUFFLE'; readonly tray: string }
  | { readonly type: 'GIVE_UP'; readonly now: number };

/** Builds a fresh puzzle in `playing` status. */
export function createHuntGame(id: string, puzzle: Puzzle): HuntState {
  return {
    id,
    seed: puzzle.seed,
    tray: puzzle.tray,
    required: puzzle.required,
    found: [],
    bonus: [],
    currentInput: '',
    status: 'playing',
    startedAt: null,
    finishedAt: null,
  };
}

/** True when `a` and `b` hold the same letters in any order. */
function sameLetters(a: string, b: string): boolean {
  return [...a].sort().join('') === [...b].sort().join('');
}

/**
 * The WordHunt state machine. Pure, synchronous and total.
 *
 * Unknown or illegal actions return the *same reference*, so React skips the
 * re-render and callers can rely on identity comparison.
 */
export function huntReducer(state: HuntState, action: HuntAction): HuntState {
  switch (action.type) {
    case 'START':
      return createHuntGame(action.id, action.puzzle);

    case 'RESTORE':
      return action.state;

    case 'ADD_LETTER': {
      if (state.status !== 'playing') return state;
      if (state.currentInput.length >= TRAY_SIZE) return state;

      const letter = action.letter.toUpperCase();
      if (!/^[A-Z]$/.test(letter)) return state;
      // A letter the tray has run out of is ignored with no toast (FR-160).
      if (!isFormableFrom(state.currentInput + letter, state.tray)) return state;

      return {
        ...state,
        currentInput: state.currentInput + letter,
        // The clock starts on the first letter and is never restarted.
        startedAt: state.startedAt ?? action.now,
      };
    }

    case 'REMOVE_LETTER': {
      if (state.status !== 'playing') return state;
      if (state.currentInput.length === 0) return state;

      return { ...state, currentInput: state.currentInput.slice(0, -1) };
    }

    case 'SUBMIT_WORD': {
      if (state.status !== 'playing') return state;

      const word = action.word.toUpperCase();
      if (word.length < MIN_WORD_LENGTH || !isFormableFrom(word, state.tray)) return state;
      if (state.found.includes(word) || state.bonus.includes(word)) return state;

      const isRequired = state.required.includes(word);
      const found = isRequired ? [...state.found, word] : state.found;
      const bonus = isRequired ? state.bonus : [...state.bonus, word];
      const won = found.length === state.required.length;

      return {
        ...state,
        found,
        bonus,
        currentInput: '',
        status: won ? 'won' : 'playing',
        startedAt: state.startedAt ?? action.now,
        finishedAt: won ? action.now : null,
      };
    }

    case 'RESHUFFLE': {
      if (state.status !== 'playing') return state;
      // A reshuffle only reorders: it can never add or drop a letter (FR-163).
      if (action.tray === state.tray || !sameLetters(action.tray, state.tray)) return state;

      return { ...state, tray: action.tray };
    }

    case 'GIVE_UP': {
      if (state.status !== 'playing') return state;

      return { ...state, status: 'gave-up', currentInput: '', finishedAt: action.now };
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
