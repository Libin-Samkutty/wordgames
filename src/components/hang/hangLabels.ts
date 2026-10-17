import { isGameOver, MAX_MISSES, misses, type HangState } from '@/engine/hang';
import { spokenWord } from '@/state/hang/announcements';

/**
 * The word's accessible name (A11Y-27): the revealed letters with "blank" for
 * each hidden one while the game is on, and the whole word once it is over.
 */
export function wordLabel(state: HangState): string {
  return isGameOver(state) ? `Word: ${state.secret}` : `Word: ${spokenWord(state)}`;
}

/** The misses as text, so the figure never carries the count alone (A11Y-27). */
export function missesLabel(state: HangState): string {
  return `${String(misses(state))} of ${String(MAX_MISSES)} misses`;
}

/**
 * A letter key's accessible name: just the letter before it is tried, then
 * whether it was in the word.
 */
export function keyLabel(letter: string, tried: 'in' | 'out' | undefined): string {
  if (tried === 'in') return `${letter}, in the word`;
  if (tried === 'out') return `${letter}, not in the word`;
  return letter;
}
