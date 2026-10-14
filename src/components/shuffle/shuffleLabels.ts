import { remainingOf, type ShuffleState } from '@/engine/shuffle';

/**
 * The accessible name of the answer row (A11Y-24): each position's letter, with
 * a hinted one marked, and `empty` for a gap, such as
 * `Your answer: L (hinted), S, empty, empty, empty, empty`.
 */
export function answerLabel(state: ShuffleState): string {
  const parts = state.slots.map((slot, index) => {
    if (slot === null) return 'empty';
    return state.hinted.includes(index) ? `${slot} (hinted)` : slot;
  });

  return `Your answer: ${parts.join(', ')}`;
}

/** The label of one tray button (A11Y-24): the letter and how many copies are left. */
export function trayLabel(state: ShuffleState, letter: string): string {
  return `${letter}, ${String(remainingOf(state, letter))} left`;
}
