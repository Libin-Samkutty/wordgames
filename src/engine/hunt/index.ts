/**
 * Public surface of the WordHunt engine (SPEC §22, ARCHITECTURE §3.12).
 *
 * Pure TypeScript under the same rules as the other engines: no React, no DOM,
 * no storage, no timers, no ambient randomness or clock (ADR-003, NFR-19). It
 * reuses WordShuffle's anagram index and tray shuffle and the root engine's
 * `pickAnswer`, and adds the sub-multiset search that finds the words hiding in
 * a tray, the word check and the state machine.
 */

export {
  HUNT_WORD_LENGTHS,
  MAX_REQUIRED,
  MAX_SAVED_WORDS,
  MIN_REQUIRED,
  MIN_WORD_LENGTH,
  TRAY_SIZE,
} from './constants';
export {
  buildPool,
  createPuzzle,
  requiredFor,
  subsetKeys,
  type HuntSources,
  type LengthSource,
  type Puzzle,
} from './puzzle';
export { createHuntGame, huntReducer, type HuntAction } from './reducer';
export {
  foundCount,
  huntRecord,
  isGameOver,
  missedWords,
  requiredCount,
  slotGroups,
  usedPositions,
} from './selectors';
export { isFormableFrom, validateWord, type AcceptedWord } from './validate';

export type { HuntRecord, HuntState, HuntStatus, Slot, SlotGroup, WordError } from './types';
