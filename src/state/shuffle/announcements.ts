import { hintsLeft, hintsUsed, type ShuffleState } from '@/engine/shuffle';

function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

/**
 * The polite message after a hint (A11Y-24):
 *
 *   `Hint: letter 1 is L. 1 hint left.`
 *
 * The letter and its place come first, then how many hints remain, so a screen
 * reader user hears what was fixed before what is left.
 *
 * @param state The state after the hint was taken.
 */
export function hintAnnouncement(state: ShuffleState): string {
  const position = state.hinted[state.hinted.length - 1];
  if (position === undefined) return '';

  const left = hintsLeft(state);
  return (
    `Hint: letter ${String(position + 1)} is ${state.target[position] ?? ''}. ` +
    (left === 0 ? 'No hints left.' : `${plural(left, 'hint', 'hints')} left.`)
  );
}

/** The polite message after a reshuffle (A11Y-24): the new order of the letters left. */
export function reshuffleAnnouncement(state: ShuffleState): string {
  return `Letters reshuffled: ${state.tray.join(', ')}.`;
}

/** The polite message when the puzzle is solved (A11Y-24, A11Y-3). */
export function solveAnnouncement(state: ShuffleState): string {
  const used = hintsUsed(state);

  return (
    `Solved with ${state.found ?? ''}. ` +
    (used === 0 ? 'No hints used.' : `${plural(used, 'hint', 'hints')} used.`)
  );
}

/** The polite message when the player gives up (A11Y-3). */
export function giveUpAnnouncement(state: ShuffleState): string {
  return `Gave up. The word was ${state.target}.`;
}
