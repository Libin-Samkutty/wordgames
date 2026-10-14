import type { WordLength } from '../types';
import { CODE_MAX_GUESSES, NOTE_MARKS } from './constants';
import { scoreCode } from './score';
import type { CodeState, NoteMark } from './types';

/**
 * Actions the game accepts (ARCHITECTURE §3.9).
 *
 * `now` is passed in rather than read from the clock, keeping the reducer pure
 * (ADR-003). `SUBMIT_GUESS` carries an already-validated word: dictionary lookup
 * happens in the provider, because the engine may not depend on the dictionary.
 */
export type CodeAction =
  | {
      readonly type: 'START';
      readonly id: string;
      readonly wordLength: WordLength;
      readonly secret: string;
    }
  | { readonly type: 'RESTORE'; readonly state: CodeState }
  | { readonly type: 'ADD_LETTER'; readonly letter: string; readonly now: number }
  | { readonly type: 'REMOVE_LETTER' }
  | { readonly type: 'SUBMIT_GUESS'; readonly word: string; readonly now: number }
  | { readonly type: 'CYCLE_NOTE'; readonly letter: string };

/** Builds a fresh game in `playing` status with a clean notepad. */
export function createCodeGame(id: string, wordLength: WordLength, secret: string): CodeState {
  return {
    id,
    wordLength,
    secret: secret.toUpperCase(),
    guesses: [],
    currentInput: '',
    notes: {},
    status: 'playing',
    startedAt: null,
    finishedAt: null,
  };
}

/** The mark a press moves a letter to: unmarked, then each mark in turn, then unmarked (FR-132). */
export function nextNote(current: NoteMark | undefined): NoteMark | undefined {
  if (current === undefined) return NOTE_MARKS[0];
  return NOTE_MARKS[NOTE_MARKS.indexOf(current) + 1];
}

/**
 * The WordCode state machine. Pure, synchronous and total. There is no reveal
 * state: a guess is scored the moment it is submitted.
 *
 * Unknown or illegal actions return the *same reference*, so React skips the
 * re-render and callers can rely on identity comparison.
 */
export function codeReducer(state: CodeState, action: CodeAction): CodeState {
  switch (action.type) {
    case 'START':
      return createCodeGame(action.id, action.wordLength, action.secret);

    case 'RESTORE':
      return action.state;

    case 'ADD_LETTER': {
      if (state.status !== 'playing') return state;
      // Typing past the row length is ignored silently (FR-128, FR-7).
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
      if (state.guesses.length >= CODE_MAX_GUESSES) return state;

      const { bulls, cows } = scoreCode(word, state.secret);
      const guesses = [...state.guesses, { word, bulls, cows }];
      const won = bulls === state.wordLength;
      const lost = !won && guesses.length >= CODE_MAX_GUESSES;

      return {
        ...state,
        guesses,
        currentInput: '',
        status: won ? 'won' : lost ? 'lost' : 'playing',
        startedAt: state.startedAt ?? action.now,
        finishedAt: won || lost ? action.now : null,
      };
    }

    case 'CYCLE_NOTE': {
      // The notes are the player's own: a guess never sets them (FR-132).
      if (state.status !== 'playing') return state;

      const letter = action.letter.toUpperCase();
      if (!/^[A-Z]$/.test(letter)) return state;

      const next = nextNote(state.notes[letter]);
      const others = Object.entries(state.notes).filter(([key]) => key !== letter);

      return {
        ...state,
        notes: Object.fromEntries(next === undefined ? others : [...others, [letter, next]]),
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
