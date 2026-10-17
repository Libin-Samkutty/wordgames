import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider } from '@/state';
import { WeaverStatsProvider } from '@/state/weaver';
import {
  createWeaverStatsRepository,
  defaultWeaverStats,
  recordWeaverGame,
  type WeaverStatsState,
} from '@/storage';
import type { LadderRowView, WeaverRecord } from '@/engine/weaver';
import { differsByOneLetter } from '@/engine/weaver';

import { WEAVER_HELP_EXAMPLES } from './helpExamples';
import { WeaverBoard } from './WeaverBoard';
import { WeaverHelpModal } from './WeaverHelpModal';
import { WeaverResultPanel } from './WeaverResultPanel';
import { WeaverStatsModal } from './WeaverStatsModal';

/**
 * WordWeaver components in isolation: the board's structure, the par labels,
 * the help example and the statistics dialog (T-67, T-69, T-70).
 */

function row(
  kind: LadderRowView['kind'],
  label: string,
  word: string,
  end = 'WARM',
): LadderRowView {
  return {
    kind,
    label,
    tiles: [...word].map((letter, i) => ({
      letter,
      state: letter === end[i] ? 'correct' : 'absent',
    })),
    isActive: false,
    isRevealing: false,
  };
}

describe('WeaverBoard (FR-88, A11Y-16)', () => {
  /** A ladder of 15 rungs between the start and the end. */
  function longLadder(): LadderRowView[] {
    return [
      row('start', 'Start', 'COLD'),
      ...Array.from({ length: 15 }, (_unused, i) => row('rung', `Rung ${String(i + 1)}`, 'CORD')),
      {
        kind: 'input',
        label: 'Next rung',
        tiles: [0, 1, 2, 3].map(() => ({ letter: '', state: 'empty' as const })),
        isActive: true,
        isRevealing: false,
      },
      row('end', 'End', 'WARM'),
    ];
  }

  it('is one grid named "Word ladder" with a labelled row for each rung', () => {
    render(<WeaverBoard rows={longLadder()} length={4} shakeInput={false} reducedMotion />);

    const grid = screen.getByRole('grid', { name: 'Word ladder' });
    const names = within(grid)
      .getAllByRole('row')
      .map((r) => r.getAttribute('aria-label'));

    expect(names[0]).toBe('Start');
    expect(names).toContain('Rung 15');
    expect(names.at(-2)).toBe('Next rung');
    expect(names.at(-1)).toBe('End');
  });

  it('keeps the input row inside the scrolling area and the end row outside it (FR-88)', () => {
    render(<WeaverBoard rows={longLadder()} length={4} shakeInput={false} reducedMotion />);

    const scroller = screen.getByRole('rowgroup');
    const input = screen.getByRole('row', { name: 'Next rung' });
    const end = screen.getByRole('row', { name: 'End' });
    const start = screen.getByRole('row', { name: 'Start' });

    expect(scroller).toContainElement(input);
    expect(scroller).not.toContainElement(end);
    expect(scroller).not.toContainElement(start);
    expect(scroller.className).toContain('overflow-y-auto');
    // 15 rungs, the input row and the end row are all present in the DOM.
    expect(within(screen.getByRole('grid')).getAllByRole('row')).toHaveLength(18);
  });

  it('scrolls the newest row into view as the ladder grows', () => {
    const scrollIntoView = vi.fn();
    const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');
    Element.prototype.scrollIntoView = scrollIntoView;

    try {
      const { rerender } = render(
        <WeaverBoard
          rows={longLadder().slice(0, 4).concat(longLadder().slice(-2))}
          length={4}
          shakeInput={false}
          reducedMotion
        />,
      );
      rerender(<WeaverBoard rows={longLadder()} length={4} shakeInput={false} reducedMotion />);

      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
    } finally {
      if (descriptor) Object.defineProperty(Element.prototype, 'scrollIntoView', descriptor);
      else Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
    }
  });

  it('tolerates a test environment with no scrollIntoView', () => {
    expect(() => {
      render(<WeaverBoard rows={longLadder()} length={4} shakeInput={false} reducedMotion />);
    }).not.toThrow();
  });

  it('shakes only the input row, and only with motion allowed', () => {
    const { rerender } = render(
      <WeaverBoard rows={longLadder()} length={4} shakeInput reducedMotion={false} />,
    );

    expect(screen.getByRole('row', { name: 'Next rung' }).className).toContain('animate-shake');
    expect(screen.getByRole('row', { name: 'Start' }).className).not.toContain('animate-shake');

    rerender(<WeaverBoard rows={longLadder()} length={4} shakeInput reducedMotion />);
    expect(screen.getByRole('row', { name: 'Next rung' }).className).not.toContain('animate-shake');
  });

  it('describes each tile in terms of the end word', () => {
    render(<WeaverBoard rows={longLadder()} length={4} shakeInput={false} reducedMotion />);

    expect(
      screen.getByRole('gridcell', { name: 'End, letter 1: W, matches end word' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('gridcell', { name: 'Start, letter 1: C, does not match' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('gridcell', { name: 'Next rung, letter 1: empty, empty' }),
    ).toBeInTheDocument();
  });
});

describe('WeaverResultPanel (T-69: FR-91, US-30)', () => {
  function summary(moves: number, par: number, solved = true) {
    const over = moves - par;
    return {
      moves,
      par,
      ladderLength: moves,
      overPar: over,
      parHit: solved && over <= 0,
      label: !solved
        ? null
        : over === 0
          ? 'Par!'
          : over < 0
            ? `Under par by ${String(-over)}!`
            : `+${String(over)}`,
    };
  }

  function renderPanel(over: Partial<Parameters<typeof WeaverResultPanel>[0]> = {}) {
    const props = {
      solved: true,
      summary: summary(4, 4),
      length: 4 as const,
      playerLadder: ['COLD', 'CORD', 'CARD', 'WARD', 'WARM'],
      optimalLadder: null,
      onPlayAgain: vi.fn(),
      onChangeLength: vi.fn(),
      ...over,
    };
    return { props, ...render(<WeaverResultPanel {...props} />) };
  }

  it.each([
    [4, 4, 'Par!'],
    [3, 4, 'Under par by 1!'],
    [2, 4, 'Under par by 2!'],
    [6, 4, '+2'],
    [5, 4, '+1'],
  ])('renders %i moves against par %i as %s', (moves, par, label) => {
    renderPanel({ summary: summary(moves, par) });

    expect(screen.getByRole('heading', { name: 'Solved!' })).toBeInTheDocument();
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(`${String(moves)} moves? · Par ${String(par)}`)),
    ).toBeInTheDocument();
  });

  it('says "1 move" in the singular', () => {
    renderPanel({ summary: summary(1, 1) });

    expect(screen.getByText(/1 move · Par 1/)).toBeInTheDocument();
  });

  it('shows "Gave up" with the shortest ladder and no par label', () => {
    renderPanel({
      solved: false,
      summary: summary(2, 4, false),
      playerLadder: ['COLD', 'CORD', 'CARD'],
      optimalLadder: ['COLD', 'CORD', 'CARD', 'WARD', 'WARM'],
    });

    expect(screen.getByRole('heading', { name: 'Gave up' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'A shortest ladder' })).toBeInTheDocument();
    expect(screen.queryByText('Par!')).not.toBeInTheDocument();
    expect(screen.getByText(/2 moves · Par 4/)).toBeInTheDocument();
  });

  it('shows no shortest ladder after a solve', () => {
    renderPanel();

    expect(screen.queryByRole('heading', { name: 'A shortest ladder' })).not.toBeInTheDocument();
  });

  it('calls onPlayAgain from the button, and from physical Enter on the page (FR-72)', async () => {
    const user = userEvent.setup();
    const { props } = renderPanel();

    await user.click(screen.getByRole('button', { name: 'Play again' }));
    expect(props.onPlayAgain).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document.body, { key: 'Enter' });
    expect(props.onPlayAgain).toHaveBeenCalledTimes(2);
  });

  it('offers only the other length under Change length', async () => {
    const user = userEvent.setup();
    const { props } = renderPanel();

    await user.click(screen.getByRole('button', { name: 'Change length' }));
    const group = screen.getByRole('group', { name: 'New game length' });
    expect(within(group).queryByRole('button', { name: '4 letters' })).not.toBeInTheDocument();
    await user.click(within(group).getByRole('button', { name: '5 letters' }));

    expect(props.onChangeLength).toHaveBeenCalledWith(5);
  });
});

describe('WeaverHelpModal (T-70: FR-95, US-31, AC-42, A11Y-13)', () => {
  function exampleRows(): HTMLElement[] {
    const decorative = document.body.querySelector('[aria-hidden="true"].flex-col') as HTMLElement;
    return [...decorative.children] as HTMLElement[];
  }

  it('shows 4 tiles per row at 4 letters (AC-42)', () => {
    render(<WeaverHelpModal isOpen length={4} onClose={vi.fn()} />);

    const rows = exampleRows();
    expect(rows).toHaveLength(4); // start, two rungs, end
    for (const r of rows) expect(r.children).toHaveLength(4);
  });

  it('shows 5 tiles per row at 5 letters (AC-42)', () => {
    render(<WeaverHelpModal isOpen length={5} onClose={vi.fn()} />);

    for (const r of exampleRows()) expect(r.children).toHaveLength(5);
  });

  it('keeps the example decorative, with the meaning in a sentence (A11Y-13)', () => {
    render(<WeaverHelpModal isOpen length={4} onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog', { name: 'How to play' });
    // No orphan gridcells: the example never uses Tile.
    expect(within(dialog).queryByRole('gridcell')).not.toBeInTheDocument();
    expect(dialog).toHaveTextContent('The ladder runs COLD, CORD, CARD, then WARM.');
    expect(dialog).toHaveTextContent('A and R already match WARM, so they are green.');
  });

  it('computes the example colours from the engine, so green really matches the end word', () => {
    render(<WeaverHelpModal isOpen length={4} onClose={vi.fn()} />);

    // CARD against WARM: positions 2 and 3 are green, so two tiles carry the correct class.
    const cardRow = exampleRows()[2] as HTMLElement;
    const greens = [...cardRow.children].filter((tile) =>
      tile.className.includes('bg-tile-correct'),
    );
    expect(greens).toHaveLength(2);
    // The colourblind markers sit inside the tiles, so read the letters from the first character of each.
    expect([...cardRow.children].map((tile) => tile.textContent?.[0]).join('')).toBe('CARD');
  });

  it('explains the rules, undo, give up and par (FR-95)', () => {
    render(<WeaverHelpModal isOpen length={5} onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog', { name: 'How to play' });
    expect(dialog).toHaveTextContent(/exactly one letter/);
    expect(dialog).toHaveTextContent(/5 letter word/);
    expect(dialog).toHaveTextContent(/green/);
    expect(dialog).toHaveTextContent(/Tap Undo/);
    expect(dialog).toHaveTextContent(/Give up/);
    expect(dialog).toHaveTextContent(/Par is the shortest ladder/);
  });

  it('renders nothing while closed', () => {
    render(<WeaverHelpModal isOpen={false} length={4} onClose={vi.fn()} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it.each([4, 5] as const)(
    'uses a real ladder for the %i-letter example, one letter per step',
    (length) => {
      const { start, rungs, end } = WEAVER_HELP_EXAMPLES[length];
      const steps = [start, ...rungs];

      for (const word of [...steps, end]) expect(word).toHaveLength(length);
      for (let i = 1; i < steps.length; i += 1) {
        expect(differsByOneLetter(steps[i - 1] as string, steps[i] as string)).toBe(true);
      }
      // The last rung is not yet the end word, or the example would be over.
      expect(steps.at(-1)).not.toBe(end);
    },
  );
});

describe('WeaverStatsModal (T-70: FR-92, FR-47, US-30)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function record(
    id: string,
    moves: number,
    par: number,
    over: Partial<WeaverRecord> = {},
  ): WeaverRecord {
    return {
      id,
      playedAt: 1_000,
      length: 4,
      start: 'COLD',
      end: 'WARM',
      par,
      moves,
      ladderLength: moves,
      solved: true,
      ...over,
    };
  }

  function seed(build: (stats: WeaverStatsState) => WeaverStatsState): void {
    createWeaverStatsRepository().write(build(defaultWeaverStats()));
  }

  function renderModal() {
    return render(
      <ToastProvider>
        <WeaverStatsProvider>
          <WeaverStatsModal isOpen onClose={vi.fn()} />
        </WeaverStatsProvider>
      </ToastProvider>,
    );
  }

  function tile(label: string): string {
    const dialog = screen.getByRole('dialog', { name: 'Statistics' });
    return within(dialog).getByText(label, { selector: 'dt' }).closest('div')?.textContent ?? '';
  }

  it('shows the empty state, never zeros or NaN, with no puzzles played (FR-41)', () => {
    renderModal();

    const dialog = screen.getByRole('dialog', { name: 'Statistics' });
    expect(dialog).toHaveTextContent('No puzzles yet');
    expect(dialog.textContent).not.toContain('NaN');
    expect(within(dialog).queryByRole('button', { name: /Reset/ })).not.toBeInTheDocument();
  });

  it('matches a hand-computed set of statistics', () => {
    // Oldest first: solved at par, solved under par, solved over par, gave up,
    // then a 5-letter solve at par.
    seed((s) => {
      let stats = recordWeaverGame(s, record('a', 4, 4));
      stats = recordWeaverGame(stats, record('b', 3, 4));
      stats = recordWeaverGame(stats, record('c', 7, 4));
      stats = recordWeaverGame(stats, record('d', 2, 4, { solved: false }));
      return recordWeaverGame(
        stats,
        record('e', 5, 5, { length: 5, start: 'CRANE', end: 'GRAPH' }),
      );
    });
    renderModal();

    // Overall: played 5, solved 4, gave up 1, 80%, par hits 3 (4/4, 3/4, 5/5),
    // total over par 0 + -1 + 3 + 0 = 2, average 0.5, current streak 1, best 3.
    expect(tile('Played')).toContain('5');
    expect(tile('Solved')).toContain('4');
    expect(tile('Gave up')).toContain('1');
    expect(tile('Solve %')).toContain('80%');
    expect(tile('Par hits')).toContain('3');
    expect(tile('Avg over par')).toContain('+0.5');
    // Best single solve: one under par (3 moves on par 4).
    expect(tile('Best vs par')).toContain('−1');
    expect(tile('Current streak')).toContain('1');
    expect(tile('Best streak')).toContain('3');
  });

  it('switches to a per-length view', async () => {
    seed((s) => {
      let stats = recordWeaverGame(s, record('a', 4, 4));
      stats = recordWeaverGame(stats, record('b', 6, 4));
      return recordWeaverGame(
        stats,
        record('c', 5, 5, { length: 5, start: 'CRANE', end: 'GRAPH' }),
      );
    });
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('radio', { name: '4 letters' }));
    // 4 letters: played 2, solved 2, par hits 1, average (0 + 2) / 2 = 1.0.
    expect(tile('Played')).toContain('2');
    expect(tile('Par hits')).toContain('1');
    expect(tile('Avg over par')).toContain('+1.0');

    await user.click(screen.getByRole('radio', { name: '5 letters' }));
    expect(tile('Played')).toContain('1');
    expect(tile('Avg over par')).toContain('0.0');
  });

  it('shows the best against par as Par, under or over', () => {
    seed((s) => recordWeaverGame(s, record('a', 4, 4)));
    const { unmount } = renderModal();
    expect(tile('Best vs par')).toContain('Par');
    unmount();
    localStorage.clear();

    seed((s) => recordWeaverGame(s, record('b', 7, 4)));
    renderModal();
    expect(tile('Best vs par')).toContain('+3');
  });

  it('shows a negative average over par (AC-44)', () => {
    seed((s) => recordWeaverGame(s, record('a', 3, 4)));
    renderModal();

    expect(tile('Avg over par')).toContain('-1.0');
  });

  it('shows an em dash for average over par with no solves (FR-92)', () => {
    seed((s) => recordWeaverGame(s, record('a', 2, 4, { solved: false })));
    renderModal();

    expect(tile('Avg over par')).toContain('—');
    expect(tile('Best vs par')).toContain('—');
    expect(tile('Solve %')).toContain('0%');
    expect(tile('Gave up')).toContain('1');
  });

  it('lists recent puzzles with moves against par, or Gave up', () => {
    seed((s) => {
      const stats = recordWeaverGame(s, record('a', 5, 4));
      return recordWeaverGame(
        stats,
        record('b', 2, 4, { solved: false, start: 'WARM', end: 'COLD' }),
      );
    });
    renderModal();

    const dialog = screen.getByRole('dialog', { name: 'Statistics' });
    const items = within(dialog).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('WARM → COLD');
    expect(items[0]).toHaveTextContent('Gave up');
    expect(items[1]).toHaveTextContent('COLD → WARM');
    expect(items[1]).toHaveTextContent('5/4');
  });

  it("only lists the selected length's puzzles in a per-length view", async () => {
    seed((s) => {
      const stats = recordWeaverGame(s, record('a', 4, 4));
      return recordWeaverGame(
        stats,
        record('b', 5, 5, { length: 5, start: 'CRANE', end: 'GRAPH' }),
      );
    });
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('radio', { name: '5 letters' }));

    const dialog = screen.getByRole('dialog', { name: 'Statistics' });
    expect(within(dialog).getByText('CRANE → GRAPH')).toBeInTheDocument();
    expect(within(dialog).queryByText('COLD → WARM')).not.toBeInTheDocument();
  });

  it('resets only WordWeaver statistics, keeping the recent puzzles, after confirming (FR-47)', async () => {
    seed((s) => recordWeaverGame(s, record('a', 4, 4)));
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('button', { name: 'Reset statistics' }));
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent(/puzzles played, solved and given up/);
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));

    expect(createWeaverStatsRepository().read().overall.gamesPlayed).toBe(0);
    expect(createWeaverStatsRepository().read().recentGames).toHaveLength(1);
  });
});
