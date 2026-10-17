import { pickAnswer } from '../createGame';
import type { RandomSource } from '../random';
import { anagramKey, type AnagramIndex } from '../shuffle/anagram';
import { shuffleLetters } from '../shuffle/scramble';
import { HUNT_WORD_LENGTHS, MAX_REQUIRED, MIN_REQUIRED } from './constants';

/**
 * Finding a tray's words, and drawing a puzzle (SPEC §22.1, ADR-040).
 *
 * A word hides in a tray when its letters are some of the tray's letters, each
 * used no more often than the tray has it. That makes it an anagram of a
 * sub-multiset of the tray, which the anagram index answers directly.
 */

/** What the puzzle needs to know about one word length. */
export interface LengthSource {
  /** The common words: the answer list and the shuffle list (FR-159). */
  readonly common: ReadonlySet<string>;
  /** Every valid word of this length, keyed by its sorted letters. */
  readonly index: AnagramIndex;
}

/** Sources for 4, 5 and 6 letters. */
export type HuntSources = Readonly<Record<4 | 5 | 6, LengthSource>>;

/** The sorted-letter key of every distinct way to pick `size` of the letters. */
export function subsetKeys(letters: string, size: number): string[] {
  const keys = new Set<string>();
  const chosen: string[] = [];

  const pick = (start: number): void => {
    if (chosen.length === size) {
      keys.add(anagramKey(chosen.join('')));
      return;
    }
    for (let i = start; i < letters.length; i += 1) {
      chosen.push(letters[i] as string);
      pick(i + 1);
      chosen.pop();
    }
  };

  pick(0);
  return [...keys];
}

/**
 * The common words that can be made from `letters`, shortest first and in
 * alphabetical order within a length (FR-159). Each word appears once, because
 * a word belongs to exactly one letter key.
 */
export function requiredFor(letters: string, sources: HuntSources): string[] {
  const words: string[] = [];

  for (const length of HUNT_WORD_LENGTHS) {
    const { common, index } = sources[length];
    const ofLength: string[] = [];

    for (const key of subsetKeys(letters, length)) {
      for (const word of index.get(key) ?? []) {
        if (common.has(word)) ofLength.push(word);
      }
    }
    words.push(...ofLength.sort());
  }

  return words;
}

/**
 * The seeds that make a good puzzle: those hiding between `MIN_REQUIRED` and
 * `MAX_REQUIRED` common words (FR-159). Order is kept, so the result is stable.
 */
export function buildPool(seeds: readonly string[], sources: HuntSources): string[] {
  return seeds.filter((seed) => {
    const count = requiredFor(seed, sources).length;
    return count >= MIN_REQUIRED && count <= MAX_REQUIRED;
  });
}

/** A drawn puzzle: the seed, the tray's order, and the words to find. */
export interface Puzzle {
  readonly seed: string;
  readonly tray: string;
  readonly required: readonly string[];
}

/**
 * Draws a puzzle from the pool (FR-158). The seed comes from `pickAnswer` with
 * the ring buffer, and the tray is an order of its letters that is not the
 * seed itself.
 */
export function createPuzzle(
  pool: readonly string[],
  sources: HuntSources,
  recent: readonly string[],
  random: RandomSource,
): Puzzle {
  const seed = pickAnswer(pool, recent, random);

  return {
    seed,
    tray: shuffleLetters([...seed], random).join(''),
    required: requiredFor(seed, sources),
  };
}
