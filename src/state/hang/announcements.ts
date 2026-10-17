import { maskedWord, missesLeft, occurrences, type HangState } from '@/engine/hang';

function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

/** The word as a screen reader should hear it: revealed letters, and "blank" for each hidden one. */
export function spokenWord(state: HangState): string {
  return maskedWord(state)
    .map((letter) => letter ?? 'blank')
    .join(', ');
}

/**
 * The polite summary of a letter that has just been guessed (A11Y-27):
 *
 *   `A is in the word, 2 times. Word so far: P, blank, A, blank, A. 6 misses left.`
 *   `Z is not in the word. 5 misses left.`
 *
 * The misses left are said every time, and a count of one is singular.
 *
 * @param state The state after the letter was added.
 * @param letter The letter just guessed.
 */
export function letterAnnouncement(state: HangState, letter: string): string {
  const left = plural(missesLeft(state), 'miss', 'misses');

  if (!state.secret.includes(letter)) return `${letter} is not in the word. ${left} left.`;

  const count = occurrences(state, letter);
  const times = count === 1 ? '' : `, ${String(count)} times`;
  return `${letter} is in the word${times}. Word so far: ${spokenWord(state)}. ${left} left.`;
}

/** The polite message when a game ends (A11Y-3). */
export function outcomeAnnouncement(state: HangState, misses: number): string {
  if (state.status === 'won') {
    return misses === 0
      ? `You guessed ${state.secret} with no misses.`
      : `You guessed ${state.secret} with ${plural(misses, 'miss', 'misses')}.`;
  }
  return `You lost. The word was ${state.secret}.`;
}
