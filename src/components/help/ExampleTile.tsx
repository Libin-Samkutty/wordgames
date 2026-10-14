import type { TileState } from '@/engine';
import { cn } from '@/lib/cn';

import { TILE_STATE_CLASS, TILE_STATE_MARKER } from '../board/tileAppearance';

/**
 * A static illustration of one tile state (FR-60).
 *
 * Deliberately not `Tile`: that component renders `role="gridcell"`, valid
 * only inside a grid/row ancestry. Dropped into a dialog it would be an orphan
 * gridcell — a critical axe `aria-required-parent` violation — and wrapping it
 * in a fake `role="grid"` would hand screen readers a navigable data table
 * that does not exist. Colour comes from the board's own maps so the two can
 * never disagree.
 */
export function ExampleTile({
  letter,
  state,
}: {
  letter: string;
  state: TileState;
}): React.JSX.Element {
  const marker = TILE_STATE_MARKER[state];

  return (
    <span
      className={cn(
        'relative flex size-8 items-center justify-center border-2 text-base font-bold uppercase sm:size-10 sm:text-lg',
        TILE_STATE_CLASS[state],
      )}
    >
      {letter}
      {marker ? (
        <span className="absolute top-0 right-0.5 text-[0.6rem] leading-none opacity-0 in-data-[palette=cb]:opacity-100">
          {marker}
        </span>
      ) : null}
    </span>
  );
}
