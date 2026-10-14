/**
 * Public surface of the WordWeaver engine (SPEC §15, ARCHITECTURE §3.6).
 *
 * Pure TypeScript under the same rules as the Wordwright engine: no React, no
 * DOM, no storage, no timers, no ambient randomness or clock (ADR-003,
 * NFR-16). The dictionary, the graph and the clock all arrive as parameters.
 */

export { distancesFrom, distanceTo, shortestLadder, UNREACHABLE } from './bfs';
export {
  DEFAULT_WEAVER_LENGTH,
  FALLBACK_MIN_PAR,
  MAX_MOVES,
  MAX_START_ATTEMPTS,
  PAR_BAND,
  RECENT_START_WINDOW,
  WEAVER_LENGTHS,
} from './constants';
export { evaluateRung } from './evaluate';
export { generatePuzzle, type GenerateOptions } from './generate';
export { buildLadderGraph, type LadderGraph } from './graph';
export { createWeaverGame, weaverReducer, type WeaverAction } from './reducer';
export {
  canUndo,
  isGameOver,
  isParHit,
  ladderRows,
  moveLimitReached,
  overPar,
  previousWord,
  resultSummary,
  usedWords,
  weaverRecord,
} from './selectors';
export { differsByOneLetter, validateRung, type RungContext } from './validate';

export type {
  GenerateError,
  LadderRowKind,
  LadderRowView,
  LadderTileView,
  Puzzle,
  ResultSummary,
  Rung,
  RungError,
  RungEvaluation,
  RungState,
  WeaverLength,
  WeaverRecord,
  WeaverState,
  WeaverStatus,
} from './types';
