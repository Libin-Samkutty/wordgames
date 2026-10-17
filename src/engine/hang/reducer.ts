import type { WordLength } from '../types';
import { MAX_MISSES } from './constants';
import { isSolved, misses } from './selectors';
import type { HangState } from './types';

/**
 * Actions the game accepts (ARCHITECTURE §3.13).
 *
 * `now` is passed in rather than read from the clock, keeping the reducer pure
 * (ADR-003). A letter is applied the moment it is guessed, with no Enter and no
 * word to look up, so the engine needs nothing from the dictionary.
 */
export type HangAction =
  | {
      readonly type: 'START';
      readonly id: string;
      readonly wordLength: WordLength;
      readonly secret: string;
    }
  | { readonly type: 'RESTORE'; readonly state: HangState }
  | { readonly type: 'GUESS_LETTER'; readonly letter: string; readonly now: number };

/** Builds a fresh game in `playing` status with nothing tried. */
export function createHangGame(id: string, wordLength: WordLength, secret: string): HangState {
  return {
    id,
    wordLength,
    secret: secret.toUpperCase(),
    tried: '',
    status: 'playing',
    startedAt: null,
    finishedAt: null,
  };
}

/**
 * The WordHang state machine. Pure, synchronous and total.
 *
 * Unknown or illegal actions return the *same reference*, so React skips the
 * re-render and callers can rely on identity comparison.
 */
export function hangReducer(state: HangState, action: HangAction): HangState {
  switch (action.type) {
    case 'START':
      return createHangGame(action.id, action.wordLength, action.secret);

    case 'RESTORE':
      return action.state;

    case 'GUESS_LETTER': {
      if (state.status !== 'playing') return state;

      const letter = action.letter.toUpperCase();
      if (!/^[A-Z]$/.test(letter)) return state;
      // A letter already tried is ignored, with no toast and no cost (FR-169).
      if (state.tried.includes(letter)) return state;

      const next: HangState = {
        ...state,
        tried: state.tried + letter,
        // The clock starts on the first letter and is never restarted.
        startedAt: state.startedAt ?? action.now,
      };

      // A letter that completes the word wins, and only a miss can lose, so the two never meet.
      if (isSolved(next)) return { ...next, status: 'won', finishedAt: action.now };
      if (misses(next) >= MAX_MISSES) return { ...next, status: 'lost', finishedAt: action.now };
      return next;
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
