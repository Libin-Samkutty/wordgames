import { clampDuration } from '@/lib/clock';

import type { LetterState } from '../types';
import { MAX_MISSES } from './constants';
import type { HangRecord, HangState } from './types';

/** True once the game has finished, either way. */
export function isGameOver(state: HangState): boolean {
  return state.status === 'won' || state.status === 'lost';
}

/** The letters tried that are not in the secret, in the order they were tried (FR-170). */
export function missedLetters(state: HangState): readonly string[] {
  return [...state.tried].filter((letter) => !state.secret.includes(letter));
}

export function misses(state: HangState): number {
  return missedLetters(state).length;
}

export function missesLeft(state: HangState): number {
  return Math.max(0, MAX_MISSES - misses(state));
}

/** True when every letter of the secret has been tried. */
export function isSolved(state: HangState): boolean {
  return [...state.secret].every((letter) => state.tried.includes(letter));
}

/**
 * The secret as one entry per position: the letter if it has been tried, or
 * null while it is hidden (FR-170).
 */
export function maskedWord(state: HangState): readonly (string | null)[] {
  return [...state.secret].map((letter) => (state.tried.includes(letter) ? letter : null));
}

/** How many times `letter` appears in the secret. */
export function occurrences(state: HangState, letter: string): number {
  return [...state.secret].filter((candidate) => candidate === letter).length;
}

/**
 * Each tried letter as `correct` if it is in the word and `absent` if not, for
 * the on-screen keyboard (FR-170). An untried letter has no entry.
 */
export function letterStates(state: HangState): ReadonlyMap<string, LetterState> {
  return new Map(
    [...state.tried].map((letter): [string, LetterState] => [
      letter,
      state.secret.includes(letter) ? 'correct' : 'absent',
    ]),
  );
}

/** A finished game for the statistics log (FR-174), or null while it is still in play. */
export function hangRecord(state: HangState): HangRecord | null {
  if (!isGameOver(state)) return null;

  return {
    id: state.id,
    // `finishedAt` is always set by the reducer when the status changes.
    playedAt: state.finishedAt ?? 0,
    length: state.wordLength,
    secret: state.secret,
    misses: misses(state),
    won: state.status === 'won',
    solveMs: clampDuration((state.finishedAt ?? 0) - (state.startedAt ?? 0)),
  };
}
