import { clampDuration } from '@/lib/clock';

import { HUNT_WORD_LENGTHS } from './constants';
import type { HuntRecord, HuntState, SlotGroup } from './types';

/** True once the puzzle has finished, either way. */
export function isGameOver(state: HuntState): boolean {
  return state.status === 'won' || state.status === 'gave-up';
}

export function requiredCount(state: HuntState): number {
  return state.required.length;
}

export function foundCount(state: HuntState): number {
  return state.found.length;
}

/** The required words not found yet, in board order: what a give up shows (FR-163). */
export function missedWords(state: HuntState): readonly string[] {
  return state.required.filter((word) => !state.found.includes(word));
}

/**
 * Which tray positions the typed letters are using. A letter takes the first
 * free position that holds it, so two copies of a letter use two positions.
 */
export function usedPositions(state: HuntState): readonly boolean[] {
  const used = [...state.tray].map(() => false);

  for (const letter of state.currentInput) {
    const position = [...state.tray].findIndex((tray, index) => tray === letter && !used[index]);
    if (position !== -1) used[position] = true;
  }
  return used;
}

/**
 * The required words as slots grouped by length (FR-160). A found word fills its
 * own slot, so the board shows how many are left at each length.
 */
export function slotGroups(state: HuntState): readonly SlotGroup[] {
  return HUNT_WORD_LENGTHS.map((length) => ({
    length,
    slots: state.required
      .filter((word) => word.length === length)
      .map((word) => ({ word, found: state.found.includes(word) })),
  })).filter((group) => group.slots.length > 0);
}

/** A finished puzzle for the statistics log (FR-165), or null while it is still in play. */
export function huntRecord(state: HuntState): HuntRecord | null {
  if (!isGameOver(state)) return null;

  return {
    id: state.id,
    // `finishedAt` is always set by the reducer when the status changes.
    playedAt: state.finishedAt ?? 0,
    seed: state.seed,
    requiredCount: state.required.length,
    foundCount: state.found.length,
    bonusCount: state.bonus.length,
    completed: state.status === 'won',
    solveMs: clampDuration((state.finishedAt ?? 0) - (state.startedAt ?? 0)),
  };
}
