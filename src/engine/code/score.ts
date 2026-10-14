import { evaluateGuess } from '../evaluate';

/**
 * Scores a guess as bulls and cows (FR-129): bulls are the `correct` positions
 * and cows the `present` positions of Wordwright's own `evaluateGuess`.
 *
 * Reusing it means duplicate letters follow FR-12 and FR-13 exactly, with no
 * second implementation to drift. With secret `SPEED`, the guess `EEEEE` gives 2
 * bulls and 0 cows (EC-44).
 */
export function scoreCode(guess: string, secret: string): { bulls: number; cows: number } {
  let bulls = 0;
  let cows = 0;

  for (const state of evaluateGuess(guess, secret)) {
    if (state === 'correct') bulls += 1;
    else if (state === 'present') cows += 1;
  }

  return { bulls, cows };
}
