import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '@/App';
import { resetDictionaryCache } from '@/dictionary';
import { DICTIONARY_REGISTRY } from '@/dictionary/registry';
import type { WordLength } from '@/engine';
import { gameKeys } from '@/storage';

import { WEAVER_FIXTURE_LISTS, useWeaverFixtures } from './weaverFixtures';

/**
 * WordWeaver end to end through the real providers (T-66 … T-71: FR-79 …
 * FR-96, US-25 … US-31, AC-29 … AC-44, EC-23, A11Y-16, A11Y-17).
 *
 * Driven with the physical keyboard where that is natural, and the DOM by
 * accessible queries throughout. Every puzzle here is COLD → WARM, par 4.
 */

type User = ReturnType<typeof userEvent.setup>;

function seedSettings(motion: 'reduced' | 'full' = 'reduced'): void {
  localStorage.setItem(
    'wordgames:v1:settings',
    JSON.stringify({ theme: 'system', colorblind: false, motion }),
  );
}

async function openWeaver(): Promise<{ user: User }> {
  window.history.replaceState(null, '', '/#/weaver');
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('grid', { name: 'Word ladder' });
  return { user };
}

/** Waits for the reveal to finish and input to unlock. */
async function settle(): Promise<void> {
  await waitFor(() => {
    const over = screen.queryByRole('heading', { name: /Solved!|Gave up/ });
    const enter = screen.queryByRole('button', { name: 'Enter' });
    expect(over !== null || (enter !== null && !enter.hasAttribute('disabled'))).toBe(true);
  });
}

/** The result panel, a region named by its heading. */
function result(): HTMLElement {
  return screen.getByRole('region', { name: /Solved!|Gave up/ });
}

/** No toast on screen: every toast is a button with a hidden "(dismiss)" hint. */
function expectNoToast(): void {
  expect(screen.queryByRole('button', { name: /\(dismiss\)/ })).not.toBeInTheDocument();
}

/** Types rungs with the physical keyboard, waiting for each reveal. */
async function play(user: User, ...words: string[]): Promise<void> {
  for (const word of words) {
    await user.keyboard(`${word}{Enter}`);
    await settle();
  }
}

const COLD_TO_WARM = ['CORD', 'CARD', 'WARD', 'WARM'];

function rowNames(): string[] {
  return within(screen.getByRole('grid', { name: 'Word ladder' }))
    .getAllByRole('row')
    .map((row) => row.getAttribute('aria-label') ?? '');
}

function rowWord(label: string): string {
  const row = within(screen.getByRole('grid', { name: 'Word ladder' })).getByRole('row', {
    name: label,
  });
  return within(row)
    .getAllByRole('gridcell')
    .map((cell) => /letter \d+: (\w?),/.exec(cell.getAttribute('aria-label') ?? '')?.[1] ?? '')
    .join('');
}

async function solve(user: User): Promise<void> {
  await play(user, ...COLD_TO_WARM);
  await screen.findByRole('heading', { name: 'Solved!' });
}

