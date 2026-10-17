import { err, ok, type Result } from '@/lib/result';

import { pickAnswer } from '../createGame';
import { pickRandom, type RandomSource } from '../random';

/** Every distinct ordering of a word's letters, at most 720 for 6 letters. */
function distinctOrders(word: string): string[] {
  const letters = [...word].sort();
  const used = letters.map(() => false);
  const orders: string[] = [];
  const current: string[] = [];

  const build = (): void => {
    if (current.length === letters.length) {
      orders.push(current.join(''));
      return;
    }

    for (let i = 0; i < letters.length; i += 1) {
      if (used[i]) continue;
      // Skip a repeat of the letter just before it: that ordering is already covered.
      if (i > 0 && letters[i] === letters[i - 1] && !used[i - 1]) continue;

      used[i] = true;
      current.push(letters[i] as string);
      build();
      current.pop();
      used[i] = false;
    }
  };

  build();
  return orders;
}

/** How many letters of `order` sit where `reference` has the same letter. */
function lettersInPlace(order: string, reference: readonly string[]): number {
  let count = 0;
  for (let i = 0; i < order.length; i += 1) {
    if (order[i] === reference[i]) count += 1;
  }
  return count;
}

/**
 * Picks one of the orders with the fewest letters already in place against
 * `reference`, each equally likely (ADR-038). That is zero whenever such an
 * order exists. A word with repeated letters, such as `LETTER`, can force a
 * letter into place, and then the fewest possible is the best it can do.
 */
function leastInPlace(
  orders: readonly string[],
  reference: readonly string[],
  random: RandomSource,
): string {
  const counts = orders.map((order) => lettersInPlace(order, reference));
  const fewest = Math.min(...counts);

  return pickRandom(
    orders.filter((_, index) => counts[index] === fewest),
    random,
  );
}

/**
 * Picks a scramble of `target` that differs from it and is not itself a word
 * (FR-138, EC-49), and that leaves as few letters as possible where the target
 * has them (ADR-038). It lists every distinct ordering, drops the target and any
 * ordering that is a word, keeps those with the fewest letters in the target's
 * place, and picks one at random, so each qualifying order is equally likely and
 * there is no retry loop to bound. A word whose every other ordering is a word,
 * or that has only one ordering such as `AAAA`, returns `no-scramble`, and the
 * caller draws another target.
 */
export function makeScramble(
  target: string,
  isWord: (word: string) => boolean,
  random: RandomSource,
): Result<string, 'no-scramble'> {
  const candidates = distinctOrders(target).filter((order) => order !== target && !isWord(order));

  return candidates.length === 0
    ? err('no-scramble')
    : ok(leastInPlace(candidates, [...target], random));
}

/** What a reshuffle keeps away from the player (ADR-038). */
export interface ShuffleAvoid {
  /** The letters in the order the target has them, minus any a hint has locked. */
  readonly reference: readonly string[];
  /** Membership in the guess list, so a reshuffle never lands on a word. */
  readonly isWord: (word: string) => boolean;
}

/**
 * Reorders the letters left in the tray (FR-143). The new order is never the
 * current one, so a reshuffle always visibly changes it, unless every order is
 * the same (one letter, or all alike), when the tray comes back as it was.
 *
 * With `avoid`, it also skips any order that is a word, and picks one with the
 * fewest letters in the target's place, as the first scramble does (ADR-038).
 * Without it, every other order is equally likely.
 */
export function shuffleLetters(
  tray: readonly string[],
  random: RandomSource,
  avoid?: ShuffleAvoid,
): string[] {
  const current = tray.join('');
  const others = distinctOrders(current).filter((order) => order !== current);
  if (others.length === 0) return [...tray];

  const nonWords = avoid ? others.filter((order) => !avoid.isWord(order)) : others;
  // If every other order is a word, one of them is still better than none.
  const pool = nonWords.length > 0 ? nonWords : others;

  return [...leastInPlace(pool, avoid?.reference ?? [], random)];
}

export interface PuzzleLists {
  /** The pool targets come from: the shuffle list for the length (ADR-038). */
  readonly targets: readonly string[];
  /** Membership in the guess list, used to reject a scramble that is a word. */
  readonly isWord: (word: string) => boolean;
}

/**
 * Draws a target and its scramble (FR-138). The target comes from `pickAnswer`
 * with the ring buffer. When no qualifying scramble exists, that target leaves
 * the pool and another is drawn, so the loop ends after at most one pass over
 * the targets. It returns `no-puzzle` only if every target fails, which no
 * shipped list does.
 */
export function createPuzzle(
  lists: PuzzleLists,
  recent: readonly string[],
  random: RandomSource,
): Result<{ target: string; scramble: string }, 'no-puzzle'> {
  let pool = lists.targets;

  while (pool.length > 0) {
    const target = pickAnswer(pool, recent, random);
    const scramble = makeScramble(target, lists.isWord, random);

    if (scramble.ok) return ok({ target, scramble: scramble.value });
    pool = pool.filter((word) => word !== target);
  }

  return err('no-puzzle');
}
