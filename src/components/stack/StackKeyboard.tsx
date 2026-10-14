import { memo } from 'react';

import type { LetterState } from '@/engine';

import { Key, type KeyValue } from '../keyboard/Key';
import { KEYBOARD_ROWS } from '../keyboard/layout';
import { SplitKey } from './SplitKey';

export interface StackKeyboardProps {
  /** One map per board; `null` for a solved board, which drops out of the key (FR-109). */
  readonly boardKeyStates: readonly (ReadonlyMap<string, LetterState> | null)[];
  readonly disabled: boolean;
  readonly onKeyPress: (value: KeyValue) => void;
}

/**
 * WordStack's on-screen keyboard: Wordwright's layout, with each letter key
 * split into one segment per board (FR-109). Enter and Backspace are the
 * ordinary `Key`, since they carry no state.
 */
export const StackKeyboard = memo(function StackKeyboard({
  boardKeyStates,
  disabled,
  onKeyPress,
}: StackKeyboardProps): React.JSX.Element {
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
              <SplitKey
                key={value}
                letter={value}
                segments={boardKeyStates.map((states) =>
                  states === null ? null : states.get(value),
                )}
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
