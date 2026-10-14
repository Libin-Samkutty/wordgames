import { err, ok, type Result } from '@/lib/result';

import { validateGuess } from '../validate';
import { RANGE_LENGTH } from './constants';
import type { RangeError } from './types';

export interface RangeContext {
  /** The secret comes after this word (FR-116). */
  readonly lower: string;
  /** The secret comes before this word (FR-116). */
  readonly upper: string;
  /** Every word already guessed this game. */
  readonly guessed: readonly string[];
  /** Membership test against the guess list, injected like Wordwright's (ADR-003). */
  readonly isAllowed: (word: string) => boolean;
}

/**
 * Checks a candidate guess in the FR-117 order, returning the first failure:
 *
 *  1. fewer letters than 5 → `too-short`
 *  2. not in the guess list → `not-a-word`
 *  3. already guessed → `already-guessed`
 *  4. not strictly inside the range → `outside-range`
 *
 * The first two are Wordwright's own `validateGuess`. A guess equal to a bound
 * is always an earlier guess, so it stops at step 3 and never reaches the range
 * check (EC-42, EC-43). The sentinels are not in the guess list, so typing one
 * fails at step 2. Bounds compare as plain strings: the lists are sorted
 * uppercase, so string order is list order.
 *
 * A rejected guess uses no guess.
 */
export function validateRangeGuess(
  input: string,
  context: RangeContext,
): Result<string, RangeError> {
  const guess = validateGuess(input, RANGE_LENGTH, context.isAllowed);
  if (!guess.ok) return err(guess.error);

  const word = guess.value;
  if (context.guessed.includes(word)) return err('already-guessed');
  if (!(context.lower < word && word < context.upper)) return err('outside-range');

  return ok(word);
}
