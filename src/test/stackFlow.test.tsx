import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '@/App';
import { resetDictionaryCache } from '@/dictionary';
import { gameKeys } from '@/storage';

import { FILLER_GUESSES, useStackFixtures } from './stackFixtures';

/**
 * WordStack end to end through the real providers (T-77 … T-79: FR-102 …
 * FR-114, US-32, US-33, US-38, AC-45 … AC-48, AC-55, AC-56, A11Y-20, A11Y-21).
 *
 * With the fixture lists a Duo game is PLANT and STORM, and a Quad game adds
 * CRANE and MOUND.
 */

type User = ReturnType<typeof userEvent.setup>;

function seed(mode: 'duo' | 'quad' = 'duo', motion: 'reduced' | 'full' = 'reduced'): void {
  localStorage.setItem(
    'wordgames:v1:settings',
    JSON.stringify({ theme: 'system', colorblind: false, motion }),
  );
  localStorage.setItem(gameKeys('stack').prefs, JSON.stringify({ mode }));
}

async function openStack(): Promise<{ user: User }> {
  window.history.replaceState(null, '', '/#/stack');
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('grid', { name: /^Board 1 of/ });
  return { user };
}

async function settle(): Promise<void> {
  await waitFor(() => {
    const over = screen.queryByRole('heading', { name: /You won!|Out of guesses/ });
    const enter = screen.queryByRole('button', { name: 'Enter' });
    expect(over !== null || (enter !== null && !enter.hasAttribute('disabled'))).toBe(true);
  });
}

/** Types each word with the physical keyboard and waits for the reveal. */
async function guess(user: User, ...words: string[]): Promise<void> {
  for (const word of words) {
    await user.keyboard(`${word}{Enter}`);
    await settle();
  }
}

/** The tile states of row `row` (1-based) on board `board` (1-based). */
function rowStates(board: number, row: number): string[] {
  const grid = screen.getByRole('grid', { name: new RegExp(`^Board ${String(board)} of`) });
  const cells = within(within(grid).getAllByRole('row')[row - 1] as HTMLElement).getAllByRole(
    'gridcell',
  );
  return cells.map(
    (cell) =>
      /, (correct position|wrong position|not in word|entered|empty)$/.exec(
        cell.getAttribute('aria-label') ?? '',
      )?.[1] ?? '',
  );
}

function rowCount(board: number): number {
  const grid = screen.getByRole('grid', { name: new RegExp(`^Board ${String(board)} of`) });
  return within(grid).getAllByRole('row').length;
}

function rowLetters(board: number, row: number): string {
  const grid = screen.getByRole('grid', { name: new RegExp(`^Board ${String(board)} of`) });
  return within(within(grid).getAllByRole('row')[row - 1] as HTMLElement)
    .getAllByRole('gridcell')
    .map((cell) => /letter \d: (\w?),/.exec(cell.getAttribute('aria-label') ?? '')?.[1] ?? '')
    .join('');
}

