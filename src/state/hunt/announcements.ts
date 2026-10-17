import { foundCount, requiredCount, type HuntState } from '@/engine/hunt';

function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

/**
 * The polite message for an accepted word (A11Y-26):
 *
 *   `LEAP. 3 of 10 found. 7 words left.`
 *   `PEAL is a bonus word. 2 bonus words.`
 *
 * The counts are said even at one, so a player never has to infer a number.
 *
 * @param state The state after the word was added.
 * @param word The accepted word.
 * @param isRequired Whether it was one of the words to find.
 */
export function wordAnnouncement(state: HuntState, word: string, isRequired: boolean): string {
  if (!isRequired) {
    return `${word} is a bonus word. ${plural(state.bonus.length, 'bonus word', 'bonus words')}.`;
  }

  const left = requiredCount(state) - foundCount(state);
  return `${word}. ${String(foundCount(state))} of ${String(requiredCount(state))} found. ${plural(left, 'word', 'words')} left.`;
}

/** The polite message when a puzzle ends (A11Y-3). */
export function outcomeAnnouncement(state: HuntState): string {
  if (state.status === 'won') {
    return `You found all ${String(requiredCount(state))} words${
      state.bonus.length > 0
        ? ` and ${plural(state.bonus.length, 'bonus word', 'bonus words')}`
        : ''
    }.`;
  }
  return `You gave up with ${String(foundCount(state))} of ${String(requiredCount(state))} words found.`;
}
