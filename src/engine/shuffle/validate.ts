import { err, ok, type Result } from '@/lib/result';

import type { AnswerError } from './types';

export interface AnswerContext {
  readonly target: string;
  /** Positions locked by a hint (FR-142). */
  readonly hinted: readonly number[];
  /** Membership test against the guess list, injected like Wordwright's (ADR-003). */
  readonly isAllowed: (word: string) => boolean;
}

/**
 * Checks the answer row in the FR-140 order, returning the first failure:
 *
 *  1. an empty slot, so not all letters are used → `too-short`
 *  2. a hinted position that does not hold the target's letter → `hint-moved`
 *  3. not in the guess list → `not-a-word`
 *
 * The letters always match the tray because the row is built from it, so there
 * is no anagram check. Step 2 cannot happen through the interface, where hinted
 * letters are locked (EC-48); it guards a bad action or a hand-edited session.
 * Any word that passes is a solve, the target or not (FR-141, EC-47).
 */
export function validateAnswer(
  slots: readonly (string | null)[],
  context: AnswerContext,
): Result<string, AnswerError> {
  if (slots.some((slot) => slot === null)) return err('too-short');

  const word = slots.join('');
  if (context.hinted.some((position) => word[position] !== context.target[position])) {
    return err('hint-moved');
  }
  if (!context.isAllowed(word)) return err('not-a-word');

  return ok(word);
}
