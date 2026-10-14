import type { LetterState } from '@/engine';

/** One board's view of a letter: its best state, or null for a solved board (FR-109). */
export type SegmentState = LetterState | null | undefined;

/** What each state means in words, for the accessible name (A11Y-20). */
function describe(state: SegmentState): string {
  if (state === null) return 'solved';
  if (state === undefined) return 'unused';
  return state;
}

/** The accessible name, listing every board: "A: board 1 present, board 2 absent, …" (A11Y-20). */
export function splitKeyLabel(letter: string, segments: readonly SegmentState[]): string {
  const boards = segments.map((state, index) => `board ${String(index + 1)} ${describe(state)}`);
  return `${letter}: ${boards.join(', ')}`;
}
