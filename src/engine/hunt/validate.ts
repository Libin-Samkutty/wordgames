import { err, ok, type Result } from '@/lib/result';

import { MIN_WORD_LENGTH } from './constants';
import type { HuntState, WordError } from './types';

/** How many times each letter of `word` appears. */
function letterCounts(word: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const letter of word) counts.set(letter, (counts.get(letter) ?? 0) + 1);
  return counts;
}

/** True when `word` can be spelled with the letters of `tray`, each used no more often than it appears. */
export function isFormableFrom(word: string, tray: string): boolean {
  const available = letterCounts(tray);

  for (const letter of word) {
    const left = available.get(letter) ?? 0;
    if (left === 0) return false;
    available.set(letter, left - 1);
  }
  return true;
}

/** The result of an accepted word: the word, and whether it is one of the required ones. */
export interface AcceptedWord {
  readonly word: string;
  readonly isRequired: boolean;
}

/**
 * Checks a submitted word in the FR-161 order. A rejected word shakes the row,
 * shows the toast and has no other cost.
 *
 * 1. Fewer than 4 letters → `too-short`.
 * 2. Not spelled from the tray → `not-from-tray`. The UI cannot produce this,
 *    because it never accepts a letter the tray has run out of. It is an engine
 *    guard with no toast.
 * 3. Already found, as a required word or a bonus one → `already-found`.
 * 4. Not in the word list → `not-a-word`.
 *
 * @param isWord Membership in the guess list for the word's length.
 */
export function validateWord(
  input: string,
  state: HuntState,
  isWord: (word: string) => boolean,
): Result<AcceptedWord, WordError> {
  const word = input.toUpperCase();

  if (word.length < MIN_WORD_LENGTH) return err('too-short');
  if (!isFormableFrom(word, state.tray)) return err('not-from-tray');
  if (state.found.includes(word) || state.bonus.includes(word)) return err('already-found');
  if (!isWord(word)) return err('not-a-word');

  return ok({ word, isRequired: state.required.includes(word) });
}
