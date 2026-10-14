import { memo } from 'react';

import type { NoteMark, Notes } from '@/engine/code';
import { cn } from '@/lib/cn';

import { Key, type KeyValue } from '../keyboard/Key';
import { KEYBOARD_ROWS } from '../keyboard/layout';
import { noteLabel } from './noteLabel';
import { NOTE_GLYPH, noteStyle } from './noteStyle';

/** What a letter key does: type the letter, or cycle its note. */
export type KeyboardMode = 'type' | 'mark';

export interface CodeKeyboardProps {
  readonly notes: Notes;
  readonly mode: KeyboardMode;
  readonly disabled: boolean;
  readonly onModeChange: (mode: KeyboardMode) => void;
  readonly onKeyPress: (value: KeyValue) => void;
  readonly onCycleNote: (letter: string) => void;
}

const LetterKey = memo(function LetterKey({
  letter,
  mark,
  marking,
  disabled,
  onPress,
}: {
  letter: string;
  mark: NoteMark | undefined;
  marking: boolean;
  disabled: boolean;
  onPress: (letter: string) => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={() => {
        onPress(letter);
      }}
      disabled={disabled}
      // In Mark mode every key is named for its note, so "P, unmarked" says what a press changes.
      aria-label={marking || mark ? noteLabel(letter, mark) : letter}
      className={cn(
        'relative flex items-center justify-center rounded font-bold uppercase select-none',
        // FR-58: comfortably above the 44px touch target on phones.
        'h-(--size-key-height) min-w-0 flex-1 px-0.5 text-xs sm:px-2 sm:text-sm',
        'transition-colors duration-150 active:scale-95',
        'disabled:cursor-not-allowed disabled:opacity-50',
        noteStyle(mark),
      )}
    >
      {letter}
      {mark ? (
        <span aria-hidden="true" className="absolute top-0.5 right-1 text-[0.6rem] leading-none">
          {NOTE_GLYPH[mark]}
        </span>
      ) : null}
    </button>
  );
});

const MODES: readonly { readonly mode: KeyboardMode; readonly label: string }[] = [
  { mode: 'type', label: 'Type' },
  { mode: 'mark', label: 'Mark' },
];

/**
 * WordCode's on-screen keyboard: Wordwright's layout, with each letter key
 * showing the player's own note for it (FR-132). A Type and Mark switch above
 * it decides what a letter key does: Type enters the letter, Mark cycles its
 * note through unmarked, ruled out and in the word. A guess never sets a mark.
 */
export const CodeKeyboard = memo(function CodeKeyboard({
  notes,
  mode,
  disabled,
  onModeChange,
  onKeyPress,
  onCycleNote,
}: CodeKeyboardProps): React.JSX.Element {
  const marking = mode === 'mark';

  return (
    <div aria-label="Keyboard" className="flex w-full max-w-lg flex-col gap-1.5 px-0.5">
      <div className="flex items-center justify-between gap-2 pb-0.5">
        <div
          role="group"
          aria-label="Key action"
          className="flex gap-1 rounded-lg bg-surface-sunken p-0.5"
        >
          {MODES.map((option) => (
            <button
              key={option.mode}
              type="button"
              aria-pressed={mode === option.mode}
              disabled={disabled}
              onClick={() => {
                onModeChange(option.mode);
              }}
              className={cn(
                'min-h-11 min-w-16 rounded-md px-3 text-sm font-bold transition-colors duration-150 select-none',
                'disabled:cursor-not-allowed disabled:opacity-50',
                mode === option.mode ? 'bg-key text-key-text' : 'text-text-muted',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p aria-hidden="true" className="text-xs text-text-muted">
          {marking ? 'Tap a letter to cycle: out, in, clear' : 'Switch to Mark to note letters'}
        </p>
      </div>

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
                marking={marking}
                disabled={disabled}
                onPress={marking ? onCycleNote : onKeyPress}
              />
            ),
          )}
          {index === 1 ? <div className="w-1 shrink sm:w-2" aria-hidden="true" /> : null}
        </div>
      ))}
    </div>
  );
});
