import { memo } from 'react';

import type { LetterState } from '@/engine';
import { cn } from '@/lib/cn';

import { KEYBOARD_ROWS } from '../keyboard/layout';
import { keyLabel } from './hangLabels';

export interface HangKeyboardProps {
  /** Each letter tried: `correct` if it is in the word, `absent` if not. */
  readonly letterStates: ReadonlyMap<string, LetterState>;
  readonly disabled: boolean;
  readonly onGuess: (letter: string) => void;
}

/** The letters only. A guess needs no Enter and no Backspace (FR-169). */
const LETTER_ROWS = KEYBOARD_ROWS.map((row) =>
  row.filter((value) => value !== 'ENTER' && value !== 'BACKSPACE'),
);

/**
 * WordHang's keyboard (FR-169, FR-170): the shared QWERTY letters, with no
 * Enter or Backspace. A key guesses its letter at once. A letter already tried
 * is disabled and shows whether it was in the word, with a ✓ or ✗ as well as
 * its colour, and its name says so, so nothing relies on colour alone (A11Y-8).
 */
export const HangKeyboard = memo(function HangKeyboard({
  letterStates,
  disabled,
  onGuess,
}: HangKeyboardProps): React.JSX.Element {
  return (
    <div aria-label="Keyboard" className="flex w-full max-w-lg flex-col gap-1.5 px-0.5">
      {LETTER_ROWS.map((row, index) => (
        <div key={index} className="flex justify-center gap-1 sm:gap-1.5">
          {row.map((letter) => {
            const state = letterStates.get(letter);
            const tried = state === undefined ? undefined : state === 'correct' ? 'in' : 'out';

            return (
              <button
                key={letter}
                type="button"
                disabled={disabled || state !== undefined}
                aria-label={keyLabel(letter, tried)}
                onClick={() => {
                  onGuess(letter);
                }}
                className={cn(
                  'relative flex items-center justify-center rounded font-bold uppercase select-none',
                  // FR-58: comfortably above the 44px touch target on phones.
                  'h-(--size-key-height) min-w-0 flex-1 px-0.5 text-xs sm:px-2 sm:text-sm',
                  'transition-colors duration-150 active:scale-95',
                  'disabled:cursor-not-allowed',
                  tried === 'in' && 'bg-key-correct text-key-text-revealed',
                  tried === 'out' && 'bg-key-absent text-key-text-revealed',
                  tried === undefined && 'bg-key text-key-text disabled:opacity-50',
                )}
              >
                {letter}
                {tried ? (
                  <span aria-hidden="true" className="absolute top-0 right-0.5 text-[0.55rem]">
                    {tried === 'in' ? '✓' : '✗'}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
});