describe('WordWeaver', () => {
  beforeEach(() => {
    resetDictionaryCache();
    localStorage.clear();
    seedSettings();
    useWeaverFixtures();
  });

  afterEach(() => {
    resetDictionaryCache();
    vi.restoreAllMocks();
  });

  describe('preparing and loading (FR-96, EC-14, EC-32)', () => {
    it('shows "Preparing puzzle…" with no keyboard until the board is ready', async () => {
      // A slow word list, so the preparing state is on screen long enough to see.
      const registry = DICTIONARY_REGISTRY as Record<WordLength, () => Promise<unknown>>;
      vi.spyOn(registry, 4).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(WEAVER_FIXTURE_LISTS[4]), 150)),
      );
      window.history.replaceState(null, '', '/#/weaver');
      render(<App />);

      expect(await screen.findByText('Preparing puzzle…')).toBeInTheDocument();
      // Input is disabled while preparing: there is nothing to type into.
      expect(screen.queryByRole('button', { name: 'Enter' })).not.toBeInTheDocument();
      expect(screen.queryByRole('grid', { name: 'Word ladder' })).not.toBeInTheDocument();

      await screen.findByRole('grid', { name: 'Word ladder' });
      expect(screen.queryByText('Preparing puzzle…')).not.toBeInTheDocument();
    });

    it('shows Retry on a dictionary failure, and Retry recovers (EC-14)', async () => {
      const registry = DICTIONARY_REGISTRY as Record<WordLength, () => Promise<unknown>>;
      vi.spyOn(registry, 4).mockRejectedValueOnce(new Error('offline'));
      window.history.replaceState(null, '', '/#/weaver');
      const user = userEvent.setup();
      render(<App />);

      const retry = await screen.findByRole('button', { name: 'Retry' });
      expect(screen.getByText(/Couldn't load the word list/)).toBeInTheDocument();

      await user.click(retry);

      expect(await screen.findByRole('grid', { name: 'Word ladder' })).toBeInTheDocument();
    });

    it('shows "Couldn\'t create a puzzle." with Retry when generation fails (EC-32)', async () => {
      const registry = DICTIONARY_REGISTRY as Record<WordLength, () => Promise<unknown>>;
      // Two answers with no path between them: nothing qualifies.
      vi.spyOn(registry, 4).mockResolvedValue({
        ...WEAVER_FIXTURE_LISTS[4],
        ladder: ['COLD', 'WARM'],
      });
      window.history.replaceState(null, '', '/#/weaver');
      const user = userEvent.setup();
      render(<App />);

      expect(await screen.findByText("Couldn't create a puzzle.")).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Enter' })).not.toBeInTheDocument();

      // Retry tries again; with the same lists it fails the same way, without crashing.
      await user.click(screen.getByRole('button', { name: 'Retry' }));
      expect(await screen.findByText("Couldn't create a puzzle.")).toBeInTheDocument();
    });
  });

  describe('the board (T-67: FR-88, A11Y-16, US-25, US-26)', () => {
    it('is a grid named "Word ladder" with Start, Next rung and End rows', async () => {
      await openWeaver();

      expect(rowNames()).toEqual(['Start', 'Next rung', 'End']);
      expect(rowWord('Start')).toBe('COLD');
      expect(rowWord('End')).toBe('WARM');
    });

    it('labels rows Rung n as the ladder grows', async () => {
      const { user } = await openWeaver();

      await play(user, 'CORD', 'CARD');

      expect(rowNames()).toEqual(['Start', 'Rung 1', 'Rung 2', 'Next rung', 'End']);
    });

    it('reads a tile like "Rung 2, letter 3: R, matches end word"', async () => {
      const { user } = await openWeaver();
      await play(user, 'CORD', 'CARD');

      expect(
        screen.getByRole('gridcell', { name: 'Rung 2, letter 3: R, matches end word' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('gridcell', { name: 'Rung 2, letter 1: C, does not match' }),
      ).toBeInTheDocument();
    });

    it('scores the start row and shows the end row all matching (FR-81)', async () => {
      await openWeaver();

      expect(
        screen.getByRole('gridcell', { name: 'Start, letter 1: C, does not match' }),
      ).toBeInTheDocument();
      expect(
        screen.getAllByRole('gridcell', { name: /^End, letter \d: \w, matches end word$/ }),
      ).toHaveLength(4);
    });

    it('shows green and grey only, never a "wrong position" state (FR-81)', async () => {
      const { user } = await openWeaver();
      await play(user, 'CORD', 'CARD');

      expect(screen.queryByRole('gridcell', { name: /wrong position/ })).not.toBeInTheDocument();
    });

    it('shows typed letters in the Next rung row as entered', async () => {
      const { user } = await openWeaver();

      await user.keyboard('CO');

      expect(
        screen.getByRole('gridcell', { name: 'Next rung, letter 1: C, entered' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('gridcell', { name: 'Next rung, letter 3: empty, empty' }),
      ).toBeInTheDocument();
    });

    it('with reduced motion, a new rung shows its final state with no flip', async () => {
      const { user } = await openWeaver();

      await user.keyboard('CORD{Enter}');

      const cell = await screen.findByRole('gridcell', { name: /^Rung 1, letter 3: R/ });
      expect(cell.className).not.toContain('animate-flip');
    });

    it('flips a new rung when motion is full', async () => {
      seedSettings('full');
      const { user } = await openWeaver();

      await user.keyboard('CORD{Enter}');

      const cell = await screen.findByRole('gridcell', { name: /^Rung 1, letter 3: R/ });
      expect(cell.className).toContain('animate-flip');
    });

    it('works at 5 letters, with five tiles per row', async () => {
      const { user } = await openWeaver();
      await user.click(screen.getByRole('radio', { name: /^5/ }));

      await waitFor(() => {
        expect(rowWord('Start')).toBe('CRANE');
      });
      expect(rowWord('End')).toBe('GRAPH');
    });
  });

  describe('rungs and moves (FR-79 … FR-84)', () => {
    it('rejects a short rung with the exact toast and no move (FR-80)', async () => {
      const { user } = await openWeaver();

      await user.keyboard('COR{Enter}');

      expect(await screen.findByRole('button', { name: /Not enough letters/ })).toBeInTheDocument();
      expect(rowNames()).toEqual(['Start', 'Next rung', 'End']);
    });

    it('rejects a word that is not in the list (FR-80)', async () => {
      const { user } = await openWeaver();

      await user.keyboard('CZRD{Enter}');

      expect(await screen.findByRole('button', { name: /Not in word list/ })).toBeInTheDocument();
    });

    it('rejects a two-letter change with "Change exactly one letter" and no move (AC-31)', async () => {
      const { user } = await openWeaver();
      await play(user, 'CORD');

      await user.keyboard('CARE{Enter}');

      expect(
        await screen.findByRole('button', { name: /Change exactly one letter/ }),
      ).toBeInTheDocument();
      expect(rowNames()).toEqual(['Start', 'Rung 1', 'Next rung', 'End']);
    });

    it('rejects the start word with "Already used" (AC-32, EC-29)', async () => {
      const { user } = await openWeaver();
      await play(user, 'CORD');

      await user.keyboard('COLD{Enter}');

      expect(await screen.findByRole('button', { name: /Already used/ })).toBeInTheDocument();
      expect(rowNames()).toEqual(['Start', 'Rung 1', 'Next rung', 'End']);
    });

    it('lets a word outside the ladder list be played (FR-76)', async () => {
      const { user } = await openWeaver();

      await play(user, 'CORD', 'CORE');

      expect(rowNames()).toContain('Rung 2');
    });

    it('Backspace on an empty row undoes the last rung, and re-adding it makes 3 moves (AC-33)', async () => {
      const { user } = await openWeaver();
      await play(user, 'CORD', 'CARD');

      await user.keyboard('{Backspace}');
      expect(rowNames()).toEqual(['Start', 'Rung 1', 'Next rung', 'End']);

      await play(user, 'CARD', 'WARD', 'WARM');
      await screen.findByRole('heading', { name: 'Solved!' });
      // CORD, CARD, (undone), CARD, WARD, WARM: five submissions against par 4.
      expect(within(result()).getByText(/5 moves/)).toBeInTheDocument();
      expect(screen.getByText('+1')).toBeInTheDocument();
    });

    it('does nothing for Backspace with no rungs, and shows no toast (EC-30)', async () => {
      const { user } = await openWeaver();

      await user.keyboard('{Backspace}');

      expectNoToast();
      expect(rowNames()).toEqual(['Start', 'Next rung', 'End']);
    });

    it('removes a typed letter before it undoes a rung', async () => {
      const { user } = await openWeaver();
      await play(user, 'CORD');

      await user.keyboard('C{Backspace}');

      expect(rowNames()).toContain('Rung 1');
    });
  });

  describe('solving and the result (T-69: FR-82, FR-91, US-30, AC-29, AC-30)', () => {
    it('solves only when the end word is submitted, reading "Par!" at par (AC-30)', async () => {
      const { user } = await openWeaver();

      await play(user, 'CORD', 'CARD', 'WARD');
      expect(screen.queryByRole('heading', { name: 'Solved!' })).not.toBeInTheDocument();

      await play(user, 'WARM');

      expect(await screen.findByRole('heading', { name: 'Solved!' })).toBeInTheDocument();
      expect(within(result()).getByText(/4 moves/)).toBeInTheDocument();
      expect(within(result()).getByText(/Par 4/)).toBeInTheDocument();
      expect(screen.getByText('Par!')).toBeInTheDocument();
    });

    it("shows the player's ladder in the result", async () => {
      const { user } = await openWeaver();
      await solve(user);

      const ladder = screen.getByRole('heading', { name: 'Your ladder' }).nextElementSibling;
      expect(ladder?.textContent).toContain('COLD');
      expect(ladder?.textContent).toContain('WARM');
      expect(within(ladder as HTMLElement).getAllByRole('listitem')).toHaveLength(5);
    });

    it('records the solve once in statistics', async () => {
      const { user } = await openWeaver();
      await solve(user);

      await user.click(screen.getByRole('button', { name: 'Statistics' }));
      const dialog = await screen.findByRole('dialog', { name: 'Statistics' });

      expect(within(dialog).getByText('Played').closest('div')).toHaveTextContent('1');
      expect(within(dialog).getByText('Solved').closest('div')).toHaveTextContent('1');
      expect(within(dialog).getByText('Par hits').closest('div')).toHaveTextContent('1');
      expect(within(dialog).getByText('Current streak').closest('div')).toHaveTextContent('1');
    });

    it('does not start a new puzzle on the Enter that solved, and does on the next (AC-29)', async () => {
      const { user } = await openWeaver();
      await solve(user);

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(screen.getByRole('heading', { name: 'Solved!' })).toBeInTheDocument();

      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'Solved!' })).not.toBeInTheDocument();
      });
      // Same length: still 4-letter rows.
      expect(
        within(screen.getByRole('row', { name: 'Start' })).getAllByRole('gridcell'),
      ).toHaveLength(4);
    });

    it('Play again starts a new puzzle, reachable with Tab', async () => {
      const { user } = await openWeaver();
      await solve(user);

      const playAgain = screen.getByRole('button', { name: 'Play again' });
      for (let i = 0; i < 40 && document.activeElement !== playAgain; i += 1) await user.tab();
      expect(playAgain).toHaveFocus();

      await user.keyboard('{Enter}');
      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'Solved!' })).not.toBeInTheDocument();
      });
    });

    it('Change length switches to the other length without confirming (FR-91)', async () => {
      const { user } = await openWeaver();
      await solve(user);

      await user.click(screen.getByRole('button', { name: 'Change length' }));
      await user.click(
        within(screen.getByRole('group', { name: 'New game length' })).getByRole('button', {
          name: '5 letters',
        }),
      );

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      await waitFor(() => {
        expect(rowWord('Start')).toBe('CRANE');
      });
    });
  });

  describe('give up (T-68: FR-86, FR-94, AC-35, AC-39, US-28)', () => {
    it('asks to confirm after a rung, then shows a par-step ladder of ladder words (AC-35)', async () => {
      const { user } = await openWeaver();
      await play(user, 'CORD', 'CARD');

      await user.click(screen.getByRole('button', { name: 'Give up' }));
      const dialog = await screen.findByRole('alertdialog', { name: 'Give up?' });
      await user.click(within(dialog).getByRole('button', { name: 'Give up' }));

      expect(await screen.findByRole('heading', { name: 'Gave up' })).toBeInTheDocument();
      const shortest = screen.getByRole('heading', {
        name: 'A shortest ladder',
      }).nextElementSibling;
      const words = within(shortest as HTMLElement)
        .getAllByRole('listitem')
        .map((item) => item.textContent?.replace('→', '').trim() ?? '');

      expect(words).toEqual(['COLD', 'CORD', 'CARD', 'WARD', 'WARM']);
      // par steps: par + 1 words, each one letter from the last, all in the ladder list.
      expect(words).toHaveLength(5);
      for (const word of words) expect(WEAVER_FIXTURE_LISTS[4].ladder).toContain(word);
      for (let i = 1; i < words.length; i += 1) {
        const diff = [...(words[i] as string)].filter((l, p) => l !== words[i - 1]?.[p]).length;
        expect(diff).toBe(1);
      }
    });

    it('records played +1, gave up +1 and resets the streak (AC-35)', async () => {
      const { user } = await openWeaver();
      await solve(user);
      await user.keyboard('{Enter}'); // new puzzle
      await screen.findByRole('row', { name: 'Start' });
      // The start just used is skipped, so the next puzzle runs WARM → COLD.
      expect(rowWord('Start')).toBe('WARM');
      await play(user, 'WARD');
      await user.click(screen.getByRole('button', { name: 'Give up' }));
      await user.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Give up' }),
      );
      await screen.findByRole('heading', { name: 'Gave up' });

      await user.click(screen.getByRole('button', { name: 'Statistics' }));
      const dialog = await screen.findByRole('dialog', { name: 'Statistics' });

      expect(within(dialog).getByText('Played').closest('div')).toHaveTextContent('2');
      expect(
        within(dialog).getByText('Gave up', { selector: 'dt' }).closest('div'),
      ).toHaveTextContent('1');
      expect(within(dialog).getByText('Current streak').closest('div')).toHaveTextContent('0');
      expect(within(dialog).getByText('Best streak').closest('div')).toHaveTextContent('1');
    });

    it('does not ask to confirm with no rungs, and gives up straight away', async () => {
      const { user } = await openWeaver();

      await user.click(screen.getByRole('button', { name: 'Give up' }));

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(await screen.findByRole('heading', { name: 'Gave up' })).toBeInTheDocument();
    });

    it('Cancel keeps the ladder (AC-39)', async () => {
      const { user } = await openWeaver();
      await play(user, 'CORD');

      await user.click(screen.getByRole('button', { name: 'Give up' }));
      await user.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }),
      );

      expect(screen.queryByRole('heading', { name: 'Gave up' })).not.toBeInTheDocument();
      expect(rowNames()).toContain('Rung 1');
    });
  });

  describe('new puzzle and length changes (T-68: FR-94, AC-39, US-29)', () => {
    it('asks to confirm New puzzle after a rung; Cancel keeps the ladder (AC-39)', async () => {
      const { user } = await openWeaver();
      await play(user, 'CORD');

      await user.click(screen.getByRole('button', { name: 'New puzzle' }));
      const dialog = await screen.findByRole('alertdialog', { name: 'Start a new puzzle?' });
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      expect(rowNames()).toContain('Rung 1');
      expect(rowWord('Start')).toBe('COLD');
    });

    it('starts a fresh puzzle on confirm, with no statistics change', async () => {
      const { user } = await openWeaver();
      await play(user, 'CORD');

      await user.click(screen.getByRole('button', { name: 'New puzzle' }));
      await user.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'New puzzle' }),
      );

      await waitFor(() => {
        expect(rowNames()).toEqual(['Start', 'Next rung', 'End']);
      });
      await user.click(screen.getByRole('button', { name: 'Statistics' }));
      expect(
        within(await screen.findByRole('dialog', { name: 'Statistics' })).getByText(
          /No puzzles yet/,
        ),
      ).toBeInTheDocument();
    });

    it('does not ask with no rungs', async () => {
      const { user } = await openWeaver();

      await user.click(screen.getByRole('button', { name: 'New puzzle' }));

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('asks before a length change after a rung; Cancel keeps the ladder (AC-39)', async () => {
      const { user } = await openWeaver();
      await play(user, 'CORD');

      await user.click(screen.getByRole('radio', { name: /^5/ }));
      const dialog = await screen.findByRole('alertdialog', { name: 'Switch to 5 letters?' });
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      expect(rowNames()).toContain('Rung 1');
      expect(screen.getByRole('radio', { name: /^4/ })).toBeChecked();
    });

    it('switches length on confirm, and remembers it (FR-74)', async () => {
      const { user } = await openWeaver();
      await play(user, 'CORD');

      await user.click(screen.getByRole('radio', { name: /^5/ }));
      await user.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Switch' }),
      );

      await waitFor(() => {
        expect(rowWord('Start')).toBe('CRANE');
      });
      expect(localStorage.getItem(gameKeys('weaver').prefs)).toBe('{"defaultWordLength":5}');
      // Stored apart from Wordwright's preference.
      expect(localStorage.getItem(gameKeys('wordwright').prefs)).toBeNull();
    });

    it('defaults to 4 letters (FR-74)', async () => {
      await openWeaver();

      expect(screen.getByRole('radio', { name: /^4/ })).toBeChecked();
      expect(screen.queryByRole('radio', { name: /^6/ })).not.toBeInTheDocument();
    });

    it('gives every button a touch-sized minimum height (FR-58)', async () => {
      await openWeaver();

      for (const name of ['Undo', 'Give up', 'New puzzle']) {
        expect(screen.getByRole('button', { name }).className).toContain('min-h-11');
      }
    });

    it('disables Undo with nothing to undo and Give up after the end', async () => {
      const { user } = await openWeaver();
      expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();

      await solve(user);

      expect(screen.getByRole('button', { name: 'Give up' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    });

    it('Undo removes the last rung', async () => {
      const { user } = await openWeaver();
      await play(user, 'CORD', 'CARD');

      await user.click(screen.getByRole('button', { name: 'Undo' }));

      expect(rowNames()).toEqual(['Start', 'Rung 1', 'Next rung', 'End']);
    });

    it('works from the on-screen keyboard too, which has no letter colours (FR-90)', async () => {
      const { user } = await openWeaver();

      for (const letter of 'CORD') {
        await user.click(screen.getByRole('button', { name: new RegExp(`^${letter}$`) }));
      }
      await user.click(screen.getByRole('button', { name: 'Enter' }));
      await settle();

      expect(rowNames()).toContain('Rung 1');
      // Keys never take a state suffix such as "correct position".
      expect(
        screen.queryByRole('button', { name: /correct position|wrong position|not in word/ }),
      ).not.toBeInTheDocument();
    });
  });

  describe('leaving and returning (T-66: FR-65, FR-93, AC-40, EC-23, EC-24)', () => {
    async function leaveAndReturn(user: User): Promise<void> {
      await user.click(screen.getByRole('link', { name: 'All games' }));
      await screen.findByRole('link', { name: 'Play WordWeaver' });
      await user.click(screen.getByRole('link', { name: 'Play WordWeaver' }));
      await screen.findByRole('grid', { name: 'Word ladder' });
    }

    it('restores the ladder, the move count and the typed letters exactly (AC-40)', async () => {
      const { user } = await openWeaver();
      await play(user, 'CORD', 'CARD');
      await user.keyboard('{Backspace}'); // undo: 2 moves, 1 rung
      await user.keyboard('CA'); // typed inside the debounce window

      await leaveAndReturn(user);

      expect(rowNames()).toEqual(['Start', 'Rung 1', 'Next rung', 'End']);
      expect(rowWord('Rung 1')).toBe('CORD');
      expect(rowWord('Next rung')).toBe('CA');

      // Finish: moves must be 2 (restored) + CARD, WARD, WARM = 5.
      await user.keyboard('RD{Enter}');
      await settle();
      await play(user, 'WARD', 'WARM');
      await screen.findByRole('heading', { name: 'Solved!' });
      expect(within(result()).getByText(/5 moves/)).toBeInTheDocument();
    });

    it('restores a game that is over, showing the result without recording it twice', async () => {
      const { user } = await openWeaver();
      await solve(user);

      await leaveAndReturn(user);

      expect(await screen.findByRole('heading', { name: 'Solved!' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Statistics' }));
      expect(
        within(await screen.findByRole('dialog', { name: 'Statistics' }))
          .getByText('Played')
          .closest('div'),
      ).toHaveTextContent('1');
    });

    it('restores a row that was mid-reveal as fully revealed (EC-23)', async () => {
      seedSettings('full');
      const { user } = await openWeaver();

      await user.keyboard('CORD{Enter}');
      // Leave while the 4-tile flip (about 1.25 s) is still running.
      await user.click(screen.getByRole('link', { name: 'All games' }));
      await screen.findByRole('link', { name: 'Play WordWeaver' });
      await user.click(screen.getByRole('link', { name: 'Play WordWeaver' }));
      await screen.findByRole('grid', { name: 'Word ladder' });

      const cell = await screen.findByRole('gridcell', { name: /^Rung 1, letter 3: R/ });
      expect(cell.className).not.toContain('animate-flip');
      // Input is unlocked: the board is playable straight away.
      await user.keyboard('CARD{Enter}');
      expect(
        await screen.findByRole('gridcell', { name: /^Rung 2, letter 2: A/ }),
      ).toBeInTheDocument();
    });

    it('discards a saved puzzle whose start is no longer an answer (FR-93, EC-33)', async () => {
      const { user } = await openWeaver();
      await play(user, 'CORD');
      await user.click(screen.getByRole('link', { name: 'All games' }));
      await screen.findByRole('link', { name: 'Play WordWeaver' });

      // The lists change: COLD is no longer an answer.
      resetDictionaryCache();
      const registry = DICTIONARY_REGISTRY as Record<WordLength, () => Promise<unknown>>;
      vi.spyOn(registry, 4).mockResolvedValue({
        ...WEAVER_FIXTURE_LISTS[4],
        answers: ['BOLD', 'WARM'],
      });
      await user.click(screen.getByRole('link', { name: 'Play WordWeaver' }));
      await screen.findByRole('grid', { name: 'Word ladder' });

      // A fresh puzzle, silently: no rungs, and no warning toast.
      expect(rowNames()).toEqual(['Start', 'Next rung', 'End']);
      expectNoToast();
    });

    it('keeps WordWeaver and Wordwright sessions apart (FR-68, EC-28)', async () => {
      const { user } = await openWeaver();
      await play(user, 'CORD');
      await user.click(screen.getByRole('link', { name: 'All games' }));
      await screen.findByRole('link', { name: 'Play WordWright' });

      expect(localStorage.getItem(gameKeys('weaver').session)).not.toBeNull();
      expect(localStorage.getItem(gameKeys('wordwright').session)).toBeNull();
    });
  });

  describe('the 500-move safety cap (FR-85, EC-34)', () => {
    /** A saved puzzle that has already used its 500 moves. */
    function seedCappedSession(): void {
      localStorage.setItem(
        gameKeys('weaver').session,
        JSON.stringify({
          id: 'capped',
          length: 4,
          start: 'COLD',
          end: 'WARM',
          par: 4,
          rungs: [],
          moves: 500,
          currentInput: '',
          status: 'playing',
          startedAt: 1,
          finishedAt: null,
          optimalLadder: null,
        }),
      );
    }

    it('stops rung input with the Move limit reached toast', async () => {
      seedCappedSession();
      const { user } = await openWeaver();

      await user.keyboard('C');

      expect(await screen.findByRole('button', { name: /Move limit reached/ })).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent('Move limit reached');
      expect(rowWord('Next rung')).toBe('');
    });

    it('stops a submission too', async () => {
      seedCappedSession();
      const { user } = await openWeaver();

      await user.keyboard('{Enter}');

      expect(await screen.findByRole('alert')).toHaveTextContent('Move limit reached');
    });

    it('still lets the player Give up', async () => {
      seedCappedSession();
      const { user } = await openWeaver();

      await user.click(screen.getByRole('button', { name: 'Give up' }));

      expect(await screen.findByRole('heading', { name: 'Gave up' })).toBeInTheDocument();
    });

    it('still lets the player start a New puzzle', async () => {
      seedCappedSession();
      const { user } = await openWeaver();

      await user.click(screen.getByRole('button', { name: 'New puzzle' }));

      // The fresh puzzle is not capped, so typing works again.
      await user.keyboard('C');
      expect(
        await screen.findByRole('gridcell', { name: 'Next rung, letter 1: C, entered' }),
      ).toBeInTheDocument();
    });
  });

  describe('announcements (T-71: A11Y-17, A11Y-4)', () => {
    /** The game's own live region, inside <main>, not the toast regions. */
    function polite(): HTMLElement {
      return within(screen.getByRole('main')).getByRole('status');
    }

    it('announces an accepted rung as "CARD: 2 of 4 letters match", once', async () => {
      const { user } = await openWeaver();

      await play(user, 'CORD', 'CARD');

      expect(polite().textContent?.trim()).toBe('CARD: 2 of 4 letters match');
    });

    it('announces undo as "Removed CARD"', async () => {
      const { user } = await openWeaver();
      await play(user, 'CORD', 'CARD');

      await user.click(screen.getByRole('button', { name: 'Undo' }));

      expect(polite().textContent?.trim()).toBe('Removed CARD');
    });

    it('makes a repeated message differ so it is read again', async () => {
      const { user } = await openWeaver();

      await user.click(screen.getByRole('button', { name: 'New puzzle' }));
      const first = polite().textContent;
      await user.click(screen.getByRole('button', { name: 'New puzzle' }));
      const second = polite().textContent;
      await user.click(screen.getByRole('button', { name: 'New puzzle' }));
      const third = polite().textContent;

      expect(first?.trim()).toBe('New puzzle started.');
      expect(second?.trim()).toBe('New puzzle started.');
      expect(second).not.toBe(first);
      expect(third).toBe(first);
    });

    it('announces a solve as "Solved in 4 moves. Par 4."', async () => {
      const { user } = await openWeaver();
      await solve(user);

      expect(polite().textContent?.trim()).toBe('Solved in 4 moves. Par 4.');
    });

    it('announces a give up with the ladder', async () => {
      const { user } = await openWeaver();
      await play(user, 'CORD');
      await user.click(screen.getByRole('button', { name: 'Give up' }));
      await user.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Give up' }),
      );

      await screen.findByRole('heading', { name: 'Gave up' });

      expect(polite().textContent?.trim()).toBe(
        'Gave up. One shortest ladder: COLD, CORD, CARD, WARD, WARM',
      );
    });

    it('keeps errors in the assertive region, not the polite one (A11Y-4)', async () => {
      const { user } = await openWeaver();

      await user.keyboard('CZRD{Enter}');

      expect(await screen.findByRole('alert')).toHaveTextContent('Not in word list');
      expect(polite().textContent?.trim()).toBe('');
    });
  });
});
