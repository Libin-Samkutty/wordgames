import { remainingGuesses, type RangeState } from '@/engine/range';

function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * The polite summary of a guess that has just been accepted (A11Y-22):
 *
 *   `BRAVE: the word is after it. Range BRAVE to ZZZZZ. Freezing. 13 guesses left.`
 *
 * Direction, the new range and the heat come as words, so nothing relies on
 * colour. The secret itself is announced by the outcome message instead.
 *
 * @param state The state after the guess was added.
 */
export function guessAnnouncement(state: RangeState): string {
  const guess = state.guesses[state.guesses.length - 1];
  if (!guess?.direction || !guess.heat) return '';

  return (
    `${guess.word}: the word is ${guess.direction} it. ` +
    `Range ${state.lower} to ${state.upper}. ` +
    `${capitalise(guess.heat)}. ` +
    `${plural(remainingGuesses(state), 'guess', 'guesses')} left.`
  );
}

/** The polite message when a game ends (A11Y-3). */
export function outcomeAnnouncement(state: RangeState): string {
  if (state.status === 'won') {
    return `You found ${state.secret} in ${plural(state.guesses.length, 'guess', 'guesses')}.`;
  }
  return `Game over. The word was ${state.secret}.`;
}
