import { buildLadderGraph } from '../graph';

/**
 * A small hand-built ladder graph for the engine tests, so every expectation
 * can be checked by eye (the engine tests use fixtures, not the real lists).
 *
 *   BOLD ─ COLD ─ CORD ─┬─ CARD ─ WARD ─┬─ WARM
 *                       └─ WORD ────────┤
 *                            └─ WORM ───┘      (WORD also joins WARD and WORM)
 *   LAKE ─ LAKS                               a separate group
 *
 * COLD → WARM has par 4, by three equally short paths:
 *   A  COLD CORD CARD WARD WARM
 *   B  COLD CORD WORD WORM WARM
 *   C  COLD CORD WORD WARD WARM
 * Distance to WARM: WARM 0, WARD and WORM 1, CARD and WORD 2, CORD 3, COLD 4.
 */
export const LADDER_WORDS = [
  'BOLD',
  'CARD',
  'COLD',
  'CORD',
  'LAKE',
  'LAKS',
  'WARD',
  'WARM',
  'WORD',
  'WORM',
] as const;

export const graph = buildLadderGraph(LADDER_WORDS);

export const PATH_A = ['COLD', 'CORD', 'CARD', 'WARD', 'WARM'] as const;
export const PATH_B = ['COLD', 'CORD', 'WORD', 'WORM', 'WARM'] as const;
export const PATH_C = ['COLD', 'CORD', 'WORD', 'WARD', 'WARM'] as const;

/** Words a player may type: the ladder words plus a few that are only guessable. */
export const GUESSABLE = new Set<string>([...LADDER_WORDS, 'CORE', 'CARE', 'BOOK', 'BOOT', 'BOKO']);
