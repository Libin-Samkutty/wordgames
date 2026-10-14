import { memo, useMemo } from 'react';

import { STACK_LENGTH, STACK_MODES, boardRows, boardStatus, type StackState } from '@/engine/stack';
import { cn } from '@/lib/cn';

import { Board } from '../board/Board';

export interface StackBoardsProps {
  readonly state: StackState;
  /** Shakes the active row on every open board after a rejected guess (FR-104). */
  readonly shake: boolean;
  readonly reducedMotion: boolean;
}

interface BoardPanelProps {
  readonly state: StackState;
  readonly index: number;
  readonly shakeRow: number | null;
  readonly reducedMotion: boolean;
}

/**
 * One board and its heading. Memoised on what it actually shows, so a guess
 * that does not reach a solved board leaves that board alone, and the other
 * boards only re-derive their rows once per change (NFR-21).
 */
const BoardPanel = memo(
  function BoardPanel({
    state,
    index,
    shakeRow,
    reducedMotion,
  }: BoardPanelProps): React.JSX.Element {
    const total = STACK_MODES[state.mode].boards;
    const solved = boardStatus(state, index) === 'solved';
    const name = `Board ${String(index + 1)} of ${String(total)}${solved ? ', solved' : ''}`;
    // A solved board is finished, so it keeps only the rows it used instead of a grid of blanks.
    const rows = useMemo(() => {
      const all = boardRows(state, index);
      return solved ? all.slice(0, state.boards[index]?.guesses.length ?? all.length) : all;
    }, [state, index, solved]);

    return (
      <div className="flex flex-col items-center gap-1">
        <p
          aria-hidden="true"
          className={cn(
            'text-[0.65rem] font-bold tracking-wide uppercase',
            solved ? 'text-text' : 'text-text-muted',
          )}
        >
          Board {index + 1}
          {solved ? ' ✓' : ''}
        </p>
        <Board
          rows={rows}
          wordLength={STACK_LENGTH}
          shakeRow={shakeRow}
          reducedMotion={reducedMotion}
          label={name}
        />
      </div>
    );
  },
  (previous, next) =>
    previous.index === next.index &&
    previous.shakeRow === next.shakeRow &&
    previous.reducedMotion === next.reducedMotion &&
    previous.state.mode === next.state.mode &&
    previous.state.status === next.state.status &&
    previous.state.currentInput === next.state.currentInput &&
    previous.state.words.length === next.state.words.length &&
    // The reducer replaces only the boards a guess reached, so a frozen board keeps its identity.
    previous.state.boards[previous.index] === next.state.boards[next.index],
);

/**
 * Every board of a game, laid out for its mode (FR-108): Duo side by side,
 * Quad in a 2 x 2 grid. Each is its own `grid` named "Board n of m", with
 * "solved" added once solved (A11Y-20), built from the same `Board` and `Tile`
 * as Wordwright.
 *
 * Tile size is set for the container, not the page, so two boards fit across a
 * 320 px phone. The area scrolls when the boards are taller than the space
 * above the keyboard, which stays on screen (FR-59, FR-108).
 */
export const StackBoards = memo(function StackBoards({
  state,
  shake,
  reducedMotion,
}: StackBoardsProps): React.JSX.Element {
  const shakeRow = shake ? state.words.length : null;

  return (
    <div
      role="group"
      aria-label="Boards"
      // A scrollable region must be reachable by keyboard (WCAG 2.1.1, axe
      // scrollable-region-focusable), so a keyboard user can scroll Quad's boards.
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- see above
      tabIndex={0}
      className={cn(
        'grid w-full [scrollbar-gutter:stable_both-edges] justify-center gap-x-3 gap-y-4 overflow-y-auto overscroll-contain px-1 py-1',
        'max-h-[clamp(8rem,calc(100dvh-22rem),44rem)] grid-cols-[repeat(2,max-content)]',
      )}
      // Two boards of five tiles must fit the width of a 320 px phone.
      style={{ '--size-tile': 'min(2.5rem, calc((100vw - 3.75rem) / 10))' } as React.CSSProperties}
    >
      {state.boards.map((_board, index) => (
        <BoardPanel
          key={index}
          state={state}
          index={index}
          shakeRow={shakeRow}
          reducedMotion={reducedMotion}
        />
      ))}
    </div>
  );
});
