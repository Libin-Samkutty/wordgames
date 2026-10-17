import { clampDuration } from '@/lib/clock';

import { RANGE_MAX_GUESSES } from './constants';
import type { Heat, RangeGuess, RangeRecord, RangeState } from './types';

/** True once the game has finished, either way. */
export function isGameOver(state: RangeState): boolean {
  return state.status === 'won' || state.status === 'lost';
}

export function guessesUsed(state: RangeState): number {
  return state.guesses.length;
}

export function remainingGuesses(state: RangeState): number {
  return Math.max(0, RANGE_MAX_GUESSES[state.wordLength] - state.guesses.length);
}

/** The heat of the most recent guess, or null before the first guess or after finding the word. */
export function lastHeat(state: RangeState): Heat | null {
  return state.guesses[state.guesses.length - 1]?.heat ?? null;
}

/** The guesses in alphabetical order, as the list shows them (FR-121). */
export function sortedGuesses(state: RangeState): readonly RangeGuess[] {
  return [...state.guesses].sort((a, b) => (a.word < b.word ? -1 : 1));
}

/** Every word already guessed, for the repeat check (FR-117). */
export function guessedWords(state: RangeState): readonly string[] {
  return state.guesses.map((guess) => guess.word);
}

/** The 1-based guess that was Burning, or the secret itself, or null if none was. */
export function firstBurningGuess(state: RangeState): number | null {
  const index = state.guesses.findIndex(
    (guess) => guess.heat === 'burning' || guess.direction === null,
  );
  return index === -1 ? null : index + 1;
}

/** A finished game for the statistics log (FR-124), or null while it is still in play. */
export function rangeRecord(state: RangeState): RangeRecord | null {
  if (!isGameOver(state)) return null;

  return {
    id: state.id,
    // `finishedAt` is always set by the reducer when the status changes.
    playedAt: state.finishedAt ?? 0,
    secret: state.secret,
    guessesUsed: state.guesses.length,
    won: state.status === 'won',
    wordLength: state.wordLength,
    solveMs: clampDuration((state.finishedAt ?? 0) - (state.startedAt ?? 0)),
    firstBurningGuess: firstBurningGuess(state),
    ...(state.guesses[0] ? { opener: state.guesses[0].word } : {}),
  };
}
