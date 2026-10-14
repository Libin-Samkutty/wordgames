import type { NoteMark } from '@/engine/code';

/**
 * How a note mark looks, on a notes button or a keyboard key (FR-132).
 *
 * The marks are the player's own, so they must not be mistaken for game
 * feedback: no green, yellow or grey. They use the neutral key colours and
 * differ by form, a strike through the letter for ruled out and an underline
 * with a heavy outline for in the word, so they also read in any palette and
 * without colour (A11Y-8).
 */
export function noteStyle(mark: NoteMark | undefined): string {
  if (mark === 'out') {
    return 'bg-surface-sunken text-key-text line-through decoration-2 ring-1 ring-border ring-inset';
  }
  if (mark === 'in') {
    return 'bg-key text-key-text underline decoration-2 underline-offset-4 ring-2 ring-border-strong ring-inset';
  }
  return 'bg-key text-key-text';
}
