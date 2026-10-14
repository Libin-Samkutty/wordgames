import { MAX_HINTS } from './constants';
import type { ShuffleRecord, ShuffleState } from './types';

/** True once the puzzle has ended, either way. */
export function isGameOver(state: ShuffleState): boolean {
  return state.status === 'solved' || state.status === 'gave-up';
}

export function hintsUsed(state: ShuffleState): number {
  return state.hinted.length;
}

export function hintsLeft(state: ShuffleState): number {
  return Math.max(0, MAX_HINTS - state.hinted.length);
}

/** True while a hint can still be taken (FR-142). */
export function canHint(state: ShuffleState): boolean {
  return state.status === 'playing' && state.hinted.length < MAX_HINTS;
}

/** True when the answer row holds no letter the player placed: nothing to lose by a new puzzle. */
export function hasInput(state: ShuffleState): boolean {
  return state.hinted.length > 0 || state.slots.some((slot) => slot !== null);
}

/** The valid anagrams other than the word shown, for the result panel (FR-145). */
export function otherAnagrams(state: ShuffleState): readonly string[] {
  const shown = state.found ?? state.target;
  return state.anagrams.filter((word) => word !== shown);
}

/** How many copies of a letter are left in the tray, for the button labels (A11Y-24). */
export function remainingOf(state: ShuffleState, letter: string): number {
  return state.tray.filter((candidate) => candidate === letter).length;
}

/**
 * The finished puzzle as a statistics record (FR-146), or null while it is
 * still in play. A puzzle that was abandoned never reaches `solved` or
 * `gave-up`, so it is never recorded.
 */
export function shuffleRecord(state: ShuffleState): ShuffleRecord | null {
  if (!isGameOver(state)) return null;

  return {
    id: state.id,
    playedAt: state.finishedAt ?? 0,
    length: state.wordLength,
    target: state.target,
    found: state.found,
    hintsUsed: state.hinted.length,
    solved: state.status === 'solved',
  };
}
