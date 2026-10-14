import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '@/App';
import { resetDictionaryCache } from '@/dictionary';
import { gameKeys } from '@/storage';

import { LOSING_GUESSES, useRangeFixtures } from './rangeFixtures';

/**
 * WordRange end to end through the real providers (T-81 … T-83: FR-115 …
 * FR-126, US-34, US-38, AC-45, AC-49, AC-50, AC-55, AC-56, A11Y-22).
 *
 * With the fixture list the secret is PLANT. The list is tiny, so every
 * distance is Burning; the other heat levels are tested on the board itself.
 */

type User = ReturnType<typeof userEvent.setup>;

async function openRange(): Promise<{ user: User }> {
  window.history.replaceState(null, '', '/#/range');
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('group', { name: /^Your guess/ });
  return { user };
}

/** Types each word with the physical keyboard. */
async function guess(user: User, ...words: string[]): Promise<void> {
  for (const word of words) {
    await user.keyboard(`${word}{Enter}`);
  }
}

function boundWords(): { upper: string; lower: string } {
  const read = (label: string): string =>
    screen.getByText(label).nextElementSibling?.textContent ?? '';
  return { upper: read('The word comes before'), lower: read('The word comes after') };
}

function listedWords(): string[] {
  const list = screen.queryByRole('list', { name: 'Your guesses, in alphabetical order' });
  return list
    ? within(list)
        .getAllByRole('listitem')
        .map((li) => li.querySelector('span')?.textContent ?? '')
    : [];
}

