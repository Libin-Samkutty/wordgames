import type { NoteMark } from '@/engine/code';

/** What a note mark is called, for button names and the help text (A11Y-23). */
export function noteName(mark: NoteMark | undefined): string {
  if (mark === 'out') return 'ruled out';
  if (mark === 'in') return 'in the word';
  return 'unmarked';
}

/** The accessible name of a letter's note button or key, such as "P, ruled out". */
export function noteLabel(letter: string, mark: NoteMark | undefined): string {
  return `${letter}, ${noteName(mark)}`;
}

/** `1 bull`, `3 cows`: the count as the screen shows and reads it (FR-131). */
export function countLabel(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}
