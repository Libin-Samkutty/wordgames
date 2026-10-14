import { clampDuration } from '@/lib/clock';

import { CODE_MAX_GUESSES } from './constants';
import type { CodeRecord, CodeState, NoteMark } from './types';

/** True once the game has finished, either way. */
export function isGameOver(state: CodeState): boolean {
  return state.status === 'won' || state.status === 'lost';
}

export function guessesUsed(state: CodeState): number {
  return state.guesses.length;
}

export function remainingGuesses(state: CodeState): number {
  return Math.max(0, CODE_MAX_GUESSES - state.guesses.length);
}

/** The player's mark on a letter, or undefined when it is unmarked. */
export function noteOf(state: CodeState, letter: string): NoteMark | undefined {
  return state.notes[letter.toUpperCase()];
}

/** The 1-based guess on which every letter was known (bulls plus cows), or null. */
export function lettersFoundAt(state: CodeState): number | null {
  const index = state.guesses.findIndex((guess) => guess.bulls + guess.cows === state.wordLength);
  return index === -1 ? null : index + 1;
}

/**
 * The finished game as a statistics record (FR-134), or null while it is still
 * in play. A game that was abandoned never reaches `won` or `lost`, so it is
 * never recorded.
 */
export function codeRecord(state: CodeState): CodeRecord | null {
  if (!isGameOver(state)) return null;

  return {
    id: state.id,
    playedAt: state.finishedAt ?? 0,
    length: state.wordLength,
    secret: state.secret,
    guessesUsed: state.guesses.length,
    won: state.status === 'won',
    solveMs: clampDuration((state.finishedAt ?? 0) - (state.startedAt ?? 0)),
    lettersFoundAt: lettersFoundAt(state),
    usedNotes: Object.keys(state.notes).length > 0,
    ...(state.guesses[0] ? { opener: state.guesses[0].word } : {}),
  };
}
