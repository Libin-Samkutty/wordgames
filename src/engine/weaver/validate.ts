import { err, ok, type Result } from '@/lib/result';

import { validateGuess } from '../validate';
import type { RungError, WeaverLength } from './types';

export interface RungContext {
  readonly length: WeaverLength;
  /** The word the rung must follow: the last accepted rung, or the start word. */
  readonly previous: string;
  /** Every word already in the ladder: the start word and each current rung (EC-29). */
  readonly used: readonly string[];
  /** Membership test against the guess list, injected like Wordwright's (ADR-003). */
  readonly isAllowed: (word: string) => boolean;
}

/** True when `a` and `b` differ in exactly one position. Same length assumed. */
export function differsByOneLetter(a: string, b: string): boolean {
  let differences = 0;
  for (let position = 0; position < a.length; position += 1) {
    if (a[position] !== b[position]) differences += 1;
  }
  return differences === 1;
}

/**
 * Checks a candidate rung in the FR-80 order, returning the first failure:
 *
 *  1. fewer letters than the word length → `too-short`
 *  2. not in the guess list → `not-a-word`
 *  3. not exactly one letter different from the word above → `not-one-letter`
 *  4. already in the ladder → `already-used`
 *
 * The first two are Wordwright's own `validateGuess`. The comparison is
 * positional, so `BOOK → BOOT` is one letter and `BOOK → BOKO` is two.
 *
 * The end word is an ordinary rung: it must pass all four, so it can only be
 * entered from one of its neighbours (FR-82). A rejected rung is not a move.
 */
export function validateRung(input: string, context: RungContext): Result<string, RungError> {
  const guess = validateGuess(input, context.length, context.isAllowed);
  if (!guess.ok) return err(guess.error);

  const word = guess.value;
  if (!differsByOneLetter(context.previous, word)) return err('not-one-letter');
  if (context.used.includes(word)) return err('already-used');

  return ok(word);
}
