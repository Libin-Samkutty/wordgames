import { wordsLeft, type DodgeState } from '@/engine/dodge';
import { describeEvaluation } from '@/lib/format';

function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

/**
 * The polite summary of a guess whose reveal has finished (A11Y-25):
 *
 *   `PLANK: P correct, L correct, ... 3 words left.`
 *
 * The count is said even at one, so a player knows the game is down to its
 * last word.
 *
 * @param state The state after the guess was answered.
 */
export function guessAnnouncement(state: DodgeState): string {
  const guess = state.guesses[state.guesses.length - 1];
  if (!guess) return '';

  return (
    `${guess.word}: ${describeEvaluation(guess.word, guess.evaluation)}. ` +
    `${plural(wordsLeft(state), 'word', 'words')} left.`
  );
}

/** The polite message when a game ends (A11Y-3). */
export function outcomeAnnouncement(state: DodgeState): string {
  if (state.status === 'won') {
    return `You found ${state.guesses[state.guesses.length - 1]?.word ?? ''} in ${plural(state.guesses.length, 'guess', 'guesses')}.`;
  }
  return `You gave up. The word could have been ${state.candidates[0] ?? ''}.`;
}
