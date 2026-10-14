/**
 * The illustration for the WordStack help dialog (FR-114): one guess, two
 * boards. Decorative and never looked up in the dictionary, so the dialog works
 * while the word list is still loading. The colours are computed from the
 * engine's own `evaluateGuess`, so the example can never disagree with the game.
 */
export const STACK_HELP_EXAMPLE = {
  guess: 'CRANE',
  boards: ['PLANT', 'STORM'],
} as const;