describe('WordRange', () => {
  beforeEach(() => {
    resetDictionaryCache();
    localStorage.clear();
    localStorage.setItem(
      'wordgames:v1:settings',
      JSON.stringify({ theme: 'system', colorblind: false, motion: 'reduced' }),
    );
    useRangeFixtures();
  });

  afterEach(() => {
    resetDictionaryCache();
    vi.restoreAllMocks();
  });

  describe('the screen (FR-121, FR-122)', () => {
    it('opens with the right title and the range at its sentinels (AC-45)', async () => {
      await openRange();

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('WordRange');
      expect(document.title).toBe('WordRange · wordgames');
      expect(boundWords()).toEqual({ upper: 'ZZZZZ', lower: 'AAAAA' });
      expect(screen.getByText('14 guesses left')).toBeInTheDocument();
    });

    it('shows typed letters in the input row', async () => {
      const { user } = await openRange();

      await user.keyboard('PL');

      expect(screen.getByRole('group', { name: 'Your guess: PL' })).toBeInTheDocument();
    });

    it('lists guesses alphabetically after BRAVE and STORM, and the bounds read BRAVE and STORM', async () => {
      const { user } = await openRange();

      await guess(user, 'STORM', 'BRAVE');

      expect(boundWords()).toEqual({ upper: 'STORM', lower: 'BRAVE' });
      expect(listedWords()).toEqual(['BRAVE', 'STORM']);
    });

    it('marks each guess before or after, with its heat as a word (AC-49)', async () => {
      const { user } = await openRange();

      await guess(user, 'BRAVE', 'STORM');

      const [brave, storm] = within(
        screen.getByRole('list', { name: 'Your guesses, in alphabetical order' }),
      ).getAllByRole('listitem');
      expect(brave).toHaveTextContent('After');
      expect(brave).toHaveTextContent('Burning');
      expect(storm).toHaveTextContent('Before');
      expect(storm).toHaveTextContent('Burning');
    });

    it('shows the heat of the last guess beside the input row', async () => {
      const { user } = await openRange();
      expect(screen.getByText('No guesses yet')).toBeInTheDocument();

      await guess(user, 'BRAVE');

      expect(screen.queryByText('No guesses yet')).not.toBeInTheDocument();
      expect(screen.getByText('13 guesses left').parentElement).toHaveTextContent('Burning');
    });

    it('never colours the keyboard (FR-122)', async () => {
      const { user } = await openRange();

      await guess(user, 'BRAVE', 'STORM');

      const keyboard = screen.getByLabelText('Keyboard');
      for (const key of within(keyboard).getAllByRole('button')) {
        expect(key.className).not.toMatch(/key-(correct|present|absent)/);
        expect(key.getAttribute('aria-label') ?? '').not.toMatch(/correct|present|absent/);
      }
    });
  });

  describe('rejected guesses cost nothing (FR-117, AC-50, EC-42, EC-43)', () => {
    it.each([
      ['PAN', 'Not enough letters'],
      ['ZZZZZ', 'Not in word list'],
    ])('rejects %s with "%s"', async (word, message) => {
      const { user } = await openRange();

      await user.keyboard(`${word}{Enter}`);

      expect(await screen.findByRole('alert')).toHaveTextContent(message);
      expect(screen.getByText('14 guesses left')).toBeInTheDocument();
      expect(screen.getByRole('group', { name: `Your guess: ${word}` })).toBeInTheDocument();
    });

    it('rejects a repeat with "Already guessed"', async () => {
      const { user } = await openRange();
      await guess(user, 'BRAVE');

      await user.keyboard('BRAVE{Enter}');

      expect(await screen.findByRole('alert')).toHaveTextContent('Already guessed');
      expect(screen.getByText('13 guesses left')).toBeInTheDocument();
    });

    it('rejects a word outside the range with "Outside the range" and keeps the count (AC-50)', async () => {
      const { user } = await openRange();
      await guess(user, 'BRAVE', 'STORM');

      await user.keyboard('ABOUT{Enter}');

      expect(await screen.findByRole('alert')).toHaveTextContent('Outside the range');
      expect(screen.getByText('12 guesses left')).toBeInTheDocument();
      expect(listedWords()).toEqual(['BRAVE', 'STORM']);
    });
  });

  describe('winning and losing (FR-119, FR-123, AC-55)', () => {
    it('a win shows the result with the guesses used and the word', async () => {
      const { user } = await openRange();

      await guess(user, 'BRAVE', 'PLANT');

      const panel = await screen.findByRole('region', { name: 'You found it!' });
      expect(panel).toHaveTextContent('2 of 14 guesses');
      expect(within(panel).getByText('PLANT')).toBeInTheDocument();
      expect(within(panel).getByRole('button', { name: 'Play again' })).toBeInTheDocument();
    });

    it('the 14th wrong guess loses and reveals the word', async () => {
      const { user } = await openRange();

      await guess(user, ...LOSING_GUESSES);

      const panel = await screen.findByRole('region', { name: 'Out of guesses' });
      expect(panel).toHaveTextContent('14 of 14 guesses');
      expect(within(panel).getByText('PLANT')).toBeInTheDocument();
    });

    it('does not start a new game on the Enter that won, and does on the next (AC-55)', async () => {
      const { user } = await openRange();
      await guess(user, 'PLANT');
      await screen.findByRole('heading', { name: 'You found it!' });

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(screen.getByRole('heading', { name: 'You found it!' })).toBeInTheDocument();

      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'You found it!' })).not.toBeInTheDocument();
      });
      expect(boundWords()).toEqual({ upper: 'ZZZZZ', lower: 'AAAAA' });
      expect(screen.getByText('14 guesses left')).toBeInTheDocument();
    });

    it('locks input once the game is over', async () => {
      const { user } = await openRange();
      await guess(user, 'PLANT');
      await screen.findByRole('heading', { name: 'You found it!' });

      await user.keyboard('BR');

      expect(screen.getByRole('group', { name: 'Your guess: empty' })).toBeInTheDocument();
    });
  });

  describe('restarting (FR-125)', () => {
    it('does not ask with no guesses', async () => {
      const { user } = await openRange();

      await user.click(screen.getByRole('button', { name: 'New game' }));

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('asks after a guess, Cancel keeps the game and New game starts another', async () => {
      const { user } = await openRange();
      await guess(user, 'BRAVE');

      await user.click(screen.getByRole('button', { name: 'New game' }));
      const dialog = await screen.findByRole('alertdialog');
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(listedWords()).toEqual(['BRAVE']);

      await user.click(screen.getByRole('button', { name: 'New game' }));
      await user.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'New game' }),
      );

      await waitFor(() => {
        expect(listedWords()).toEqual([]);
      });
      expect(screen.getByText('14 guesses left')).toBeInTheDocument();
    });

    it('an abandoned game is not recorded', async () => {
      const { user } = await openRange();
      await guess(user, 'BRAVE');
      await user.click(screen.getByRole('button', { name: 'New game' }));
      await user.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'New game' }),
      );

      expect(localStorage.getItem(gameKeys('range').stats)).toBeNull();
    });
  });

  describe('leaving and returning (FR-65, FR-125, EC-24)', () => {
    async function leaveAndReturn(user: User): Promise<void> {
      await user.click(screen.getByRole('link', { name: 'All games' }));
      await screen.findByRole('link', { name: 'Play WordRange' });
      await user.click(screen.getByRole('link', { name: 'Play WordRange' }));
      await screen.findByRole('group', { name: /^Your guess/ });
    }

    it('restores the bounds, the guess list and the typed letters', async () => {
      const { user } = await openRange();
      await guess(user, 'STORM', 'BRAVE');
      await user.keyboard('PL');

      await leaveAndReturn(user);

      expect(boundWords()).toEqual({ upper: 'STORM', lower: 'BRAVE' });
      expect(listedWords()).toEqual(['BRAVE', 'STORM']);
      expect(screen.getByRole('group', { name: 'Your guess: PL' })).toBeInTheDocument();
      expect(screen.getByText('12 guesses left')).toBeInTheDocument();
    });

    it('discards a saved game whose secret has left the list and starts a new one', async () => {
      const { user } = await openRange();
      await guess(user, 'BRAVE');
      await user.click(screen.getByRole('link', { name: 'All games' }));
      await screen.findByRole('link', { name: 'Play WordRange' });

      const saved = JSON.parse(localStorage.getItem(gameKeys('range').session) ?? 'null') as {
        secret: string;
      };
      saved.secret = 'ZEBRA';
      localStorage.setItem(gameKeys('range').session, JSON.stringify(saved));

      await user.click(screen.getByRole('link', { name: 'Play WordRange' }));
      await screen.findByRole('group', { name: /^Your guess/ });

      expect(listedWords()).toEqual([]);
      expect(screen.getByText('14 guesses left')).toBeInTheDocument();
    });
  });

  describe('announcements (T-83: A11Y-22)', () => {
    function polite(): HTMLElement {
      return within(screen.getByRole('main')).getByRole('status');
    }

    it('announces direction, the new range, the heat and the guesses left', async () => {
      const { user } = await openRange();

      await guess(user, 'BRAVE');

      expect(polite().textContent?.trim()).toBe(
        'BRAVE: the word is after it. Range BRAVE to ZZZZZ. Burning. 13 guesses left.',
      );
    });

    it('says "before" and the narrowed range for a word past the secret', async () => {
      const { user } = await openRange();

      await guess(user, 'BRAVE', 'STORM');

      expect(polite().textContent?.trim()).toBe(
        'STORM: the word is before it. Range BRAVE to STORM. Burning. 12 guesses left.',
      );
    });

    it('announces the outcome when the game ends', async () => {
      const { user } = await openRange();

      await guess(user, 'BRAVE', 'PLANT');
      await screen.findByRole('heading', { name: 'You found it!' });

      expect(polite().textContent?.trim()).toBe('You found PLANT in 2 guesses.');
    });

    it('keeps errors in the assertive region, not the polite one (A11Y-4)', async () => {
      const { user } = await openRange();

      await user.keyboard('ZZZZZ{Enter}');

      expect(await screen.findByRole('alert')).toHaveTextContent('Not in word list');
      expect(polite().textContent?.trim()).toBe('');
    });
  });

  describe('help and statistics (T-83: FR-124, FR-126, US-38, AC-56)', () => {
    it('never opens the help dialog by itself (ADR-020)', async () => {
      await openRange();

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('opens How to play from the header', async () => {
      const { user } = await openRange();

      await user.click(screen.getByRole('button', { name: 'How to play' }));

      const dialog = await screen.findByRole('dialog', { name: 'How to play' });
      expect(dialog).toHaveTextContent('before');
      expect(dialog).toHaveTextContent('Freezing');
    });

    it('records a win once, with its distribution bucket', async () => {
      const { user } = await openRange();
      await guess(user, 'BRAVE', 'PLANT');
      await screen.findByRole('heading', { name: 'You found it!' });

      await user.click(screen.getByRole('button', { name: 'Statistics' }));
      const dialog = await screen.findByRole('dialog', { name: 'Statistics' });

      expect(within(dialog).getByText('Played').closest('div')).toHaveTextContent('1');
      expect(within(dialog).getByText('Win %').closest('div')).toHaveTextContent('100%');
      expect(dialog).toHaveTextContent('PLANT');
      const stored = JSON.parse(localStorage.getItem(gameKeys('range').stats) ?? '{}') as {
        distribution: number[];
      };
      expect(stored.distribution[1]).toBe(1);
    });

    it("resets only WordRange statistics, leaving other games' keys untouched (AC-56)", async () => {
      localStorage.setItem(gameKeys('wordwright').stats, '{"marker":"wordwright"}');
      localStorage.setItem(gameKeys('stack').stats, '{"marker":"stack"}');
      const { user } = await openRange();
      await guess(user, 'PLANT');
      await screen.findByRole('heading', { name: 'You found it!' });

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
      expect(localStorage.getItem(gameKeys('stack').stats)).toBe('{"marker":"stack"}');
      const stored = JSON.parse(localStorage.getItem(gameKeys('range').stats) ?? '{}') as {
        gamesPlayed: number;
      };
      expect(stored.gamesPlayed).toBe(0);
    });
  });
});
