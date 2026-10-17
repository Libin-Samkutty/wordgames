import { clampDuration } from '@/lib/clock';

import type { RowView, TileView } from '../types';
import type { DodgeRecord, DodgeSession, DodgeState } from './types';

/** True once the game has finished, either way. */
export function isGameOver(state: DodgeState): boolean {
  return state.status === 'won' || state.status === 'gave-up';
}

export function guessesUsed(state: DodgeState): number {
  return state.guesses.length;
}

/** How many answers the game has left to choose from (FR-150). */
export function wordsLeft(state: DodgeState): number {
  return state.candidates.length;
}

/** True when Give up is allowed: a game in play with at least one guess made (FR-152). */
export function canGiveUp(state: DodgeState): boolean {
  return state.status === 'playing' && state.guesses.length > 0;
}

/**
 * The word the game shows after a give up: the first of the words left, in
 * list order. Once the player has won there is one left and it is theirs.
 */
export function revealedWord(state: DodgeState): string {
  return state.candidates[0] ?? '';
}

/**
 * Projects state into the rows the board renders (FR-150). There is no guess
 * limit, so the board has one row per guess, plus the row being typed while the
 * game is in play. It grows as the game goes on.
 */
export function dodgeRows(state: DodgeState): readonly RowView[] {
  const revealingRow = state.status === 'revealing' ? state.guesses.length - 1 : -1;

  const rows = state.guesses.map((guess, rowIndex): RowView => ({
    tiles: guess.evaluation.map((evaluationState, index): TileView => ({
      /* v8 ignore next -- evaluation always has one entry per letter,
               so the index is in range; the fallback satisfies the type only. */
      letter: guess.word[index] ?? '',
      state: evaluationState,
    })),
    isActive: false,
    isRevealing: rowIndex === revealingRow,
  }));

  if (state.status !== 'playing') return rows;

  const active: RowView = {
    tiles: Array.from({ length: state.wordLength }, (_tile, index): TileView => {
      const letter = state.currentInput[index];
      return letter === undefined ? { letter: '', state: 'empty' } : { letter, state: 'filled' };
    }),
    isActive: true,
    isRevealing: false,
  };
  return [...rows, active];
}

/** The part of a game that is saved: everything but the candidates (FR-153). */
export function dodgeSession(state: DodgeState): DodgeSession {
  return {
    id: state.id,
    wordLength: state.wordLength,
    guesses: state.guesses,
    currentInput: state.currentInput,
    status: state.status,
    startedAt: state.startedAt,
    finishedAt: state.finishedAt,
  };
}

/** A finished game for the statistics log (FR-155), or null while it is still in play. */
export function dodgeRecord(state: DodgeState): DodgeRecord | null {
  if (!isGameOver(state)) return null;

  return {
    id: state.id,
    // `finishedAt` is always set by the reducer when the status changes.
    playedAt: state.finishedAt ?? 0,
    length: state.wordLength,
    word: state.status === 'won' ? (state.guesses.at(-1)?.word ?? '') : revealedWord(state),
    guessesUsed: state.guesses.length,
    won: state.status === 'won',
    solveMs: clampDuration((state.finishedAt ?? 0) - (state.startedAt ?? 0)),
    ...(state.guesses[0] ? { opener: state.guesses[0].word } : {}),
  };
}