describe('WordStack', () => {
  beforeEach(() => {
    resetDictionaryCache();
    localStorage.clear();
    seed();
    useStackFixtures();
  });

  afterEach(() => {
    resetDictionaryCache();
    vi.restoreAllMocks();
  });

  describe('the boards (FR-102, FR-108, A11Y-20)', () => {
    it('Duo shows two boards named "Board n of 2" with seven rows each', async () => {
      await openStack();

      for (const board of [1, 2]) {
        const grid = screen.getByRole('grid', { name: `Board ${String(board)} of 2` });
        expect(within(grid).getAllByRole('row')).toHaveLength(7);
        expect(
          within(within(grid).getAllByRole('row')[0] as HTMLElement).getAllByRole('gridcell'),
        ).toHaveLength(5);
      }
      expect(screen.queryByRole('grid', { name: /Board 3/ })).not.toBeInTheDocument();
    });

    it('Quad shows four boards with nine rows each', async () => {
      seed('quad');
      await openStack();

      for (const board of [1, 2, 3, 4]) {
        const grid = screen.getByRole('grid', { name: `Board ${String(board)} of 4` });
        expect(within(grid).getAllByRole('row')).toHaveLength(9);
      }
    });

    it('defaults to Duo and offers Duo and Quad as a radio group (FR-102)', async () => {
      localStorage.removeItem(gameKeys('stack').prefs);
      await openStack();

      expect(screen.getByRole('radio', { name: 'Duo' })).toBeChecked();
      expect(screen.getByRole('radio', { name: 'Quad' })).not.toBeChecked();
    });

    it('opens with the right title and heading (AC-45)', async () => {
      await openStack();

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('WordStack');
      expect(document.title).toBe('WordStack · WordGames');
    });

    it('shows typed letters in the active row of every open board', async () => {
      const { user } = await openStack();

      await user.keyboard('PA');

      expect(rowLetters(1, 1)).toBe('PA');
      expect(rowLetters(2, 1)).toBe('PA');
      expect(rowStates(1, 1).slice(0, 3)).toEqual(['entered', 'entered', 'empty']);
    });
  });

  describe('guesses on every board (FR-104 … FR-106, AC-46, AC-47)', () => {
    it('scores PANEL against PLANT and STORM as in AC-46', async () => {
      const { user } = await openStack();

      await guess(user, 'PANEL');

      expect(rowStates(1, 1)).toEqual([
        'correct position',
        'wrong position',
        'wrong position',
        'not in word',
        'wrong position',
      ]);
      expect(rowStates(2, 1)).toEqual(Array.from({ length: 5 }, () => 'not in word'));
    });

    it('a rejected guess costs no turn on any board (FR-104)', async () => {
      const { user } = await openStack();

      await user.keyboard('ZZZZZ{Enter}');

      expect(await screen.findByRole('alert')).toHaveTextContent('Not in word list');
      expect(rowLetters(1, 2)).toBe('');
      expect(rowLetters(2, 2)).toBe('');
      // The word is still typed in row 1 of both boards.
      expect(rowLetters(1, 1)).toBe('ZZZZZ');
      expect(rowLetters(2, 1)).toBe('ZZZZZ');
    });

    it('rejects a short guess with the exact toast', async () => {
      const { user } = await openStack();

      await user.keyboard('PAN{Enter}');

      expect(await screen.findByRole('alert')).toHaveTextContent('Not enough letters');
    });

    it('freezes a solved board: guess 4 lands only on board 2 and board 1 is solved (AC-47)', async () => {
      const { user } = await openStack();

      await guess(user, 'SLOTH', 'BLAZE', 'PLANT', 'CRANE');

      expect(screen.getByRole('grid', { name: 'Board 1 of 2, solved' })).toBeInTheDocument();
      expect(rowLetters(1, 3)).toBe('PLANT');
      // A solved board keeps only the rows it used.
      expect(rowCount(1)).toBe(3);
      expect(rowLetters(2, 4)).toBe('CRANE');
      expect(screen.getByRole('grid', { name: 'Board 2 of 2' })).toBeInTheDocument();
    });

    it('does not say a board is solved until its reveal has finished', async () => {
      seed('duo', 'full');
      const { user } = await openStack();

      await user.keyboard('PLANT{Enter}');

      expect(screen.queryByRole('grid', { name: /solved/ })).not.toBeInTheDocument();
      expect(
        await screen.findByRole('grid', { name: 'Board 1 of 2, solved' }, { timeout: 4000 }),
      ).toBeInTheDocument();
    });
  });

  describe('the split keyboard (T-76: FR-109, A11Y-20)', () => {
    it('names a key after every board, and blanks a solved board', async () => {
      const { user } = await openStack();

      await guess(user, 'PANEL');
      // A: present on PLANT (board 1), absent on STORM (board 2).
      expect(
        screen.getByRole('button', { name: 'A: board 1 present, board 2 absent' }),
      ).toBeInTheDocument();
    });

    it('turns a solved board\'s segment to "solved"', async () => {
      const { user } = await openStack();

      await guess(user, 'PLANT');

      expect(
        screen.getByRole('button', { name: 'P: board 1 solved, board 2 absent' }),
      ).toBeInTheDocument();
    });

    it('types from the split keys as well as the keyboard', async () => {
      const { user } = await openStack();

      for (const letter of 'PLANT') {
        await user.click(screen.getByRole('button', { name: new RegExp(`^${letter}: board`) }));
      }
      await user.click(screen.getByRole('button', { name: 'Enter' }));
      await settle();

      expect(rowLetters(1, 1)).toBe('PLANT');
    });
  });

  describe('winning and losing (FR-107, FR-110, EC-40, AC-48, AC-55)', () => {
    it('a Duo win shows the result with guesses, boards and the words', async () => {
      const { user } = await openStack();

      await guess(user, 'PLANT', 'STORM');

      expect(await screen.findByRole('heading', { name: 'You won!' })).toBeInTheDocument();
      const panel = screen.getByRole('region', { name: 'You won!' });
      expect(panel).toHaveTextContent('2 of 7 guesses');
      expect(panel).toHaveTextContent('2 of 2 boards solved');
      expect(within(panel).getByText('PLANT')).toBeInTheDocument();
      expect(within(panel).getByText('STORM')).toBeInTheDocument();
    });

    it('a Quad loss lists every answer and the boards solved (AC-48)', async () => {
      seed('quad');
      const { user } = await openStack();

      await guess(user, 'PLANT', 'STORM', ...FILLER_GUESSES.slice(0, 7));

      expect(await screen.findByRole('heading', { name: 'Out of guesses' })).toBeInTheDocument();
      const panel = screen.getByRole('region', { name: 'Out of guesses' });
      expect(panel).toHaveTextContent('9 of 9 guesses');
      expect(panel).toHaveTextContent('2 of 4 boards solved');
      for (const word of ['PLANT', 'STORM', 'CRANE', 'MOUND']) {
        expect(within(panel).getByText(word)).toBeInTheDocument();
      }
      expect(within(panel).getByText('CRANE').parentElement).toHaveTextContent('not solved');
    });

    it('wins on the final allowed guess (EC-40)', async () => {
      const { user } = await openStack();

      await guess(user, ...FILLER_GUESSES.slice(0, 5), 'PLANT', 'STORM');

      expect(await screen.findByRole('heading', { name: 'You won!' })).toBeInTheDocument();
      expect(screen.getByRole('region', { name: 'You won!' })).toHaveTextContent('7 of 7 guesses');
    });

    it('does not start a new game on the Enter that won, and does on the next (AC-55)', async () => {
      const { user } = await openStack();
      await guess(user, 'PLANT', 'STORM');
      await screen.findByRole('heading', { name: 'You won!' });

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(screen.getByRole('heading', { name: 'You won!' })).toBeInTheDocument();

      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'You won!' })).not.toBeInTheDocument();
      });
      expect(rowLetters(1, 1)).toBe('');
    });

    it('Change mode switches mode without a confirmation (FR-110)', async () => {
      const { user } = await openStack();
      await guess(user, 'PLANT', 'STORM');
      await screen.findByRole('heading', { name: 'You won!' });

      await user.click(screen.getByRole('button', { name: 'Change mode' }));
      await user.click(
        within(screen.getByRole('group', { name: 'New game mode' })).getByRole('button', {
          name: 'Quad',
        }),
      );

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(await screen.findByRole('grid', { name: 'Board 4 of 4' })).toBeInTheDocument();
    });

    it('Play again keeps the mode, and is reachable with Tab', async () => {
      const { user } = await openStack();
      await guess(user, 'PLANT', 'STORM');
      await screen.findByRole('heading', { name: 'You won!' });

      const playAgain = screen.getByRole('button', { name: 'Play again' });
      for (let i = 0; i < 80 && document.activeElement !== playAgain; i += 1) await user.tab();
      expect(playAgain).toHaveFocus();
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'You won!' })).not.toBeInTheDocument();
      });
      expect(screen.getByRole('grid', { name: 'Board 2 of 2' })).toBeInTheDocument();
    });
  });

  describe('restarting and switching mode (FR-113)', () => {
    it('does not ask with no guesses', async () => {
      const { user } = await openStack();

      await user.click(screen.getByRole('radio', { name: 'Quad' }));

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(await screen.findByRole('grid', { name: 'Board 4 of 4' })).toBeInTheDocument();
    });

    it('asks to confirm a mode switch after a guess; Cancel keeps the game', async () => {
      const { user } = await openStack();
      await guess(user, 'PANEL');

      await user.click(screen.getByRole('radio', { name: 'Quad' }));
      const dialog = await screen.findByRole('alertdialog', { name: 'Switch to Quad?' });
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      expect(rowLetters(1, 1)).toBe('PANEL');
      expect(screen.getByRole('radio', { name: 'Duo' })).toBeChecked();
    });

    it('switches on confirm with no statistics change', async () => {
      const { user } = await openStack();
      await guess(user, 'PANEL');

      await user.click(screen.getByRole('radio', { name: 'Quad' }));
      await user.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Switch' }),
      );

      expect(await screen.findByRole('grid', { name: 'Board 4 of 4' })).toBeInTheDocument();
      expect(rowLetters(1, 1)).toBe('');
      expect(localStorage.getItem(gameKeys('stack').prefs)).toBe('{"mode":"quad"}');
      await user.click(screen.getByRole('button', { name: 'Statistics' }));
      expect(
        within(await screen.findByRole('dialog', { name: 'Statistics' })).getByText(/No games yet/),
      ).toBeInTheDocument();
    });

    it('asks before New game after a guess; Cancel keeps it, confirm starts afresh', async () => {
      const { user } = await openStack();
      await guess(user, 'PANEL');

      await user.click(screen.getByRole('button', { name: 'New game' }));
      await user.click(
        within(await screen.findByRole('alertdialog', { name: 'Start a new game?' })).getByRole(
          'button',
          {
            name: 'Cancel',
          },
        ),
      );
      expect(rowLetters(1, 1)).toBe('PANEL');

      await user.click(screen.getByRole('button', { name: 'New game' }));
      await user.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'New game' }),
      );
      await waitFor(() => {
        expect(rowLetters(1, 1)).toBe('');
      });
    });
  });

  describe('leaving and returning (FR-65, FR-112, EC-24)', () => {
    async function leaveAndReturn(user: User): Promise<void> {
      await user.click(screen.getByRole('link', { name: 'All games' }));
      await screen.findByRole('link', { name: 'Play WordStack' });
      await user.click(screen.getByRole('link', { name: 'Play WordStack' }));
      await screen.findByRole('grid', { name: /^Board 1 of/ });
    }

    it('restores every board and the typed letters', async () => {
      const { user } = await openStack();
      await guess(user, 'PANEL', 'PLANT');
      await user.keyboard('CR');

      await leaveAndReturn(user);

      expect(rowLetters(1, 1)).toBe('PANEL');
      expect(rowLetters(2, 2)).toBe('PLANT');
      expect(rowCount(1)).toBe(2);
      expect(rowLetters(2, 3)).toBe('CR');
      expect(screen.getByRole('grid', { name: 'Board 1 of 2, solved' })).toBeInTheDocument();
    });

    it('discards a saved game whose answer has left the list and starts a new one', async () => {
      const { user } = await openStack();
      await guess(user, 'PANEL');
      await user.click(screen.getByRole('link', { name: 'All games' }));
      await screen.findByRole('link', { name: 'Play WordStack' });

      const saved = JSON.parse(localStorage.getItem(gameKeys('stack').session) ?? 'null') as {
        boards: { answer: string }[];
      };
      saved.boards[0]!.answer = 'GONER';
      localStorage.setItem(gameKeys('stack').session, JSON.stringify(saved));

      await user.click(screen.getByRole('link', { name: 'Play WordStack' }));
      await screen.findByRole('grid', { name: /^Board 1 of/ });

      expect(rowLetters(1, 1)).toBe('');
      expect(screen.queryByRole('button', { name: /dismiss/ })).not.toBeInTheDocument();
    });

    it('ignores a saved game of the other mode', async () => {
      const { user } = await openStack();
      await guess(user, 'PANEL');
      await user.click(screen.getByRole('link', { name: 'All games' }));
      await screen.findByRole('link', { name: 'Play WordStack' });
      localStorage.setItem(gameKeys('stack').prefs, JSON.stringify({ mode: 'quad' }));

      await user.click(screen.getByRole('link', { name: 'Play WordStack' }));

      expect(await screen.findByRole('grid', { name: 'Board 4 of 4' })).toBeInTheDocument();
      expect(rowLetters(1, 1)).toBe('');
    });
  });

  describe('announcements (T-79: A11Y-21)', () => {
    function polite(): HTMLElement {
      return within(screen.getByRole('main')).getByRole('status');
    }

    it('announces one summary per guess with the A11Y-21 wording', async () => {
      const { user } = await openStack();

      await guess(user, 'PANEL');

      expect(polite().textContent?.trim()).toBe(
        'PANEL. Board 1: 1 correct, 3 present. Board 2: no matches. 6 guesses left.',
      );
    });

    it('says "solved" for a board a guess solves, and counts the guesses left', async () => {
      const { user } = await openStack();

      await guess(user, 'PLANT');

      expect(polite().textContent?.trim()).toBe(
        'PLANT. Board 1: solved. Board 2: 1 present. 6 guesses left.',
      );
    });

    it('announces the outcome when the game ends', async () => {
      const { user } = await openStack();

      await guess(user, 'PLANT', 'STORM');
      await screen.findByRole('heading', { name: 'You won!' });

      expect(polite().textContent?.trim()).toBe('You won in 2 guesses.');
    });

    it('keeps errors in the assertive region, not the polite one (A11Y-4)', async () => {
      const { user } = await openStack();

      await user.keyboard('ZZZZZ{Enter}');

      expect(await screen.findByRole('alert')).toHaveTextContent('Not in word list');
      expect(polite().textContent?.trim()).toBe('');
    });
  });

  describe('help and statistics (T-79: FR-111, FR-114, US-38, AC-56)', () => {
    it('never opens the help dialog by itself (ADR-020)', async () => {
      await openStack();

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('opens How to play from the header', async () => {
      const { user } = await openStack();

      await user.click(screen.getByRole('button', { name: 'How to play' }));

      const dialog = await screen.findByRole('dialog', { name: 'How to play' });
      expect(dialog).toHaveTextContent('Duo');
      expect(dialog).toHaveTextContent('Quad');
      expect(dialog).toHaveTextContent('split');
    });

    it('records a win once, overall and in the Duo distribution', async () => {
      const { user } = await openStack();
      await guess(user, 'PLANT', 'STORM');
      await screen.findByRole('heading', { name: 'You won!' });

      await user.click(screen.getByRole('button', { name: 'Statistics' }));
      const dialog = await screen.findByRole('dialog', { name: 'Statistics' });

      expect(within(dialog).getByText('Played').closest('div')).toHaveTextContent('1');
      expect(within(dialog).getByText('Win %').closest('div')).toHaveTextContent('100%');
      await user.click(within(dialog).getByRole('radio', { name: 'Duo' }));
      expect(dialog).toHaveTextContent('Duo wins by guesses (2 to 7)');
    });

    it("resets only WordStack statistics, leaving other games' keys untouched (AC-56)", async () => {
      localStorage.setItem(gameKeys('wordwright').stats, '{"marker":"wordwright"}');
      localStorage.setItem(gameKeys('weaver').stats, '{"marker":"weaver"}');
      const { user } = await openStack();
      await guess(user, 'PLANT', 'STORM');
      await screen.findByRole('heading', { name: 'You won!' });

      await user.click(screen.getByRole('button', { name: 'Statistics' }));
      const dialog = await screen.findByRole('dialog', { name: 'Statistics' });
      await user.click(within(dialog).getByRole('button', { name: 'Reset statistics' }));
      await user.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
      );

      await waitFor(() => {
        expect(within(dialog).getByText(/No games yet/)).toBeInTheDocument();
      });
      expect(localStorage.getItem(gameKeys('wordwright').stats)).toBe('{"marker":"wordwright"}');
      expect(localStorage.getItem(gameKeys('weaver').stats)).toBe('{"marker":"weaver"}');
    });
  });
});
