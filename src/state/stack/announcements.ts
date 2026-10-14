import type { StackState } from '@/engine/stack';
import { STACK_MODES } from '@/engine/stack';

function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

/**
 * The polite summary of a guess that has just been scored (A11Y-21):
 *
 *   `CRANE. Board 1: 2 correct, 1 present. Board 2: solved. 6 guesses left.`
 *
 * One message per guess, covering every board, so a screen-reader user hears
 * the whole picture once instead of one announcement per board. A board that
 * is already solved, or that this guess solved, reads "solved". An open board
 * reads its counts for this guess, or "no matches" when it has none.
 *
 * @param state The state after the guess was added, so every board has scored it.
 */
export function guessAnnouncement(state: StackState): string {
  const word = state.words[state.words.length - 1] ?? '';

  const boards = state.boards.map((board, index) => {
    const label = `Board ${String(index + 1)}`;
    if (board.guesses.some((guess) => guess.word === board.answer)) return `${label}: solved`;

    const last = board.guesses[board.guesses.length - 1];
    const correct = last?.evaluation.filter((s) => s === 'correct').length ?? 0;
    const present = last?.evaluation.filter((s) => s === 'present').length ?? 0;

    const parts = [
      ...(correct > 0 ? [`${String(correct)} correct`] : []),
      ...(present > 0 ? [`${String(present)} present`] : []),
    ];
    return `${label}: ${parts.length > 0 ? parts.join(', ') : 'no matches'}`;
  });

  const left = Math.max(0, STACK_MODES[state.mode].maxGuesses - state.words.length);
  return `${word}. ${boards.join('. ')}. ${plural(left, 'guess', 'guesses')} left.`;
}

/** The polite message when a game ends (A11Y-3). */
export function outcomeAnnouncement(state: StackState): string {
  if (state.status === 'won') {
    return `You won in ${plural(state.words.length, 'guess', 'guesses')}.`;
  }

  const unsolved = state.boards
    .filter((board) => !board.guesses.some((guess) => guess.word === board.answer))
    .map((board) => board.answer);
  return `Game over. Unsolved: ${unsolved.join(', ')}.`;
}
