import { LOWER_SENTINEL, RANGE_LENGTH, RANGE_MAX_GUESSES, UPPER_SENTINEL } from './constants';
import { heatOf } from './heat';
import type { RangeGuess, RangeState } from './types';

/**
 * Actions the game accepts (ARCHITECTURE §3.8).
 *
 * `now` is passed in rather than read from the clock, keeping the reducer pure
 * (ADR-003). `SUBMIT_GUESS` carries an already-validated word and its distance
 * from the secret in list positions: validation needs the dictionary and the
 * distance needs the sorted guess list, and the engine may not depend on either.
 */
export type RangeAction =
  | { readonly type: 'START'; readonly id: string; readonly secret: string }
  | { readonly type: 'RESTORE'; readonly state: RangeState }
  | { readonly type: 'ADD_LETTER'; readonly letter: string; readonly now: number }
  | { readonly type: 'REMOVE_LETTER' }
  | {
      readonly type: 'SUBMIT_GUESS';
      readonly word: string;
      /** Positions between the word and the secret in the sorted guess list. */
      readonly distance: number;
      readonly now: number;
    };

/** Builds a fresh game in `playing` status, with the range at its sentinels. */
export function createRangeGame(id: string, secret: string): RangeState {
  return {
    id,
    secret: secret.toUpperCase(),
    guesses: [],
    lower: LOWER_SENTINEL,
    upper: UPPER_SENTINEL,
    currentInput: '',
    status: 'playing',
    startedAt: null,
    finishedAt: null,
  };
}

/**
 * The WordRange state machine. Pure, synchronous and total. There is no reveal
 * state: a guess is scored the moment it is submitted.
 *
 * Unknown or illegal actions return the *same reference*, so React skips the
 * re-render and callers can rely on identity comparison.
 */
export function rangeReducer(state: RangeState, action: RangeAction): RangeState {
  switch (action.type) {
    case 'START':
      return createRangeGame(action.id, action.secret);

    case 'RESTORE':
      return action.state;

    case 'ADD_LETTER': {
      if (state.status !== 'playing') return state;
      // Typing past the row length is ignored silently (FR-7).
      if (state.currentInput.length >= RANGE_LENGTH) return state;

      const letter = action.letter.toUpperCase();
      if (!/^[A-Z]$/.test(letter)) return state;

      return {
        ...state,
        currentInput: state.currentInput + letter,
        // The clock starts on the first keystroke and is never restarted.
        startedAt: state.startedAt ?? action.now,
      };
    }

    case 'REMOVE_LETTER': {
      if (state.status !== 'playing') return state;
      if (state.currentInput.length === 0) return state;

      return { ...state, currentInput: state.currentInput.slice(0, -1) };
    }

    case 'SUBMIT_GUESS': {
      if (state.status !== 'playing') return state;

      const word = action.word.toUpperCase();
      if (word.length !== RANGE_LENGTH) return state;
      if (state.guesses.length >= RANGE_MAX_GUESSES) return state;

      const startedAt = state.startedAt ?? action.now;

      if (word === state.secret) {
        const found: RangeGuess = { word, direction: null, heat: null };
        return {
          ...state,
          guesses: [...state.guesses, found],
          currentInput: '',
          status: 'won',
          startedAt,
          finishedAt: action.now,
        };
      }

      // The secret is after a word that comes earlier, which becomes the new
      // lower bound; otherwise it is before, and the word is the new upper bound (FR-118).
      const isAfter = word < state.secret;
      const guess: RangeGuess = {
        word,
        direction: isAfter ? 'after' : 'before',
        heat: heatOf(action.distance),
      };
      const guesses = [...state.guesses, guess];
      const lost = guesses.length >= RANGE_MAX_GUESSES;

      return {
        ...state,
        guesses,
        lower: isAfter ? word : state.lower,
        upper: isAfter ? state.upper : word,
        currentInput: '',
        status: lost ? 'lost' : 'playing',
        startedAt,
        finishedAt: lost ? action.now : null,
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
