import { memo, useEffect, useRef } from 'react';

import type { LadderRowView, LadderTileView } from '@/engine/weaver';
import { cn } from '@/lib/cn';

import { REVEAL_STAGGER_MS } from '../board/Board';
import { Tile } from '../board/Tile';

/** What a tile's state means on a ladder: it is about the end word (FR-81, A11Y-16). */
const STATE_LABEL: Record<LadderTileView['state'], string> = {
  empty: 'empty',
  filled: 'entered',
  correct: 'matches end word',
  absent: 'does not match',
};

export interface WeaverBoardProps {
  readonly rows: readonly LadderRowView[];
  readonly length: number;
  /** Shakes the input row after a rejected rung (FR-80). */
  readonly shakeInput: boolean;
  readonly reducedMotion: boolean;
}

function LadderRow({
  row,
  rowIndex,
  length,
  shake,
  reducedMotion,
}: {
  row: LadderRowView;
  rowIndex: number;
  length: number;
  shake: boolean;
  reducedMotion: boolean;
}): React.JSX.Element {
  return (
    <div
      role="row"
      aria-label={row.label}
      aria-rowindex={rowIndex + 1}
      data-row-kind={row.kind}
      className={cn('grid justify-center gap-1.5', shake && !reducedMotion && 'animate-shake')}
      style={{ gridTemplateColumns: `repeat(${String(length)}, minmax(0, auto))` }}
    >
      {row.tiles.map((tile, column) => (
        <Tile
          key={column}
          letter={tile.letter}
          state={tile.state}
          row={rowIndex + 1}
          column={column + 1}
          ariaLabel={`${row.label}, letter ${String(column + 1)}: ${tile.letter || 'empty'}, ${STATE_LABEL[tile.state]}`}
          isRevealing={row.isRevealing}
          revealDelayMs={column * REVEAL_STAGGER_MS}
          reducedMotion={reducedMotion}
        />
      ))}
    </div>
  );
}

/**
 * The word ladder (FR-88, FR-89, A11Y-16): the start row, the rungs and the
 * input row in a scrolling area, and the end row pinned below it.
 *
 * One `grid` named "Word ladder". The middle is a `rowgroup`, so the scroll
 * container does not break the grid's structure for assistive tech. The end
 * row sits outside the scroll area, so it stays on screen however long the
 * ladder grows.
 */
export const WeaverBoard = memo(function WeaverBoard({
  rows,
  length,
  shakeInput,
  reducedMotion,
}: WeaverBoardProps): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the newest row in view as the ladder grows (FR-88). `scrollIntoView`
  // is absent in some test environments, so it is optional.
  const rowCount = rows.length;
  useEffect(() => {
    const active = scrollRef.current?.querySelector('[data-row-kind="input"]');
    // Read through `Partial` so the optional call type-checks honestly.
    const scrollIntoView = (active as Partial<Element> | null | undefined)?.scrollIntoView;
    scrollIntoView?.call(active, { block: 'nearest' });
  }, [rowCount]);

  const first = rows[0];
  const last = rows[rows.length - 1];
  const middle = rows.slice(1, -1);

  return (
    <div
      role="grid"
      aria-label="Word ladder"
      aria-rowcount={rows.length}
      aria-colcount={length}
      className="flex flex-col gap-1.5"
      // Tiles shrink on a short window, so the rungs get room and the keyboard stays on screen.
      style={{ '--size-tile': 'clamp(1.75rem, 7dvh, 4rem)' } as React.CSSProperties}
    >
      {first ? (
        <LadderRow
          row={first}
          rowIndex={0}
          length={length}
          shake={false}
          reducedMotion={reducedMotion}
        />
      ) : null}

      <div
        ref={scrollRef}
        role="rowgroup"
        // Capped so the end row and the keyboard stay on screen, but never below two rows,
        // so the previous rung and the input row are always both visible; older rungs scroll.
        className="flex max-h-[max(calc(var(--size-tile)*2+0.375rem),clamp(3.5rem,calc(100dvh-33rem),20rem))] [scrollbar-gutter:stable_both-edges] flex-col gap-1.5 overflow-y-auto overscroll-contain"
      >
        {middle.map((row, index) => (
          <LadderRow
            key={`${row.kind}-${String(index)}`}
            row={row}
            rowIndex={index + 1}
            length={length}
            shake={row.kind === 'input' && shakeInput}
            reducedMotion={reducedMotion}
          />
        ))}
      </div>

      {last ? (
        <LadderRow
          row={last}
          rowIndex={rows.length - 1}
          length={length}
          shake={false}
          reducedMotion={reducedMotion}
        />
      ) : null}
    </div>
  );
});
