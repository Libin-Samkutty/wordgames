import { memo } from 'react';

import { isGameOver, slotGroups, usedPositions, type HuntState } from '@/engine/hunt';
import { cn } from '@/lib/cn';

import { TILE_STATE_CLASS } from '../board/tileAppearance';
import { groupHeading, slotLabel, trayLabel, wordRowLabel } from './huntLabels';

export interface HuntBoardProps {
  readonly state: HuntState;
  /** Shakes the word row after a rejected word (FR-161). */
  readonly shake: boolean;
  readonly reducedMotion: boolean;
  readonly disabled: boolean;
  readonly onTapLetter: (letter: string) => void;
}

/**
 * The WordHunt board (FR-160): the slots for every word to find, the word being
 * built, and the tray.
 *
 * The slots are grouped by length, so a player sees how many words are left at
 * each. A found word fills its own slot. After a give up, the missed words show
 * in theirs, marked in text as well as in style, so nothing relies on colour
 * alone (A11Y-8). Each tray entry is a button at least 44 px square, so six fit
 * across a 320 px phone. Typing and tapping build the same word.
 */
export const HuntBoard = memo(function HuntBoard({
  state,
  shake,
  reducedMotion,
  disabled,
  onTapLetter,
}: HuntBoardProps): React.JSX.Element {
  const groups = slotGroups(state);
  const used = usedPositions(state);
  const revealMissed = state.status === 'gave-up';

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-3">
      <div
        role="group"
        aria-label="Words to find"
        // A scrollable region must be reachable by keyboard (WCAG 2.1.1, axe
        // scrollable-region-focusable), so a keyboard user can scroll the slots
        // while the tray below stays on screen (FR-59).
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- see above
        tabIndex={0}
        className="flex max-h-[clamp(4rem,calc(100dvh-22rem),30rem)] w-full flex-col gap-3 overflow-y-auto overscroll-contain px-1 py-1"
      >
        {groups.map((group) => (
          <section key={group.length} aria-label={`${String(group.length)}-letter words`}>
            <h3 className="mb-1 text-xs font-bold tracking-wide text-text-muted uppercase">
              {groupHeading(group.length, group.slots)}
            </h3>
            <ul className="flex flex-wrap gap-1.5">
              {group.slots.map((slot) => (
                <li
                  key={slot.word}
                  aria-label={slotLabel(slot, revealMissed)}
                  data-found={slot.found}
                  className={cn(
                    'flex h-8 items-center justify-center rounded-sm border-2 px-1.5 font-mono text-sm font-bold tracking-widest uppercase',
                    slot.found
                      ? 'border-tile-correct bg-surface-raised text-text'
                      : revealMissed
                        ? 'border-tile-present text-text'
                        : 'border-dashed border-tile-empty-border select-none',
                  )}
                  style={{ minWidth: `${String(slot.word.length * 1.1 + 1)}rem` }}
                >
                  <span aria-hidden="true">{slot.found || revealMissed ? slot.word : ''}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {state.bonus.length > 0 ? (
        <p className="text-center text-sm text-text-muted">
          Bonus words ({String(state.bonus.length)}):{' '}
          <span className="font-mono font-bold tracking-wider">{state.bonus.join(' ')}</span>
        </p>
      ) : null}

      {isGameOver(state) ? null : (
        <>
          <div
            role="group"
            aria-label={wordRowLabel(state)}
            className={cn(
              'flex min-h-12 items-center justify-center gap-1.5',
              shake && !reducedMotion && 'animate-shake',
            )}
          >
            {[...state.currentInput].map((letter, index) => (
              <span
                key={index}
                aria-hidden="true"
                className={cn(
                  'flex size-11 items-center justify-center border-2 text-2xl font-bold uppercase select-none sm:size-12',
                  TILE_STATE_CLASS.filled,
                  !reducedMotion && 'animate-pop',
                )}
              >
                {letter}
              </span>
            ))}
            {state.currentInput === '' ? (
              <span aria-hidden="true" className="text-sm text-text-muted">
                Type or tap letters
              </span>
            ) : null}
          </div>

          <div
            role="group"
            aria-label="Letter tray"
            className="flex min-h-11 flex-wrap items-center justify-center gap-1.5"
          >
            {[...state.tray].map((letter, index) => (
              <button
                key={`${String(index)}-${letter}`}
                type="button"
                disabled={disabled || used[index] === true}
                aria-label={trayLabel(letter, used[index] === true)}
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
          </div>
        </>
      )}
    </div>
  );
});
