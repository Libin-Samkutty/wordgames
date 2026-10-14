import { scoreCode } from '@/engine/code';
import type { WordLength } from '@/engine';

/**
 * The illustration for the WordCode help dialog (FR-136): two guesses at a
 * secret, one for each length. Decorative and never looked up in the
 * dictionary, so the dialog works while the word list is still loading. The
 * counts are computed with the engine's own `scoreCode`, so the example can
 * never disagree with the game.
 */
export interface CodeHelpExample {
  readonly secret: string;
  readonly guesses: readonly {
    readonly word: string;
    readonly bulls: number;
    readonly cows: number;
  }[];
}

const SOURCES: Readonly<Record<WordLength, { secret: string; guesses: readonly string[] }>> = {
  4: { secret: 'LAMB', guesses: ['BALM', 'LAMP'] },
  5: { secret: 'PLANT', guesses: ['PANEL', 'PLANK'] },
  6: { secret: 'PLANET', guesses: ['TANGLE', 'PLANTS'] },
};

/** The example for a length, so it always has that many tiles. */
export function codeHelpExample(length: WordLength): CodeHelpExample {
  const { secret, guesses } = SOURCES[length];

  return {
    secret,
    guesses: guesses.map((word) => ({ word, ...scoreCode(word, secret) })),
  };
}
