/**
 * Public surface of the WordCode engine (SPEC §19, ARCHITECTURE §3.9).
 *
 * Pure TypeScript under the same rules as the other engines: no React, no DOM,
 * no storage, no timers, no ambient randomness or clock (ADR-003, NFR-19). It
 * reuses the root engine's `evaluateGuess`, `validateGuess` and `pickAnswer`,
 * and adds only the bulls-and-cows count, the letter notes and the state machine.
 */

export { CODE_LENGTHS, CODE_MAX_GUESSES, DEFAULT_CODE_LENGTH, NOTE_MARKS } from './constants';
export { codeReducer, createCodeGame, nextNote, type CodeAction } from './reducer';
export { scoreCode } from './score';
export { codeRecord, guessesUsed, isGameOver, noteOf, remainingGuesses } from './selectors';

export type { CodeGuess, CodeRecord, CodeState, CodeStatus, NoteMark, Notes } from './types';
