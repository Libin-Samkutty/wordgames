import { describe, expect, it } from 'vitest';

import { DICTIONARY_REGISTRY } from '@/dictionary/registry';

import type { WordLength } from '../../types';
import { createHangGame, hangReducer } from '../reducer';
import { isGameOver } from '../selectors';
import type { HangState } from '../types';

/**
 * WordHang against the real lists (T-100: FR-167, AC-60). The one place the
 * Hang tests use the shipped data, by design.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * A good player: guess the letter that appears in the most words that could
 * still be the secret, and play to the end.
 */
function play(secret: string, answers: readonly string[]): HangState {
  let state = createHangGame('g', secret.length as WordLength, secret);

  while (!isGameOver(state)) {
    const possible = answers.filter(
      (word) =>
        word.length === secret.length &&
        [...word].every((letter, index) => {
          const revealed = state.tried.includes(secret[index] as string);
          return revealed ? letter === secret[index] : !state.tried.includes(letter);
        }),
    );
    let best = ALPHABET[0] as string;
    let bestCount = -1;
    for (const letter of ALPHABET) {
      if (state.tried.includes(letter)) continue;
      const count = possible.filter((word) => word.includes(letter)).length;
      if (count > bestCount) {
        best = letter;
        bestCount = count;
      }
    }
    state = hangReducer(state, { type: 'GUESS_LETTER', letter: best, now: 1 });
  }
  return state;
}

/** The letters of English from most to least common, tried in this order and no other. */
const FREQUENCY_ORDER = 'EAROTILSNCUDPMHGBFYWKVXZJQ';

/** A player with no word list: guess letters in a fixed order until the game ends. */
function playFixed(secret: string): HangState {
  let state = createHangGame('g', secret.length as WordLength, secret);
  for (const letter of FREQUENCY_ORDER) {
    if (isGameOver(state)) break;
    state = hangReducer(state, { type: 'GUESS_LETTER', letter, now: 1 });
  }
  return state;
}

describe('the real lists', () => {
  it.each([4, 5, 6] as const)(
    'at length %i every answer is 4 to 6 letters from A to Z, with at least 2 different letters',
    async (length: WordLength) => {
      const lists = await DICTIONARY_REGISTRY[length]();

      for (const word of lists.answers) {
        expect(word).toMatch(/^[A-Z]+$/);
        expect(word).toHaveLength(length);
        expect(new Set(word).size).toBeGreaterThanOrEqual(2);
      }
    },
  );

  it.each([4, 5, 6] as const)(
    'at length %i a player who knows the list wins most games, so every word can be won',
    async (length: WordLength) => {
      const lists = await DICTIONARY_REGISTRY[length]();
      const sample = lists.answers.filter((_, index) => index % 7 === 0);

      const wins = sample.filter((secret) => play(secret, lists.answers).status === 'won').length;
      const rate = wins / sample.length;

      expect(rate).toBeGreaterThan(0.5);
    },
    60_000,
  );

  it.each([4, 5, 6] as const)(
    'at length %i a player who ignores the pattern and tries letters by frequency wins about one game in ten',
    async (length: WordLength) => {
      const lists = await DICTIONARY_REGISTRY[length]();

      const wins = lists.answers.filter((secret) => playFixed(secret).status === 'won').length;
      const rate = wins / lists.answers.length;

      expect(rate).toBeGreaterThan(0.02);
      expect(rate).toBeLessThan(0.3);
    },
  );
});
