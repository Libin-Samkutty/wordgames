import { clampDuration } from '@/lib/clock';

import { deriveKeyStates } from '../keyboardState';
import type { LetterState, RowView, TileView } from '../types';
import { STACK_LENGTH, STACK_MODES } from './constants';
import type { BoardStatus, StackBoard, StackRecord, StackState } from './types';

/** True once the game has finished, either way. */
export function isGameOver(state: StackState): boolean {
  return state.status === 'won' || state.status === 'lost';
}

/** Guesses allowed in this game's mode. */
export function maxGuesses(state: StackState): number {
  return STACK_MODES[state.mode].maxGuesses;
}

export function guessesUsed(state: StackState): number {
  return state.words.length;
}

export function remainingGuesses(state: StackState): number {
  return Math.max(0, maxGuesses(state) - state.words.length);
}

/**
 * The guesses that have finished revealing, for one board.
 *
 * While a row is flipping, the guess that is flipping must not yet reveal a
 * solve, or the "Solved" mark and the blank key segments would spoil the
 * result before the animation ends (FR-52).
 */
function settledGuesses(state: StackState, board: StackBoard): StackBoard['guesses'] {
  const revealing = state.status === 'revealing' && board.guesses.length === state.words.length;
  return revealing ? board.guesses.slice(0, -1) : board.guesses;
}

function solvedOnSettled(state: StackState, board: StackBoard): boolean {
  return settledGuesses(state, board).some((guess) => guess.word === board.answer);
}

/**
 * Where a board stands: `solved` once a settled guess equals its answer,
 * `failed` once the game is lost with it unsolved, `playing` otherwise.
 */
export function boardStatus(state: StackState, boardIndex: number): BoardStatus {
  const board = state.boards[boardIndex];
  if (!board) return 'playing';
  if (solvedOnSettled(state, board)) return 'solved';
  return state.status === 'lost' ? 'failed' : 'playing';
}

/** How many boards are solved (FR-110). */
export function boardsSolved(state: StackState): number {
  return state.boards.filter((board) => solvedOnSettled(state, board)).length;
}

/** The answers still unsolved, for the result of a lost game (FR-107). */
export function unsolvedAnswers(state: StackState): readonly string[] {
  return state.boards
    .filter((board) => !solvedOnSettled(state, board))
    .map((board) => board.answer);
}

/**
 * Projects one board into the grid it renders: always `maxGuesses` rows of
 * five tiles, so the layout never reflows (FR-108). A solved board's rows after
 * its solve stay empty (FR-106). Every open board shows the letters being typed
 * in its active row, because a guess goes to all of them.
 */
export function boardRows(state: StackState, boardIndex: number): readonly RowView[] {
  const board = state.boards[boardIndex];
  const rows = maxGuesses(state);
  const solved = board ? solvedOnSettled(state, board) : false;
  const revealingRow = state.status === 'revealing' ? state.words.length - 1 : -1;
  const activeRow = state.words.length;

  return Array.from({ length: rows }, (_unused, rowIndex): RowView => {
    const guess = board?.guesses[rowIndex];

    if (guess) {
      return {
        tiles: guess.evaluation.map((state, column): TileView => ({
          letter: guess.word.charAt(column),
          state,
        })),
        isActive: false,
        isRevealing: rowIndex === revealingRow,
      };
    }

    const isActive = rowIndex === activeRow && !solved && !isGameOver(state);
    const input = isActive ? state.currentInput : '';

    return {
      tiles: Array.from({ length: STACK_LENGTH }, (_tile, column): TileView => {
        const letter = input[column];
        return letter === undefined ? { letter: '', state: 'empty' } : { letter, state: 'filled' };
      }),
      isActive,
      isRevealing: false,
    };
  });
}

/**
 * The best-known state per letter, one entry per board (FR-109).
 *
 * `null` for a solved board, whose key segment is blank. Derived on demand
 * from the guesses, so the keyboard can never drift from the boards.
 */
export function boardKeyStates(
  state: StackState,
): readonly (ReadonlyMap<string, LetterState> | null)[] {
  return state.boards.map((board) =>
    solvedOnSettled(state, board) ? null : deriveKeyStates(settledGuesses(state, board)),
  );
}

/** Per board, the 1-based guess that solved it, or null if it never was. */
export function boardSolveGuesses(state: StackState): readonly (number | null)[] {
  return state.boards.map((board) => {
    const index = board.guesses.findIndex((guess) => guess.word === board.answer);
    return index === -1 ? null : index + 1;
  });
}

/** A finished game for the statistics log (FR-111), or null while it is still in play. */
export function stackRecord(state: StackState): StackRecord | null {
  if (!isGameOver(state)) return null;

  return {
    id: state.id,
    // `finishedAt` is always set by the reducer when the status changes.
    playedAt: state.finishedAt ?? 0,
    mode: state.mode,
    answers: state.boards.map((board) => board.answer),
    guessesUsed: state.words.length,
    boardsSolved: boardsSolved(state),
    won: state.status === 'won',
    solveMs: clampDuration((state.finishedAt ?? 0) - (state.startedAt ?? 0)),
    boardSolveGuesses: boardSolveGuesses(state),
  };
}
