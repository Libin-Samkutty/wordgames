import { evaluateGuess, type Evaluation, type WordLength } from '@/engine';

/**
 * The illustration for the WordDodge help dialog (FR-156): one guess scored
 * the way the game scores every guess, one for each length. Decorative and
 * never looked up in the dictionary, so the dialog works while the word list is
 * still loading. The colours are computed with the engine's own `evaluateGuess`,
 * so the example can never disagree with the game.
 */
export interface DodgeHelpExample {
  readonly word: string;
  /** A word that would have got these colours, to show the reading. */
  readonly candidate: string;
  readonly evaluation: Evaluation;
}

const SOURCES: Readonly<Record<WordLength, { word: string; candidate: string }>> = {
  4: { word: 'BALM', candidate: 'LAMB' },
  5: { word: 'PANEL', candidate: 'PLANT' },
  6: { word: 'TANGLE', candidate: 'PLANET' },
};

/** The example for a length, so it always has that many tiles. */
export function dodgeHelpExample(length: WordLength): DodgeHelpExample {
  const { word, candidate } = SOURCES[length];

  return { word, candidate, evaluation: evaluateGuess(word, candidate) };
}
