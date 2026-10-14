import type { NoteMark } from '@/engine/code';

/**
 * How a note mark looks on a keyboard key (FR-132).
 *
 * The marks are the player's own, so they must not be mistaken for game
 * feedback: no green, yellow or grey. They use the neutral key colours and
 * differ by form, a dimmed key with a dashed outline for ruled out and a solid
 * heavy outline for in the word. Each also carries a corner glyph, so the marks
 * read in any palette and without colour (A11Y-8).
 */
export function noteStyle(mark: NoteMark | undefined): string {
  if (mark === 'out') {
    return 'bg-surface-sunken text-text-muted outline-2 -outline-offset-2 outline-dashed outline-border-strong';
  }
  if (mark === 'in') {
    return 'bg-key text-key-text outline-2 -outline-offset-2 outline-solid outline-text';
  }
  return 'bg-key text-key-text';
}

/** The corner glyph that repeats a mark in text form. */
export const NOTE_GLYPH: Record<NoteMark, string> = { out: '×', in: '●' };
