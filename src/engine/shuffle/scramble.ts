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

/**
 * Picks a scramble of `target` that differs from it and is not itself a word
 * (FR-138, EC-49). It lists every distinct ordering, drops the target and any
 * ordering that is a word, and picks one at random, so each qualifying order is
 * equally likely and there is no retry loop to bound. A word whose every other
 * ordering is a word, or that has only one ordering such as `AAAA`, returns
 * `no-scramble`, and the caller draws another target.
 */
export function makeScramble(
  target: string,
  isWord: (word: string) => boolean,
  random: RandomSource,
): Result<string, 'no-scramble'> {
  const candidates = distinctOrders(target).filter((order) => order !== target && !isWord(order));

  return candidates.length === 0 ? err('no-scramble') : ok(pickRandom(candidates, random));
}

/**
 * Reorders the letters left in the tray (FR-143). A Fisher-Yates shuffle with
 * the injected source. If it lands on the same order and the letters are not
 * all alike, the tray rotates by one, so a reshuffle always visibly changes it.
 */
export function shuffleLetters(tray: readonly string[], random: RandomSource): string[] {
  const letters = [...tray];

  for (let i = letters.length - 1; i > 0; i -= 1) {
    const j = Math.min(Math.floor(random.next() * (i + 1)), i);
    [letters[i], letters[j]] = [letters[j] as string, letters[i] as string];
  }

  if (letters.every((letter, index) => letter === tray[index])) {
    const rotated = [...letters.slice(1), ...letters.slice(0, 1)];
    if (rotated.some((letter, index) => letter !== tray[index])) return rotated;
  }

  return letters;
}

export interface PuzzleLists {
  /** The answer list for the length, the pool targets come from. */
  readonly answers: readonly string[];
  /** Membership in the guess list, used to reject a scramble that is a word. */
  readonly isWord: (word: string) => boolean;
}

/**
 * Draws a target and its scramble (FR-138). The target comes from `pickAnswer`
 * with the ring buffer. When no qualifying scramble exists, that target leaves
 * the pool and another is drawn, so the loop ends after at most one pass over
 * the answers. It returns `no-puzzle` only if every answer fails, which no
 * shipped list does.
 */
export function createPuzzle(
  lists: PuzzleLists,
  recent: readonly string[],
  random: RandomSource,
): Result<{ target: string; scramble: string }, 'no-puzzle'> {
  let pool = lists.answers;

  while (pool.length > 0) {
    const target = pickAnswer(pool, recent, random);
    const scramble = makeScramble(target, lists.isWord, random);

    if (scramble.ok) return ok({ target, scramble: scramble.value });
    pool = pool.filter((word) => word !== target);
  }

  return err('no-puzzle');
}
