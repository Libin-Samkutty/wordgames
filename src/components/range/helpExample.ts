import type { Heat, RangeDirection } from '@/engine/range';

/**
 * The illustration for the WordRange help dialog (FR-126): three guesses
 * towards one secret. Decorative and never looked up in the dictionary, so the
 * dialog works while the word list is still loading. The distances are real
 * positions in the 5-letter guess list (BRAVE 7,171 away, PLUMB 47, PLAIN 6), and
 * `rangeHelpExample.test.ts` checks them against the shipped list so the example
 * can never disagree with the game.
 */
export interface HelpStep {
  readonly word: string;
  readonly direction: RangeDirection;
  readonly heat: Heat;
}

export const RANGE_HELP_EXAMPLE: { readonly secret: string; readonly steps: readonly HelpStep[] } =
  {
    secret: 'PLANT',
    steps: [
      { word: 'BRAVE', direction: 'after', heat: 'freezing' },
      { word: 'PLUMB', direction: 'before', heat: 'hot' },
      { word: 'PLAIN', direction: 'after', heat: 'burning' },
    ],
  };
