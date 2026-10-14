import type { RungEvaluation } from './types';

/**
 * Scores a rung against the end word, one state per position (FR-81, ADR-026).
 *
 * A letter is `correct` when it matches the end word in the same position and
 * `absent` otherwise. There is no `present`: the end word is always visible,
 * so "this letter is somewhere in the target" would add noise, not information.
 * The start row is scored the same way, and the end word scores all `correct`.
 */
export function evaluateRung(rung: string, end: string): RungEvaluation {
  return Array.from(rung, (letter, position) => (letter === end[position] ? 'correct' : 'absent'));
}
