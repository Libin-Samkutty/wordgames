/**
 * Public surface of the WordRange engine (SPEC §18, ARCHITECTURE §3.8).
 *
 * Pure TypeScript under the same rules as the other engines: no React, no DOM,
 * no storage, no timers, no ambient randomness or clock (ADR-003, NFR-19). It
 * reuses the root engine's `validateGuess` and `pickAnswer`, and adds only the
 * range state machine and the list-distance heat.
 */

export {
  HEAT_BANDS,
  HEAT_LEVELS,
  LOWER_SENTINEL,
  RANGE_LENGTH,
  RANGE_MAX_GUESSES,
  UPPER_SENTINEL,
} from './constants';
export { heatOf, listDistance, listIndex } from './heat';
export { createRangeGame, rangeReducer, type RangeAction } from './reducer';
export {
  guessedWords,
  guessesUsed,
  isGameOver,
  lastHeat,
  rangeRecord,
  remainingGuesses,
  sortedGuesses,
} from './selectors';
export { validateRangeGuess, type RangeContext } from './validate';

export type {
  Heat,
  RangeDirection,
  RangeError,
  RangeGuess,
  RangeRecord,
  RangeState,
  RangeStatus,
} from './types';
