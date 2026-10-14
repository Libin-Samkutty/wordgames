/**
 * Public surface of the WordStack engine (SPEC §17, ARCHITECTURE §3.7).
 *
 * Pure TypeScript under the same rules as the other engines: no React, no DOM,
 * no storage, no timers, no ambient randomness or clock (ADR-003, NFR-19). It
 * reuses the root engine's `evaluateGuess`, `validateGuess`, `deriveKeyStates`
 * and `pickAnswer`, and adds only the multi-board state machine.
 */

export { pickAnswers } from './answers';
export { DEFAULT_STACK_MODE, STACK_LENGTH, STACK_MODES, STACK_MODE_IDS } from './constants';
export { createStackGame, stackReducer, type StackAction } from './reducer';
export {
  boardKeyStates,
  boardRows,
  boardStatus,
  boardsSolved,
  guessesUsed,
  isGameOver,
  maxGuesses,
  remainingGuesses,
  stackRecord,
  unsolvedAnswers,
} from './selectors';

export type {
  BoardStatus,
  StackBoard,
  StackMode,
  StackRecord,
  StackState,
  StackStatus,
} from './types';
