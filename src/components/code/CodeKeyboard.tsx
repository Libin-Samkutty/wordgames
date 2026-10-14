import { memo } from 'react';

import type { NoteMark, Notes } from '@/engine/code';
import { cn } from '@/lib/cn';

import { Key, type KeyValue } from '../keyboard/Key';
import { KEYBOARD_ROWS } from '../keyboard/layout';
import { noteLabel } from './noteLabel';
import { noteStyle } from './noteStyle';

export interface CodeKeyboardProps {
  readonly notes: Notes;
  readonly disabled: boolean;
  readonly onKeyPress: (value: KeyValue) => void;
}

const LetterKey = memo(function LetterKey({
  letter,
  mark,
  disabled,
  onPress,
}: {
  letter: string;
  mark: NoteMark | undefined;
  disabled: boolean;
  onPress: (value: KeyValue) => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={() => {
        onPress(letter);
      }}
      disabled={disabled}
      aria-label={mark ? noteLabel(letter, mark) : letter}
      className={cn(
        'flex items-center justify-center rounded font-bold uppercase select-none',
        // FR-58: comfortably above the 44px touch target on phones.
        'h-(--size-key-height) min-w-0 flex-1 px-0.5 text-xs sm:px-2 sm:text-sm',
        'transition-colors duration-150 active:scale-95',
        'disabled:cursor-not-allowed disabled:opacity-50',
        noteStyle(mark),
      )}
    >
      {letter}
    </button>
  );
});

/**
 * WordCode's on-screen keyboard: Wordwright's layout, with each letter key
 * showing the player's own note for it (FR-132). Pressing a key types the
 * letter. Marks are changed in the notes panel, never by a guess.
 */
export const CodeKeyboard = memo(function CodeKeyboard({
  notes,
  disabled,
  onKeyPress,
}: CodeKeyboardProps): React.JSX.Element {
  return (
    <div aria-label="Keyboard" className="flex w-full max-w-lg flex-col gap-1.5 px-0.5">
      {KEYBOARD_ROWS.map((row, index) => (
        <div key={index} className="flex justify-center gap-1 sm:gap-1.5">
          {/* The middle row is inset on both sides, as on a real keyboard. */}
          {index === 1 ? <div className="w-1 shrink sm:w-2" aria-hidden="true" /> : null}
          {row.map((value) =>
            value === 'ENTER' || value === 'BACKSPACE' ? (
              <Key
                key={value}
                value={value}
                state={undefined}
                disabled={disabled}
                onPress={onKeyPress}
              />
            ) : (
              <LetterKey
                key={value}
                letter={value}
                mark={notes[value]}
                disabled={disabled}
                onPress={onKeyPress}
              />
            ),
          )}
          {index === 1 ? <div className="w-1 shrink sm:w-2" aria-hidden="true" /> : null}
        </div>
      ))}
    </div>
  );
});
