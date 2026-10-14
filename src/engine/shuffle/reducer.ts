import type { WordLength } from '../types';
import { anagramKey } from './anagram';
import { MAX_HINTS } from './constants';
import type { ShuffleState } from './types';

/**
 * Actions the puzzle accepts (ARCHITECTURE §3.10).
 *
 * `now` is passed in rather than read from the clock, keeping the reducer pure
 * (ADR-003). The dictionary-dependent parts arrive as data: `SUBMIT_ANSWER`
 * carries a word that already passed `validateAnswer` and the anagram list for
 * its letters, and `RESHUFFLE` carries the new tray order from `shuffleLetters`.
 */
export type ShuffleAction =
  | {
      readonly type: 'START';
      readonly id: string;
      readonly wordLength: WordLength;
      readonly target: string;
      readonly scramble: string;
    }
  | { readonly type: 'RESTORE'; readonly state: ShuffleState }
  /** Typed or tapped: moves one copy of the letter from the tray into the row (FR-139). */
  | { readonly type: 'ADD_LETTER'; readonly letter: string; readonly now: number }
  | { readonly type: 'REMOVE_LETTER' }
  | { readonly type: 'RESHUFFLE'; readonly tray: readonly string[] }
  | { readonly type: 'HINT'; readonly now: number }
  | {
      readonly type: 'SUBMIT_ANSWER';
      readonly word: string;
      readonly anagrams: readonly string[];
      readonly now: number;
    }
  | { readonly type: 'GIVE_UP'; readonly anagrams: readonly string[]; readonly now: number };

/** Builds a fresh puzzle in `playing` status: every letter in the tray, an empty row. */
export function createShuffleGame(
  id: string,
  wordLength: WordLength,
  target: string,
  scramble: string,
): ShuffleState {
  return {
    id,
    wordLength,
    target: target.toUpperCase(),
    scramble: scramble.toUpperCase(),
    tray: [...scramble.toUpperCase()],
    slots: Array.from({ length: wordLength }, () => null),
    hinted: [],
    status: 'playing',
    found: null,
    anagrams: [],
    startedAt: null,
    finishedAt: null,
  };
}

/** The same letters in any order, compared as sorted strings. */
function sameLetters(a: readonly string[], b: readonly string[]): boolean {
  return anagramKey(a.join('')) === anagramKey(b.join(''));
}

/**
 * The WordShuffle state machine. Pure, synchronous and total. There is no
 * reveal state, no guess limit and no clock beyond the first keystroke.
 *
 * Unknown or illegal actions return the *same reference*, so React skips the
 * re-render and callers can rely on identity comparison.
 */
export function shuffleReducer(state: ShuffleState, action: ShuffleAction): ShuffleState {
  switch (action.type) {
    case 'START':
      return createShuffleGame(action.id, action.wordLength, action.target, action.scramble);

    case 'RESTORE':
      return action.state;

    case 'ADD_LETTER': {
      if (state.status !== 'playing') return state;

      const letter = action.letter.toUpperCase();
      // A letter that is not left in the tray is ignored, with no toast (FR-139, EC-46).
      const fromTray = state.tray.indexOf(letter);
      if (fromTray === -1) return state;

      // The leftmost empty position, which skips every locked one (FR-142).
      const position = state.slots.indexOf(null);
      if (position === -1) return state;

      return {
        ...state,
        tray: state.tray.filter((_, index) => index !== fromTray),
        slots: state.slots.map((slot, index) => (index === position ? letter : slot)),
        startedAt: state.startedAt ?? action.now,
      };
    }

    case 'REMOVE_LETTER': {
      if (state.status !== 'playing') return state;

      // The rightmost typed letter. A locked letter is never removed (FR-142).
      const position = state.slots.findLastIndex(
        (slot, index) => slot !== null && !state.hinted.includes(index),
      );
      if (position === -1) return state;

      return {
        ...state,
        tray: [...state.tray, state.slots[position] as string],
        slots: state.slots.map((slot, index) => (index === position ? null : slot)),
      };
    }

    case 'RESHUFFLE': {
      if (state.status !== 'playing') return state;
      // Only the letters left in the tray reorder, and none may be gained or lost (FR-143).
      if (!sameLetters(action.tray, state.tray)) return state;

      return { ...state, tray: [...action.tray] };
    }

    case 'HINT': {
      if (state.status !== 'playing') return state;
      if (state.hinted.length >= MAX_HINTS) return state;

      // The leftmost position that is not already fixed (FR-142).
      const position = state.slots.findIndex((_, index) => !state.hinted.includes(index));

      // Typed letters go back to the tray first, so the hinted letter is always
      // available and never collides with one the player has placed.
      const returned = state.slots.filter(
        (slot, index): slot is string => slot !== null && !state.hinted.includes(index),
      );
      const tray = [...state.tray, ...returned];

      const letter = state.target[position] as string;
      const fromTray = tray.indexOf(letter);

      return {
        ...state,
        tray: tray.filter((_, index) => index !== fromTray),
        slots: state.slots.map((slot, index) => {
          if (index === position) return letter;
          return state.hinted.includes(index) ? slot : null;
        }),
        hinted: [...state.hinted, position].sort((a, b) => a - b),
        startedAt: state.startedAt ?? action.now,
      };
    }

    case 'SUBMIT_ANSWER': {
      if (state.status !== 'playing') return state;

      const word = action.word.toUpperCase();
      // The answer is the row as it stands, and a row with a gap is not an answer.
      if (word.length !== state.wordLength || state.slots.join('') !== word) return state;
      // Guard: an answer that moves a hinted letter never solves (FR-140, EC-48).
      if (state.hinted.some((position) => word[position] !== state.target[position])) return state;

      return {
        ...state,
        status: 'solved',
        found: word,
        anagrams: [...action.anagrams],
        finishedAt: action.now,
      };
    }

    case 'GIVE_UP': {
      if (state.status !== 'playing') return state;

      return {
        ...state,
        status: 'gave-up',
        anagrams: [...action.anagrams],
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
