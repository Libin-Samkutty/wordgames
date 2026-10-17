/**
 * Public surface of the WordDodge engine (SPEC §21, ARCHITECTURE §3.11).
 *
 * Pure TypeScript under the same rules as the other engines: no React, no DOM,
 * no storage, no timers, no ambient randomness or clock (ADR-003, NFR-19). It
 * reuses the root engine's `evaluateGuess` and `validateGuess`, and adds the
 * adversary, which answers each guess with the colours that keep the most words
 * possible, and the state machine.
 */

export { chooseReply, isAllCorrect, type Reply } from './adversary';
export {
  DEFAULT_DODGE_LENGTH,
  DISTRIBUTION_BUCKETS,
  DISTRIBUTION_FIRST,
  DODGE_LENGTHS,
  MAX_SAVED_GUESSES,
  distributionIndex,
  distributionLabels,
} from './constants';
export { candidatePool } from './pool';
export { createDodgeGame, dodgeReducer, restoreGame, type DodgeAction } from './reducer';
export {
  canGiveUp,
  dodgeRecord,
  dodgeRows,
  dodgeSession,
  guessesUsed,
  isGameOver,
  revealedWord,
  wordsLeft,
} from './selectors';

export type { DodgeGuess, DodgeRecord, DodgeSession, DodgeState, DodgeStatus } from './types';
