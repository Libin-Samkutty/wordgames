import { memo } from 'react';

import type { LetterState } from '@/engine';
import { cn } from '@/lib/cn';

import { TILE_STATE_MARKER } from '../board/tileAppearance';
import { splitKeyLabel, type SegmentState } from './splitKeyLabel';

export interface SplitKeyProps {
  readonly letter: string;
  /** One entry per board: halves for Duo, quarters for Quad. */
  readonly segments: readonly SegmentState[];
  readonly disabled: boolean;
  readonly onPress: (letter: string) => void;
}

const SEGMENT_CLASS: Record<LetterState, string> = {
  correct: 'bg-key-correct',
  present: 'bg-key-present',
  absent: 'bg-key-absent',
};

/**
 * A letter key split into one segment per board (FR-109, A11Y-20).
 *
 * Left and right halves for Duo, a 2 x 2 grid of quarters for Quad. Each
 * segment shows that board's best state for the letter. A solved board is
 * frozen and tells the player nothing more, so it drops out of the drawing: the
 * key splits only across the boards still open, and is one plain key once a
 * single board is left. The accessible name still lists every board. The letter
 * sits on a small solid chip where the segments differ, so it stays legible.
 *
 * State never relies on colour alone: a segment that is correct or present
 * carries the same marker glyph as a tile, shown in the colourblind palette
 * (A11Y-8). The key is one button whose name lists every board, and the
 * segments are decorative.
 */
/**
 * Props are equal when the letter, flags and every segment state match. The
 * `segments` array is rebuilt on each render of the keyboard, so comparing it
 * by value is what lets a key whose state did not change skip rendering, which
 * matters when a Quad guess re-renders 26 keys of four segments each (NFR-21).
 */
function sameProps(previous: SplitKeyProps, next: SplitKeyProps): boolean {
  return (
    previous.letter === next.letter &&
    previous.disabled === next.disabled &&
    previous.onPress === next.onPress &&
    previous.segments.length === next.segments.length &&
    previous.segments.every((state, index) => state === next.segments[index])
  );
}

export const SplitKey = memo(function SplitKey({
  letter,
  segments,
  disabled,
  onPress,
}: SplitKeyProps): React.JSX.Element {
  // Solved boards are left out of the drawing. If every board is solved, the key is one blank segment.
  const open = segments.filter((state) => state !== null);
  const drawn = open.length > 0 ? open : [undefined];
  const isQuad = drawn.length > 2;
  // The chip is only for a key whose segments differ, where no single text colour reads
  // on every part. A key that is one state all over needs no chip.
  const first = drawn[0];
  const isUniform = drawn.every((state) => state === first);
  const needsChip = !isUniform;

  return (
    <button
      type="button"
      onClick={() => {
        onPress(letter);
      }}
      disabled={disabled}
      aria-label={splitKeyLabel(letter, segments)}
      className={cn(
        'relative h-(--size-key-height) min-w-0 flex-1 overflow-hidden rounded',
        'font-bold uppercase transition-transform duration-150 select-none active:scale-95',
        'disabled:cursor-not-allowed disabled:opacity-50',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-0 grid',
          isQuad ? 'grid-cols-2 grid-rows-2' : drawn.length === 2 ? 'grid-cols-2' : 'grid-cols-1',
        )}
      >
        {drawn.map((state, index) => {
          const marker = state ? TILE_STATE_MARKER[state] : undefined;

          return (
            <span key={index} className={cn('relative', state ? SEGMENT_CLASS[state] : 'bg-key')}>
              {marker ? (
                <span className="absolute top-0 left-0.5 text-[0.55rem] leading-none text-key-text-revealed opacity-0 in-data-[palette=cb]:opacity-100">
                  {marker}
                </span>
              ) : null}
            </span>
          );
        })}
      </span>

      <span
        aria-hidden="true"
        className="relative z-10 flex h-full items-center justify-center text-xs sm:text-sm"
      >
        {/* The chip keeps the letter legible where the segments differ; a uniform key needs none. */}
        <span
          className={cn(
            'px-0.5',
            needsChip
              ? 'rounded-sm bg-surface text-text'
              : first
                ? 'text-key-text-revealed'
                : 'text-key-text',
          )}
        >
          {letter}
        </span>
      </span>
    </button>
  );
}, sameProps);
