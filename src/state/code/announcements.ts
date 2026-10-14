import { remainingGuesses, type CodeState } from '@/engine/code';

function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

/**
 * The polite summary of a guess that has just been scored (A11Y-23):
 *
 *   `PANEL: 1 bull, 3 cows. 9 guesses left.`
 *
 * The counts are words, and a count of zero is still said, so a player never
 * has to infer a missing number.
 *
 * @param state The state after the guess was added.
 */
export function guessAnnouncement(state: CodeState): string {
  const guess = state.guesses[state.guesses.length - 1];
  if (!guess) return '';

  return (
    `${guess.word}: ${plural(guess.bulls, 'bull', 'bulls')}, ${plural(guess.cows, 'cow', 'cows')}. ` +
    `${plural(remainingGuesses(state), 'guess', 'guesses')} left.`
  );
}

/** The polite message when a game ends (A11Y-3). */
export function outcomeAnnouncement(state: CodeState): string {
  if (state.status === 'won') {
    return `You found ${state.secret} in ${plural(state.guesses.length, 'guess', 'guesses')}.`;
  }
  return `Game over. The word was ${state.secret}.`;
}
