import { memo } from 'react';

import type { ShuffleState } from '@/engine/shuffle';
import { cn } from '@/lib/cn';

import { TILE_STATE_CLASS, TILE_STATE_MARKER } from '../board/tileAppearance';
import { answerLabel, trayLabel } from './shuffleLabels';

export interface ShuffleBoardProps {
  readonly state: ShuffleState;
  /** Shakes the answer row after a rejected answer (FR-140). */
  readonly shake: boolean;
  readonly reducedMotion: boolean;
  readonly disabled: boolean;
  readonly onTapLetter: (letter: string) => void;
}

/**
 * The WordShuffle board (FR-139): the answer row on top and the tray below.
 *
 * The answer row is one labelled group, not a grid. Its tiles are decorative
 * and the label reads the letters, so a screen reader hears a word and not six
 * cells. A hinted letter is locked and drawn as a correct tile with the
 * colourblind marker, and the label says `hinted`, so it never relies on colour
 * (A11Y-8).
 *
 * Each tray entry is a button at least 44 px square, so a 6-letter tray fits
 * across a 320 px phone. Typing and tapping build the same answer.
 */
export const ShuffleBoard = memo(function ShuffleBoard({
  state,
  shake,
  reducedMotion,
  disabled,
  onTapLetter,
}: ShuffleBoardProps): React.JSX.Element {
  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-5">
      <div
        role="group"
        aria-label={answerLabel(state)}
        className={cn('flex gap-1.5', shake && !reducedMotion && 'animate-shake')}
      >
        {state.slots.map((slot, index) => {
          const isHinted = state.hinted.includes(index);
          const tileState = isHinted ? 'correct' : slot ? 'filled' : 'empty';
          const marker = TILE_STATE_MARKER[tileState];

          return (
            <span
              key={index}
              aria-hidden="true"
              data-hinted={isHinted}
              className={cn(
                'relative flex size-11 items-center justify-center border-2 text-2xl font-bold uppercase select-none sm:size-12',
                TILE_STATE_CLASS[tileState],
                slot && !isHinted && !reducedMotion && 'animate-pop',
              )}
            >
              {slot}
              {isHinted && marker ? (
                <span className="absolute top-0.5 right-1 text-[0.6rem] leading-none opacity-0 in-data-[palette=cb]:opacity-100">
                  {marker}
                </span>
              ) : null}
            </span>
          );
        })}
      </div>

      <div
        role="group"
        aria-label="Letter tray"
        className="flex min-h-11 flex-wrap items-center justify-center gap-1.5"
      >
        {state.tray.map((letter, index) => (
          <button
            key={`${String(index)}-${letter}`}
            type="button"
            disabled={disabled}
            aria-label={trayLabel(state, letter)}
            onClick={() => {
              onTapLetter(letter);
            }}
            className={cn(
              'flex size-11 items-center justify-center rounded bg-key text-xl font-bold text-key-text uppercase select-none sm:size-12',
              'transition-colors duration-150 active:scale-95',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            {letter}
          </button>
        ))}
        {state.tray.length === 0 ? (
          <span className="text-sm text-text-muted">All letters used</span>
        ) : null}
      </div>
    </div>
  );
});
