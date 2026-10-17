/**
 * Public surface of the WordHang engine (SPEC §23, ARCHITECTURE §3.13).
 *
 * Pure TypeScript under the same rules as the other engines: no React, no DOM,
 * no storage, no timers, no ambient randomness or clock (ADR-003, NFR-19). It
 * reuses the root engine's `pickAnswer`, and adds the letter-by-letter state
 * machine.
 */

export { DEFAULT_HANG_LENGTH, HANG_LENGTHS, MAX_MISSES } from './constants';
export { createHangGame, hangReducer, type HangAction } from './reducer';
export {
  hangRecord,
  isGameOver,
  isSolved,
  letterStates,
  maskedWord,
  misses,
  missedLetters,
  missesLeft,
  occurrences,
} from './selectors';

export type { HangRecord, HangState, HangStatus } from './types';
