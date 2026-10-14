import { CODE_MAX_GUESSES, type CodeState } from '@/engine/code';
import { cn } from '@/lib/cn';

import { TILE_STATE_CLASS } from '../board/tileAppearance';
import { countLabel } from './noteLabel';

export interface CodeRowsProps {
  readonly state: CodeState;
  /** Shakes the input row after a rejected guess (FR-128). */
  readonly shake: boolean;
  readonly reducedMotion: boolean;
}

function Tiles({
  letters,
  length,
  filled,
  pop,
}: {
  letters: string;
  length: number;
  filled: boolean;
  pop: boolean;
}): React.JSX.Element {
  return (
    <span aria-hidden="true" className="flex gap-1">
      {Array.from({ length }, (_, index) => {
        const letter = letters.charAt(index);

        return (
          <span
            key={index}
            className={cn(
              'flex size-(--size-tile) items-center justify-center border-2 text-[calc(var(--size-tile)*0.5)] font-bold uppercase select-none',
              // The tiles are neutral: the counts carry the feedback, not colour (FR-131).
              TILE_STATE_CLASS[letter || filled ? 'filled' : 'empty'],
              letter && !filled && pop && 'animate-pop',
            )}
          >
            {letter}
          </span>
        );
      })}
    </span>
  );
}

/**
 * Every row of a WordCode game (FR-131): the guesses on neutral tiles, each
 * followed by its counts as text, then the row being typed, then empty rows up
 * to the 10 allowed.
 *
 * The tiles are decorative. Each guess row reads as one line, such as
 * `PANEL: 1 bull, 3 cows`, so a screen reader hears the word and its counts
 * and never a grid of letters. One focusable scroll region holds the rows, so a
 * 6-letter board stays reachable by keyboard while the keyboard below stays on
 * screen.
 */
export function CodeRows({ state, shake, reducedMotion }: CodeRowsProps): React.JSX.Element {
  const length = state.wordLength;
  const active = state.status === 'playing' ? state.guesses.length : -1;

  return (
    <ol
      aria-label="Guesses"
      className="flex flex-col gap-1.5"
      // Six tiles and the counts must fit the width of a 320 px phone.
      style={{ '--size-tile': 'min(2.5rem, calc((100vw - 10rem) / 6))' } as React.CSSProperties}
    >
      {Array.from({ length: CODE_MAX_GUESSES }, (_, index) => {
        const guess = state.guesses[index];

        if (guess) {
          return (
            <li key={index} className="flex items-center justify-between gap-3">
              <Tiles letters={guess.word} length={length} filled pop={false} />
              <span className="w-[6.25rem] text-xs leading-tight whitespace-nowrap">
                <span className="sr-only">{guess.word}: </span>
                {countLabel(guess.bulls, 'bull', 'bulls')} · {countLabel(guess.cows, 'cow', 'cows')}
              </span>
            </li>
          );
        }

        const isActive = index === active;

        return (
          <li
            key={index}
            aria-label={isActive ? `Your guess: ${state.currentInput || 'empty'}` : undefined}
            className={cn(
              'flex items-center justify-between gap-3',
              isActive && shake && !reducedMotion && 'animate-shake',
            )}
          >
            <Tiles
              letters={isActive ? state.currentInput : ''}
              length={length}
              filled={false}
              pop={!reducedMotion}
            />
            <span className="w-[6.25rem]" aria-hidden="true" />
          </li>
        );
      })}
    </ol>
  );
}
