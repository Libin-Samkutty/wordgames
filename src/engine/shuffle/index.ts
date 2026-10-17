/**
 * Public surface of the WordShuffle engine (SPEC §20, ARCHITECTURE §3.10).
 *
 * Pure TypeScript under the same rules as the other engines: no React, no DOM,
 * no storage, no timers, no ambient randomness or clock (ADR-003, NFR-19). It
 * reuses the root engine's `pickAnswer`, `pickRandom` and `RandomSource`, and
 * adds the anagram index, the scramble, the answer check and the state machine.
 */

export { anagramKey, anagramsOf, buildAnagramIndex, type AnagramIndex } from './anagram';
export {
  DEFAULT_SHUFFLE_LENGTH,
  MAX_HINTS,
  SHUFFLE_LENGTHS,
  TIME_BUCKET_COUNT,
  TIME_BUCKET_LIMITS_MS,
  timeBucketIndex,
} from './constants';
export { createShuffleGame, shuffleReducer, type ShuffleAction } from './reducer';
export {
  createPuzzle,
  makeScramble,
  shuffleLetters,
  type PuzzleLists,
  type ShuffleAvoid,
} from './scramble';
export {
  canHint,
  hasInput,
  hintsLeft,
  hintsUsed,
  isGameOver,
  otherAnagrams,
  remainingOf,
  shuffleRecord,
} from './selectors';
export { validateAnswer, type AnswerContext } from './validate';

export type { AnswerError, ShuffleRecord, ShuffleState, ShuffleStatus } from './types';
