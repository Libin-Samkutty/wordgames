import {
  RANGE_LENGTH,
  lastHeat,
  remainingGuesses,
  sortedGuesses,
  type RangeState,
} from '@/engine/range';
import { cn } from '@/lib/cn';

import { TILE_STATE_CLASS } from '../board/tileAppearance';
import { HeatBadge } from './HeatBadge';

export interface RangeBoardProps {
  readonly state: RangeState;
  /** Shakes the input row after a rejected guess (FR-117). */
  readonly shake: boolean;
  readonly reducedMotion: boolean;
}

function Bound({ label, word }: { label: string; word: string }): React.JSX.Element {
  return (
    <p className="flex flex-col items-center leading-tight">
      <span className="text-[0.65rem] tracking-wide text-text-muted uppercase">{label}</span>
      <span className="font-mono text-xl font-bold tracking-widest">{word}</span>
    </p>
  );
}

/**
 * The WordRange screen (FR-121), top to bottom: the upper bound, the input row
 * with the heat of the last guess, the lower bound, then every guess in
 * alphabetical order, each marked before or after with its heat.
 *
 * The input row is not a grid: it is one group whose label reads the letters
 * typed so far, so a screen reader hears a word, not five cells.
 */
export function RangeBoard({ state, shake, reducedMotion }: RangeBoardProps): React.JSX.Element {
  const heat = lastHeat(state);
  const guesses = sortedGuesses(state);
  const left = remainingGuesses(state);
  const letters = Array.from({ length: RANGE_LENGTH }, (_, index) =>
    state.currentInput.charAt(index),
  );

  return (
    <div
      role="group"
      aria-label="Range"
      // A scrollable region must be reachable by keyboard (WCAG 2.1.1, axe
      // scrollable-region-focusable), so a keyboard user can scroll a long list
      // while the keyboard below it stays on screen (FR-59).
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- see above
      tabIndex={0}
      className="flex max-h-[clamp(6rem,calc(100dvh-22rem),60rem)] w-full max-w-sm flex-col items-center gap-3 overflow-y-auto overscroll-contain px-1 py-1"
    >
      <Bound label="The word comes before" word={state.upper} />

      <div className="flex flex-col items-center gap-1.5">
        <div
          role="group"
          aria-label={`Your guess: ${state.currentInput || 'empty'}`}
          className={cn('flex gap-1.5', shake && !reducedMotion && 'animate-shake')}
        >
          {letters.map((letter, index) => (
            <span
              key={index}
              aria-hidden="true"
              className={cn(
                'flex size-(--size-tile) items-center justify-center border-2 text-[calc(var(--size-tile)*0.5)] font-bold uppercase select-none',
                TILE_STATE_CLASS[letter ? 'filled' : 'empty'],
                letter && !reducedMotion && 'animate-pop',
              )}
            >
              {letter}
            </span>
          ))}
        </div>

        {/* Always rendered so the row below does not jump when the first heat appears. */}
        <p className="flex min-h-6 items-center">
          {heat ? (
            <HeatBadge heat={heat} />
          ) : (
            <span className="text-sm text-text-muted">No guesses yet</span>
          )}
        </p>
      </div>

      <Bound label="The word comes after" word={state.lower} />

      <p className="text-xs text-text-muted">
        {String(left)} {left === 1 ? 'guess' : 'guesses'} left
      </p>

      {guesses.length > 0 ? (
        <ul aria-label="Your guesses, in alphabetical order" className="flex w-full flex-col gap-1">
          {guesses.map((guess) => (
            <li
              key={guess.word}
              className="flex items-center justify-between gap-2 rounded bg-surface-raised px-3 py-1.5"
            >
              <span className="font-mono text-base font-bold tracking-widest">{guess.word}</span>
              {guess.direction && guess.heat ? (
                <span className="flex items-center gap-3 text-sm">
                  <span className="text-text-muted">
                    <span aria-hidden="true">{guess.direction === 'after' ? '↓ ' : '↑ '}</span>
                    {guess.direction === 'after' ? 'After' : 'Before'}
                  </span>
                  <HeatBadge heat={guess.heat} />
                </span>
              ) : (
                <span className="text-sm font-bold">Found it</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
