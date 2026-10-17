import { memo } from 'react';

import { isGameOver, maskedWord, type HangState } from '@/engine/hang';
import { cn } from '@/lib/cn';

import { TILE_STATE_CLASS } from '../board/tileAppearance';
import { wordLabel } from './hangLabels';

export interface HangWordProps {
  readonly state: HangState;
  readonly reducedMotion: boolean;
}

/**
 * The word as one tile per letter (FR-171). A letter guessed shows in its
 * tiles, and a hidden one is an empty tile. After a loss the missed letters
 * show too, in a different style, so the word is always readable.
 *
 * It is one labelled group, not a grid. The tiles are decorative and the label
 * reads the word, with "blank" for each hidden letter, so a screen reader
 * hears a word and not six cells (A11Y-27).
 */
export const HangWord = memo(function HangWord({
  state,
  reducedMotion,
}: HangWordProps): React.JSX.Element {
  const masked = maskedWord(state);
  const lost = state.status === 'lost';

  return (
    <div role="group" aria-label={wordLabel(state)} className="flex justify-center gap-1.5">
      {masked.map((letter, index) => {
        const shown = letter ?? (isGameOver(state) ? state.secret[index] : undefined);
        const tileState = letter ? 'correct' : lost ? 'absent' : 'empty';

        return (
          <span
            key={index}
            aria-hidden="true"
            data-revealed={letter !== null}
            className={cn(
              'flex size-11 items-center justify-center border-2 text-2xl font-bold uppercase select-none sm:size-12',
              TILE_STATE_CLASS[tileState],
              letter && !reducedMotion && 'animate-pop',
            )}
          >
            {shown}
          </span>
        );
      })}
    </div>
  );
});
