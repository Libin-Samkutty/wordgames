/**
 * The illustration for the WordShuffle help dialog (FR-147): one scrambled
 * puzzle with two words that solve it. Decorative and never looked up in the
 * dictionary, so the dialog works while the word list is still loading.
 * `helpExample.test.ts` checks it against the shipped 6-letter list, so the
 * example can never disagree with the game.
 */
export const SHUFFLE_HELP_EXAMPLE = {
  /** The letters as they arrive in the tray. */
  scramble: 'NTSELI',
  /** The word the puzzle was drawn from; hints follow it. */
  target: 'LISTEN',
  /** Another real word with the same letters, which also solves it. */
  other: 'SILENT',
} as const;
