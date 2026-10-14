import { evaluateGuess } from '../evaluate';
import type { Guess } from '../types';
import { STACK_LENGTH, STACK_MODES } from './constants';
import type { StackBoard, StackMode, StackState } from './types';

/**
 * Actions the game accepts (ARCHITECTURE §3.7).
 *
 * `now` is passed in rather than read from the clock, keeping the reducer pure
 * (ADR-003). `SUBMIT_GUESS` carries an already-validated word: the dictionary
 * lookup happens in the provider, because the engine may not depend on the
 * dictionary, exactly as in Wordwright's `SUBMIT_GUESS`.
 */
export type StackAction =
  | {
      readonly type: 'START';
      readonly id: string;
      readonly mode: StackMode;
      /** One answer per board, all different (FR-103). */
      readonly answers: readonly string[];
    }
  | { readonly type: 'RESTORE'; readonly state: StackState }
  | { readonly type: 'ADD_LETTER'; readonly letter: string; readonly now: number }
  | { readonly type: 'REMOVE_LETTER' }
  | { readonly type: 'SUBMIT_GUESS'; readonly word: string; readonly now: number }
  | { readonly type: 'REVEAL_COMPLETE'; readonly now: number };

/** Builds a fresh game in `playing` status with one board per answer. */
export function createStackGame(
  id: string,
  mode: StackMode,
  answers: readonly string[],
): StackState {
  return {
    id,
    mode,
    boards: answers.map((answer): StackBoard => ({ answer: answer.toUpperCase(), guesses: [] })),
    words: [],
    currentInput: '',
    status: 'playing',
    startedAt: null,
    finishedAt: null,
  };
}

/** True when a board has a guess equal to its answer, so it takes no more (FR-106). */
function isSolved(board: StackBoard): boolean {
  return board.guesses.some((guess) => guess.word === board.answer);
}

/** True when the game takes input: playing, and not mid-reveal (FR-11). */
function acceptsInput(state: StackState): boolean {
  return state.status === 'playing';
}

/**
 * The WordStack state machine. Pure, synchronous and total.
 *
 * Unknown or illegal actions return the *same reference*, so React skips the
 * re-render and callers can rely on identity comparison.
 *
 * ```
 * START ─▶ playing ──SUBMIT_GUESS──▶ revealing ──REVEAL_COMPLETE──▶ playing
 *                                                       │
 *                          every board solved ─▶ won    └─ limit reached ─▶ lost
 * ```
 */
export function stackReducer(state: StackState, action: StackAction): StackState {
  switch (action.type) {
    case 'START':
      return createStackGame(action.id, action.mode, action.answers);

    case 'RESTORE':
      return action.state;

    case 'ADD_LETTER': {
      if (!acceptsInput(state)) return state;
      // Typing past the row length is ignored silently (FR-7).
      if (state.currentInput.length >= STACK_LENGTH) return state;

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
      if (!acceptsInput(state)) return state;
      if (state.currentInput.length === 0) return state;

      return { ...state, currentInput: state.currentInput.slice(0, -1) };
    }

    case 'SUBMIT_GUESS': {
      if (!acceptsInput(state)) return state;

      const word = action.word.toUpperCase();
      if (word.length !== STACK_LENGTH) return state;
      if (state.words.length >= STACK_MODES[state.mode].maxGuesses) return state;

      // The guess reaches every board that is still open. A solved board is
      // frozen: its remaining rows stay empty (FR-105, FR-106, EC-39).
      const boards = state.boards.map((board): StackBoard => {
        if (isSolved(board)) return board;

        const guess: Guess = { word, evaluation: evaluateGuess(word, board.answer) };
        return { ...board, guesses: [...board.guesses, guess] };
      });

      // The outcome is decided on REVEAL_COMPLETE, so the UI never spoils it (FR-52).
      return {
        ...state,
        boards,
        words: [...state.words, word],
        currentInput: '',
        status: 'revealing',
        startedAt: state.startedAt ?? action.now,
      };
    }

    case 'REVEAL_COMPLETE': {
      if (state.status !== 'revealing') return state;

      // Won on the final allowed guess counts (EC-40), so solving is checked first.
      if (state.boards.every(isSolved)) return { ...state, status: 'won', finishedAt: action.now };
      if (state.words.length >= STACK_MODES[state.mode].maxGuesses) {
        return { ...state, status: 'lost', finishedAt: action.now };
      }

      return { ...state, status: 'playing' };
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
