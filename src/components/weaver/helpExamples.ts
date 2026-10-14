import type { WeaverLength } from '@/engine/weaver';

export interface WorkedExample {
  readonly start: string;
  readonly rungs: readonly string[];
  readonly end: string;
}

/**
 * Illustration ladders, one per supported length (FR-95).
 *
 * Purely decorative and never looked up in the dictionary, so the dialog works
 * while a word list is still loading. Typed as `Record<WeaverLength, …>` so
 * adding a length fails the build until an entry exists. Each is a real ladder
 * (one letter per step), and the colours are computed from the engine's own
 * `evaluateRung`, so the example can never disagree with the game.
 */
export const WEAVER_HELP_EXAMPLES: Record<WeaverLength, WorkedExample> = {
  4: { start: 'COLD', rungs: ['CORD', 'CARD'], end: 'WARM' },
  5: { start: 'CRANE', rungs: ['CRATE', 'GRATE'], end: 'GRAPH' },
};
