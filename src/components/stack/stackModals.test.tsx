import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { StackRecord } from '@/engine/stack';
import { ToastProvider } from '@/state';
import { StackStatsProvider } from '@/state/stack';
import {
  createStackStatsRepository,
  defaultStackStats,
  recordStackGame,
  type StackStatsState,
} from '@/storage';

import { StackHelpModal } from './StackHelpModal';
import { StackResultPanel } from './StackResultPanel';
import { StackStatsModal } from './StackStatsModal';
import { STACK_HELP_EXAMPLE } from './helpExample';
import { ModeSelector } from './ModeSelector';
import { StackBoards } from './StackBoards';
import { createStackGame } from '@/engine/stack';

/** WordStack dialogs and panels in isolation (T-78, T-79). */

describe('StackHelpModal (FR-114, A11Y-13)', () => {
  it('explains shared guesses, the colours and the split keyboard', () => {
    render(<StackHelpModal isOpen onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog', { name: 'How to play' });
    expect(dialog).toHaveTextContent(/every board that is still open/);
    expect(dialog).toHaveTextContent(/2 boards and 7 guesses/);
    expect(dialog).toHaveTextContent(/4 boards and 9 guesses/);
    expect(dialog).toHaveTextContent(/Green means the right spot/);
    expect(dialog).toHaveTextContent(/left half is board 1/);
  });

  it('shows a two-board example, decorative, with the meaning in a sentence (A11Y-13)', () => {
    render(<StackHelpModal isOpen onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog', { name: 'How to play' });
    const decorative = dialog.querySelector('[aria-hidden="true"].flex-col') as HTMLElement;
    // Two boards of five tiles, plus the split-key illustration.
    const boards = [...decorative.children].slice(0, 2);
    expect(boards).toHaveLength(2);
    for (const board of boards)
      expect(board.querySelectorAll('span.size-8, span.sm\\:size-10')).toHaveLength(5);
    expect(within(dialog).queryByRole('gridcell')).not.toBeInTheDocument();
    expect(dialog).toHaveTextContent(`You guess ${STACK_HELP_EXAMPLE.guess} on two boards.`);
    expect(dialog).toHaveTextContent('On board 1, A is green.');
    expect(dialog).toHaveTextContent('On board 2, R is yellow.');
  });

  it('renders nothing while closed', () => {
    render(<StackHelpModal isOpen={false} onClose={vi.fn()} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('StackStatsModal (FR-111, FR-47)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function record(id: string, over: Partial<StackRecord>): StackRecord {
    return {
      id,
      playedAt: 1_000,
      mode: 'duo',
      answers: ['PLANT', 'STORM'],
      guessesUsed: 5,
      boardsSolved: 2,
      won: true,
      ...over,
    };
  }

  const quad = (id: string, over: Partial<StackRecord>): StackRecord =>
    record(id, { mode: 'quad', answers: ['PLANT', 'STORM', 'CRANE', 'MOUND'], ...over });

  function seed(build: (stats: StackStatsState) => StackStatsState): void {
    createStackStatsRepository().write(build(defaultStackStats()));
  }

  function renderModal() {
    return render(
      <ToastProvider>
        <StackStatsProvider>
          <StackStatsModal isOpen onClose={vi.fn()} />
        </StackStatsProvider>
      </ToastProvider>,
    );
  }

  function tile(label: string): string {
    const dialog = screen.getByRole('dialog', { name: 'Statistics' });
    return within(dialog).getByText(label, { selector: 'dt' }).closest('div')?.textContent ?? '';
  }

  it('shows the empty state, never zeros or NaN, with no games played (FR-41)', () => {
    renderModal();

    const dialog = screen.getByRole('dialog', { name: 'Statistics' });
    expect(dialog).toHaveTextContent('No games yet');
    expect(dialog.textContent).not.toContain('NaN');
    expect(within(dialog).queryByRole('button', { name: /Reset/ })).not.toBeInTheDocument();
  });

  it('matches a hand-computed set of statistics, overall and per mode', async () => {
    // Oldest first: Duo win in 3, Duo win in 5, Duo loss, Quad win in 6, Quad loss.
    seed((s) => {
      let stats = recordStackGame(s, record('a', { guessesUsed: 3 }));
      stats = recordStackGame(stats, record('b', { guessesUsed: 5 }));
      stats = recordStackGame(stats, record('c', { won: false, guessesUsed: 7, boardsSolved: 1 }));
      stats = recordStackGame(stats, quad('d', { guessesUsed: 6, boardsSolved: 4 }));
      return recordStackGame(stats, quad('e', { won: false, guessesUsed: 9, boardsSolved: 2 }));
    });
    const user = userEvent.setup();
    renderModal();

    // Overall: 5 played, 3 won, 60%, current streak 0, best 2.
    expect(tile('Played')).toContain('5');
    expect(tile('Win %')).toContain('60%');
    expect(tile('Current streak')).toContain('0');
    expect(tile('Best streak')).toContain('2');

    // Duo: 3 played, 2 won, 67%, best 2, distribution 3 → index 1 and 5 → index 3 (buckets 2..7).
    await user.click(screen.getByRole('radio', { name: 'Duo' }));
    expect(tile('Played')).toContain('3');
    expect(tile('Win %')).toContain('67%');
    expect(tile('Best streak')).toContain('2');
    const dialog = screen.getByRole('dialog', { name: 'Statistics' });
    expect(dialog).toHaveTextContent('Duo wins by guesses (2 to 7)');
    const bars = [...dialog.querySelectorAll('[data-has-count]')].map((el) => el.textContent);
    expect(bars).toEqual(['0', '1', '0', '1', '0', '0']);

    // Quad: 2 played, 1 won, 50%, distribution 6 → index 2 (buckets 4..9).
    await user.click(screen.getByRole('radio', { name: 'Quad' }));
    expect(tile('Played')).toContain('2');
    expect(tile('Win %')).toContain('50%');
    expect(dialog).toHaveTextContent('Quad wins by guesses (4 to 9)');
    const quadBars = [...dialog.querySelectorAll('[data-has-count]')].map((el) => el.textContent);
    expect(quadBars).toEqual(['0', '0', '1', '0', '0', '0']);
  });

  it('lists recent games by mode, with guesses for a win and boards for a loss', () => {
    seed((s) => {
      const stats = recordStackGame(s, record('a', { guessesUsed: 5 }));
      return recordStackGame(stats, quad('b', { won: false, guessesUsed: 9, boardsSolved: 2 }));
    });
    renderModal();

    const items = within(screen.getByRole('dialog', { name: 'Statistics' })).getAllByRole(
      'listitem',
    );
    expect(items[0]).toHaveTextContent('PLANT STORM CRANE MOUND');
    expect(items[0]).toHaveTextContent('Quad · 2/4 solved');
    expect(items[1]).toHaveTextContent('PLANT STORM');
    expect(items[1]).toHaveTextContent('Duo · 5/7');
  });

  it("only lists the chosen mode's games in a per-mode view", async () => {
    seed((s) => recordStackGame(recordStackGame(s, record('a', {})), quad('b', {})));
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('radio', { name: 'Quad' }));

    const dialog = screen.getByRole('dialog', { name: 'Statistics' });
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(1);
    expect(dialog).toHaveTextContent('PLANT STORM CRANE MOUND');
  });

  it('resets only WordStack statistics after confirming, keeping the recent games', async () => {
    seed((s) => recordStackGame(s, record('a', {})));
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('button', { name: 'Reset statistics' }));
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent(
      /games played, win percentages, streaks, times and the guess distributions/,
    );
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));

    expect(createStackStatsRepository().read().overall.gamesPlayed).toBe(0);
    expect(createStackStatsRepository().read().recentGames).toHaveLength(1);
  });
});

describe('StackResultPanel (FR-110)', () => {
  function renderPanel(over: Partial<Parameters<typeof StackResultPanel>[0]> = {}) {
    const props = {
      won: true,
      mode: 'duo' as const,
      guessesUsed: 5,
      maxGuesses: 7,
      boardsSolved: 2,
      answers: [
        { word: 'PLANT', solved: true },
        { word: 'STORM', solved: true },
      ],
      onPlayAgain: vi.fn(),
      onChangeMode: vi.fn(),
      ...over,
    };
    return { props, ...render(<StackResultPanel {...props} />) };
  }

  it('shows a win with guesses used out of the limit and boards solved', () => {
    renderPanel();

    expect(screen.getByRole('heading', { name: 'You won!' })).toBeInTheDocument();
    expect(screen.getByText(/5 of 7 guesses · 2 of 2 boards solved/)).toBeInTheDocument();
  });

  it('shows a loss with every word, marking the unsolved ones for assistive tech', () => {
    renderPanel({
      won: false,
      boardsSolved: 1,
      guessesUsed: 7,
      answers: [
        { word: 'PLANT', solved: true },
        { word: 'STORM', solved: false },
      ],
    });

    expect(screen.getByRole('heading', { name: 'Out of guesses' })).toBeInTheDocument();
    expect(screen.getByText('STORM').parentElement).toHaveTextContent('(not solved)');
    expect(screen.getByText('PLANT').parentElement).toHaveTextContent('(solved)');
  });

  it('offers only the other mode under Change mode', async () => {
    const user = userEvent.setup();
    const { props } = renderPanel();

    await user.click(screen.getByRole('button', { name: 'Change mode' }));
    const group = screen.getByRole('group', { name: 'New game mode' });
    expect(within(group).queryByRole('button', { name: 'Duo' })).not.toBeInTheDocument();
    await user.click(within(group).getByRole('button', { name: 'Quad' }));

    expect(props.onChangeMode).toHaveBeenCalledWith('quad');
  });
});

describe('ModeSelector (FR-101)', () => {
  it('is a radiogroup with one tab stop, and arrow keys move and wrap', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ModeSelector value="duo" disabled={false} onChange={onChange} />);

    const duo = screen.getByRole('radio', { name: 'Duo' });
    expect(duo).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: 'Quad' })).toHaveAttribute('tabindex', '-1');

    duo.focus();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('quad');
    await user.keyboard('{End}');
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('ignores keys when disabled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ModeSelector value="duo" disabled onChange={onChange} />);

    screen.getByRole('radio', { name: 'Duo' }).focus();
    await user.keyboard('{ArrowRight}');

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('StackBoards layout (FR-108)', () => {
  it('lays out two boards in Duo and four in Quad, sized for the container', () => {
    const { container, rerender } = render(
      <StackBoards
        state={createStackGame('g', 'duo', ['PLANT', 'STORM'])}
        shake={false}
        reducedMotion
      />,
    );
    expect(screen.getAllByRole('grid')).toHaveLength(2);
    const area = container.firstElementChild as HTMLElement;
    expect(area.style.getPropertyValue('--size-tile')).toContain('100vw');
    expect(area.className).toContain('overflow-y-auto');

    rerender(
      <StackBoards
        state={createStackGame('g', 'quad', ['PLANT', 'STORM', 'CRANE', 'MOUND'])}
        shake={false}
        reducedMotion
      />,
    );
    expect(screen.getAllByRole('grid')).toHaveLength(4);
  });

  it('shakes the active row of every open board, with motion allowed', () => {
    render(
      <StackBoards
        state={createStackGame('g', 'duo', ['PLANT', 'STORM'])}
        shake
        reducedMotion={false}
      />,
    );

    const shaking = document.querySelectorAll('.animate-shake');
    expect(shaking).toHaveLength(2);
  });
});
