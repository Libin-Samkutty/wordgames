import type { HuntState, Slot } from '@/engine/hunt';

function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

/** The word row's accessible name: the letters typed so far, or that it is empty (A11Y-26). */
export function wordRowLabel(state: HuntState): string {
  if (state.currentInput === '') return 'Your word: empty';
  return `Your word: ${state.currentInput}`;
}

/** A tray button's accessible name: its letter, and whether a typed letter is using it. */
export function trayLabel(letter: string, used: boolean): string {
  return used ? `${letter}, used` : letter;
}

/**
 * A slot's accessible name (A11Y-26). A found word is read as the word. A slot
 * not found yet says its length, so a screen reader can count what is left. After
 * a give up, a missed word is read as the word and marked missed.
 */
export function slotLabel(slot: Slot, revealMissed: boolean): string {
  if (slot.found) return slot.word;
  if (revealMissed) return `${slot.word}, missed`;
  return `${plural(slot.word.length, 'letter', 'letters')}, not found`;
}

/** A group's heading: the length and how many of its words are found, such as `4 letters · 3 of 8`. */
export function groupHeading(length: number, slots: readonly Slot[]): string {
  const found = slots.filter((slot) => slot.found).length;
  return `${String(length)} letters · ${String(found)} of ${String(slots.length)}`;
}
