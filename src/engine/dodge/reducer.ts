import type { WordLength } from '../types';
import { chooseReply, isAllCorrect } from './adversary';
import type { DodgeGuess, DodgeSession, DodgeState } from './types';

/**
 * Actions the game accepts (ARCHITECTURE §3.11).
 *
 * `now` is passed in rather than read from the clock, keeping the reducer pure
 * (ADR-003). `SUBMIT_GUESS` carries an already-validated word: the dictionary
 * lookup happens in the provider, because the engine may not depend on it.
 */
export type DodgeAction =
  | {
      readonly type: 'START';
      readonly id: string;
      readonly wordLength: WordLength;
      readonly answers: readonly string[];
    }
  | { readonly type: 'RESTORE'; readonly state: DodgeState }
  | { readonly type: 'ADD_LETTER'; readonly letter: string; readonly now: number }
  | { readonly type: 'REMOVE_LETTER' }
  | { readonly type: 'SUBMIT_GUESS'; readonly word: string; readonly now: number }
  | { readonly type: 'REVEAL_COMPLETE'; readonly now: number }
  | { readonly type: 'GIVE_UP'; readonly now: number };

/** Builds a fresh game: every answer is still possible (FR-149). */
export function createDodgeGame(
  id: string,
  wordLength: WordLength,
  answers: readonly string[],
): DodgeState {
  return {
    id,
    wordLength,
    guesses: [],
    currentInput: '',
    status: 'playing',
    startedAt: null,
    finishedAt: null,
    candidates: answers,
  };
}

/**
 * Rebuilds a saved game by replaying its guesses against today's answers
 * (FR-153). Returns null if a guess no longer gets the colours it was shown,
 * which happens only if the answer list changed. That game cannot be resumed
 * honestly, so the caller starts a new one.
 */
export function restoreGame(session: DodgeSession, answers: readonly string[]): DodgeState | null {
  let candidates = answers;

  for (const guess of session.guesses) {
    // A replay that has run out of words has nothing left to answer with.
    if (candidates.length === 0) return null;

    const reply = chooseReply(guess.word, candidates);
    if (reply.evaluation.join() !== guess.evaluation.join()) return null;
    candidates = reply.candidates;
  }

  return { ...session, candidates };
}

/**
 * The WordDodge state machine. Pure, synchronous and total.
 *
 * Unknown or illegal actions return the *same reference*, so React skips the
 * re-render and callers can rely on identity comparison.
 */
export function dodgeReducer(state: DodgeState, action: DodgeAction): DodgeState {
  switch (action.type) {
    case 'START':
      return createDodgeGame(action.id, action.wordLength, action.answers);

    case 'RESTORE':
      return action.state;

    case 'ADD_LETTER': {
      if (state.status !== 'playing') return state;
      // Typing past the row length is ignored silently (FR-7).
      if (state.currentInput.length >= state.wordLength) return state;

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
      if (word.length !== state.wordLength) return state;

      const reply = chooseReply(word, state.candidates);
      const guess: DodgeGuess = { word, evaluation: reply.evaluation };

      // The outcome is decided here, but stays hidden behind `revealing` until
      // the flip finishes, so the UI never spoils it (FR-52).
      return {
        ...state,
        guesses: [...state.guesses, guess],
        candidates: reply.candidates,
        currentInput: '',
        status: 'revealing',
        startedAt: state.startedAt ?? action.now,
      };
    }

    case 'REVEAL_COMPLETE': {
      if (state.status !== 'revealing') return state;

      const last = state.guesses[state.guesses.length - 1];
      if (last && isAllCorrect(last.evaluation)) {
        return { ...state, status: 'won', finishedAt: action.now };
      }
      return { ...state, status: 'playing' };
    }

    case 'GIVE_UP': {
      // Nothing to give up on before the first guess; New game is there for that.
      if (state.status !== 'playing' || state.guesses.length === 0) return state;

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
