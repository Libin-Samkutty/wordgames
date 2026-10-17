import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '@/App';
import { resetDictionaryCache } from '@/dictionary';
import { gameKeys } from '@/storage';

import { MISS_LETTERS, useHangFixtures } from './hangFixtures';

/**
 * WordHang end to end through the real providers (T-101, T-102: FR-167 to
 * FR-175, US-41, AC-45, AC-55, AC-56, AC-60, A11Y-27).
 *
 * With the fixture lists the secret is LAMB at length 4, PLANT at 5 and
 * PLANET at 6.
 */

type User = ReturnType<typeof userEvent.setup>;

function seed(length: 4 | 5 | 6 = 5): void {
  localStorage.setItem(
    'wordgames:v1:settings',
    JSON.stringify({ theme: 'system', colorblind: false, motion: 'reduced' }),
  );
  localStorage.setItem(gameKeys('hang').prefs, JSON.stringify({ defaultWordLength: length }));
}

async function openHang(): Promise<{ user: User }> {
  window.history.replaceState(null, '', '/#/hang');
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('group', { name: /^Word:/ });
  await screen.findByRole('button', { name: 'Q' });
  return { user };
}

function word(): HTMLElement {
  return screen.getByRole('group', { name: /^Word:/ });
}

function polite(): HTMLElement {
  return within(screen.getByRole('main')).getByRole('status');
}

function key(letter: string): HTMLElement {
  return within(screen.getByLabelText('Keyboard')).getByRole('button', {
    name: new RegExp(`^${letter}(,|$)`),
  });
}

function figureMisses(): string | null {
  return document.querySelector('svg[data-misses]')?.getAttribute('data-misses') ?? null;
}

describe('WordHang', () => {
  beforeEach(() => {
    resetDictionaryCache();
    localStorage.clear();
    seed();
    useHangFixtures();
  });

  afterEach(() => {
    resetDictionaryCache();
    vi.restoreAllMocks();
  });

  describe('the screen (FR-167, FR-171)', () => {
    it('opens with the right title, a hidden word, no misses and 26 letter keys (AC-45)', async () => {
      await openHang();

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('WordHang');
      expect(document.title).toBe('WordHang · WordGames');
      expect(word()).toHaveAccessibleName('Word: blank, blank, blank, blank, blank');
      expect(screen.getByText('0 of 6 misses')).toBeInTheDocument();
      expect(screen.getByText('No wrong letters yet')).toBeInTheDocument();
      expect(figureMisses()).toBe('0');
      expect(within(screen.getByLabelText('Keyboard')).getAllByRole('button')).toHaveLength(26);
    });

    it('has no Enter or Backspace key, since a guess needs neither (FR-169)', async () => {
      await openHang();

      expect(screen.queryByRole('button', { name: 'Enter' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Backspace' })).not.toBeInTheDocument();
    });

    it('defaults to 5 letters and offers 4, 5 and 6 as a radio group (FR-167)', async () => {
      localStorage.removeItem(gameKeys('hang').prefs);
      await openHang();

      expect(screen.getByRole('radio', { name: /^5/ })).toBeChecked();
      expect(screen.getAllByRole('radio').map((radio) => radio.textContent?.trim())).toEqual([
        '4 letters',
        '5 letters',
        '6 letters',
      ]);
    });

    it('draws the figure from a number of parts that matches the misses, and hides it from assistive tech', async () => {
      const { user } = await openHang();

      await user.keyboard('QZ');

      const figure = document.querySelector('svg[data-misses]');
      expect(figure).toHaveAttribute('aria-hidden', 'true');
      expect(figure?.querySelectorAll('circle, line')).toHaveLength(2);
    });
  });

  describe('guessing (FR-169, FR-170)', () => {
    it('a letter in the word shows in its place, and its key shows it was in the word', async () => {
      const { user } = await openHang();

      await user.keyboard('p');

      expect(word()).toHaveAccessibleName('Word: P, blank, blank, blank, blank');
      expect(key('P')).toHaveAccessibleName('P, in the word');
      expect(key('P')).toBeDisabled();
      expect(figureMisses()).toBe('0');
    });

    it('a letter not in the word is a miss: counted, listed, drawn and marked on its key', async () => {
      const { user } = await openHang();

      await user.keyboard('Z');

      expect(screen.getByText('1 of 6 misses')).toBeInTheDocument();
      expect(screen.getByText('Z', { selector: 'span' })).toBeInTheDocument();
      expect(figureMisses()).toBe('1');
      expect(key('Z')).toHaveAccessibleName('Z, not in the word');
      expect(key('Z')).toBeDisabled();
    });

    it('tapping a key does the same as pressing it', async () => {
      const { user } = await openHang();

      await user.click(key('L'));
      await user.click(key('Q'));

      expect(word()).toHaveAccessibleName('Word: blank, L, blank, blank, blank');
      expect(screen.getByText('1 of 6 misses')).toBeInTheDocument();
    });

    it('marks a tried key with a tick or a cross as well as its colour (A11Y-8)', async () => {
      const { user } = await openHang();

      await user.keyboard('PZ');

      expect(key('P')).toHaveTextContent('✓');
      expect(key('Z')).toHaveTextContent('✗');
      expect(key('A')).not.toHaveTextContent(/[✓✗]/);
    });

    it('a letter already tried costs nothing and shows no toast', async () => {
      const { user } = await openHang();

      await user.keyboard('ZZZ');

      expect(screen.getByText('1 of 6 misses')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeEmptyDOMElement();
    });

    it('ignores digits, punctuation and Enter during play', async () => {
      const { user } = await openHang();

      await user.keyboard('1!{Enter}{Backspace}');

      expect(screen.getByText('0 of 6 misses')).toBeInTheDocument();
      expect(word()).toHaveAccessibleName('Word: blank, blank, blank, blank, blank');
    });

    it('reveals every place of a repeated letter at once', async () => {
      localStorage.setItem(
        gameKeys('hang').session,
        JSON.stringify({
          id: 'old',
          wordLength: 5,
          secret: 'APPLE',
          tried: '',
          status: 'playing',
          startedAt: null,
          finishedAt: null,
        }),
      );
      const { user } = await openHang();

      await user.keyboard('P');

      expect(word()).toHaveAccessibleName('Word: blank, P, P, blank, blank');
    });
  });

  describe('winning and losing (FR-170, FR-172, AC-55)', () => {
    it('revealing every letter wins, with no misses, the word and the time', async () => {
      const { user } = await openHang();

      await user.keyboard('PLANT');

      const panel = await screen.findByRole('region', { name: 'You saved them!' });
      expect(panel).toHaveTextContent('No misses');
      expect(panel).toHaveTextContent('PLANT');
      expect(word()).toHaveAccessibleName('Word: PLANT');
      expect(screen.queryByLabelText('Keyboard')).not.toBeInTheDocument();
    });

    it('a win after some misses says how many', async () => {
      const { user } = await openHang();

      await user.keyboard(`QZ${'PLANT'}`);

      expect(await screen.findByRole('region', { name: 'You saved them!' })).toHaveTextContent(
        '2 of 6 misses',
      );
    });

    it('the sixth miss loses, shows the whole word and counts six misses', async () => {
      const { user } = await openHang();

      await user.keyboard(MISS_LETTERS);

      const panel = await screen.findByRole('region', { name: 'Out of misses' });
      expect(panel).toHaveTextContent('6 of 6 misses');
      expect(panel).toHaveTextContent('PLANT');
      expect(word()).toHaveAccessibleName('Word: PLANT');
      expect(figureMisses()).toBe('6');
    });

    it('shows the letters never guessed in a lost game differently from those found', async () => {
      const { user } = await openHang();

      await user.keyboard(`P${MISS_LETTERS}`);

      await screen.findByRole('heading', { name: 'Out of misses' });
      const tiles = [...word().querySelectorAll('span[data-revealed]')];
      expect(tiles.map((tile) => tile.getAttribute('data-revealed'))).toEqual([
        'true',
        'false',
        'false',
        'false',
        'false',
      ]);
      expect(tiles.map((tile) => tile.textContent).join('')).toBe('PLANT');
    });

    it('does not start a new game on the letter that ended it, and does on Enter (AC-55)', async () => {
      const { user } = await openHang();
      await user.keyboard('PLANT');
      await screen.findByRole('heading', { name: 'You saved them!' });

      expect(figureMisses()).toBe('0');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'You saved them!' })).not.toBeInTheDocument();
      });
      expect(word()).toHaveAccessibleName('Word: blank, blank, blank, blank, blank');
    });

    it('Change length switches length without a confirmation', async () => {
      const { user } = await openHang();
      await user.keyboard('PLANT');
      await screen.findByRole('heading', { name: 'You saved them!' });

      await user.click(screen.getByRole('button', { name: 'Change length' }));
      await user.click(
        within(screen.getByRole('group', { name: 'New game length' })).getByRole('button', {
          name: '4 letters',
        }),
      );

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByRole('radio', { name: /^4/ })).toBeChecked();
      });
      await screen.findByRole('button', { name: 'Q' });
      expect(word()).toHaveAccessibleName('Word: blank, blank, blank, blank');
    });

    it('wins at length 4', async () => {
      seed(4);
      const four = await openHang();
      await four.user.keyboard('LAMB');
      await screen.findByRole('heading', { name: 'You saved them!' });
    });

    it('wins at length 6', async () => {
      seed(6);
      const six = await openHang();
      await six.user.keyboard('PLANET');
      await screen.findByRole('heading', { name: 'You saved them!' });
    });
  });

  describe('restarting and switching length (FR-173)', () => {
    it('does not ask with no letter tried', async () => {
      const { user } = await openHang();

      await user.click(screen.getByRole('radio', { name: /^4/ }));

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByRole('radio', { name: /^4/ })).toBeChecked();
      });
    });

    it('asks after a letter; Cancel keeps the game and Switch changes the length', async () => {
      const { user } = await openHang();
      await user.keyboard('P');

      await user.click(screen.getByRole('radio', { name: /^4/ }));
      const dialog = await screen.findByRole('alertdialog');
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      expect(screen.getByRole('radio', { name: /^5/ })).toBeChecked();
      expect(word()).toHaveAccessibleName('Word: P, blank, blank, blank, blank');

      await user.click(screen.getByRole('radio', { name: /^4/ }));
      await user.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Switch' }),
      );

      await waitFor(() => {
        expect(screen.getByRole('radio', { name: /^4/ })).toBeChecked();
      });
      await waitFor(() => {
        expect(word()).toHaveAccessibleName('Word: blank, blank, blank, blank');
      });
    });

    it('New game after a letter asks first, and an abandoned game is not recorded', async () => {
      const { user } = await openHang();
      await user.keyboard('Z');

      await user.click(screen.getByRole('button', { name: 'New game' }));
      await user.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'New game' }),
      );

      await waitFor(() => {
        expect(screen.getByText('0 of 6 misses')).toBeInTheDocument();
      });
      expect(localStorage.getItem(gameKeys('hang').stats)).toBeNull();
    });

    it('remembers the length for the next visit', async () => {
      const { user } = await openHang();

      await user.click(screen.getByRole('radio', { name: /^6/ }));
      await waitFor(() => {
        expect(screen.getByRole('radio', { name: /^6/ })).toBeChecked();
      });

      expect(JSON.parse(localStorage.getItem(gameKeys('hang').prefs) ?? '{}')).toEqual({
        defaultWordLength: 6,
      });
    });
  });

  describe('leaving and returning (FR-65, FR-173, EC-24)', () => {
    async function leaveAndReturn(user: User): Promise<void> {
      await user.click(screen.getByRole('link', { name: 'All games' }));
      await screen.findByRole('link', { name: 'Play WordHang' });
    }

    it('restores the letters tried, the misses and the figure', async () => {
      const { user } = await openHang();
      await user.keyboard('PZQ');

      await leaveAndReturn(user);
      await user.click(screen.getByRole('link', { name: 'Play WordHang' }));
      await screen.findByRole('group', { name: /^Word:/ });

      expect(word()).toHaveAccessibleName('Word: P, blank, blank, blank, blank');
      expect(screen.getByText('2 of 6 misses')).toBeInTheDocument();
      expect(figureMisses()).toBe('2');
      expect(key('P')).toBeDisabled();
      expect(key('Z')).toHaveAccessibleName('Z, not in the word');
    });

    it('restores a finished game with its result', async () => {
      const { user } = await openHang();
      await user.keyboard('PLANT');
      await screen.findByRole('heading', { name: 'You saved them!' });

      await leaveAndReturn(user);
      await user.click(screen.getByRole('link', { name: 'Play WordHang' }));

      expect(await screen.findByRole('heading', { name: 'You saved them!' })).toBeInTheDocument();
    });

    it('discards a saved game whose secret has left the list and starts a new one', async () => {
      const { user } = await openHang();
      await user.keyboard('P');
      await leaveAndReturn(user);

      const saved = JSON.parse(localStorage.getItem(gameKeys('hang').session) ?? 'null') as {
        secret: string;
      };
      saved.secret = 'ZEBRA';
      localStorage.setItem(gameKeys('hang').session, JSON.stringify(saved));

      await user.click(screen.getByRole('link', { name: 'Play WordHang' }));
      await screen.findByRole('group', { name: /^Word:/ });

      await waitFor(() => {
        expect(word()).toHaveAccessibleName('Word: blank, blank, blank, blank, blank');
      });
    });

    it('ignores a saved game of the other length', async () => {
      const { user } = await openHang();
      await user.keyboard('P');
      await leaveAndReturn(user);
      localStorage.setItem(gameKeys('hang').prefs, JSON.stringify({ defaultWordLength: 4 }));

      await user.click(screen.getByRole('link', { name: 'Play WordHang' }));

      await screen.findByRole('group', { name: /^Word:/ });
      expect(screen.getByRole('radio', { name: /^4/ })).toBeChecked();
      expect(word()).toHaveAccessibleName('Word: blank, blank, blank, blank');
    });

    it('drops a corrupt saved game and starts a new one', async () => {
      localStorage.setItem(gameKeys('hang').session, JSON.stringify({ id: 'x', tried: 'PP' }));

      await openHang();

      expect(word()).toHaveAccessibleName('Word: blank, blank, blank, blank, blank');
    });
  });

  describe('announcements (A11Y-27)', () => {
    it('says a letter is in the word, with the word so far and the misses left', async () => {
      const { user } = await openHang();

      await user.keyboard('P');

      expect(polite().textContent?.trim()).toBe(
        'P is in the word. Word so far: P, blank, blank, blank, blank. 6 misses left.',
      );
    });

    it('says how many times a repeated letter appears', async () => {
      localStorage.setItem(
        gameKeys('hang').session,
        JSON.stringify({
          id: 'old',
          wordLength: 5,
          secret: 'APPLE',
          tried: '',
          status: 'playing',
          startedAt: null,
          finishedAt: null,
        }),
      );
      const { user } = await openHang();

      await user.keyboard('P');

      expect(polite().textContent?.trim()).toBe(
        'P is in the word, 2 times. Word so far: blank, P, P, blank, blank. 6 misses left.',
      );
    });

    it('says a letter is not in the word, and counts down to 1 miss left in the singular', async () => {
      const { user } = await openHang();

      await user.keyboard('Z');
      expect(polite().textContent?.trim()).toBe('Z is not in the word. 5 misses left.');

      await user.keyboard('QXJK');
      expect(polite().textContent?.trim()).toBe('K is not in the word. 1 miss left.');
    });

    it('announces a win and a loss when the game ends', async () => {
      const { user } = await openHang();
      await user.keyboard('QPLANT');
      await screen.findByRole('heading', { name: 'You saved them!' });
      expect(polite().textContent?.trim()).toBe('You guessed PLANT with 1 miss.');

      await user.keyboard('{Enter}');
      await user.keyboard(MISS_LETTERS);
      await screen.findByRole('heading', { name: 'Out of misses' });
      expect(polite().textContent?.trim()).toBe('You lost. The word was PLANT.');
    });

    it('says a perfect win has no misses', async () => {
      const { user } = await openHang();

      await user.keyboard('PLANT');
      await screen.findByRole('heading', { name: 'You saved them!' });

      expect(polite().textContent?.trim()).toBe('You guessed PLANT with no misses.');
    });
  });

  describe('help and statistics (T-102: FR-174, FR-175, US-41, AC-56)', () => {
    it('never opens the help dialog by itself (ADR-020)', async () => {
      await openHang();

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('opens How to play, with an example that follows the selected length', async () => {
      seed(6);
      const { user } = await openHang();

      await user.click(screen.getByRole('button', { name: 'How to play' }));

      const dialog = await screen.findByRole('dialog', { name: 'How to play' });
      expect(dialog).toHaveTextContent('6-letter word');
      expect(dialog).toHaveTextContent('PLANET');
      expect(dialog).toHaveTextContent('6 misses');
    });

    it('records a win once, overall and for its length', async () => {
      const { user } = await openHang();
      await user.keyboard('ZPLANT');
      await screen.findByRole('heading', { name: 'You saved them!' });

      await user.click(screen.getByRole('button', { name: 'Statistics' }));
      const dialog = await screen.findByRole('dialog', { name: 'Statistics' });

      expect(within(dialog).getByText('Played').closest('div')).toHaveTextContent('1');
      expect(within(dialog).getByText('Win %').closest('div')).toHaveTextContent('100%');
      expect(within(dialog).getByText('Avg misses').closest('div')).toHaveTextContent('1.0');
      const stored = JSON.parse(localStorage.getItem(gameKeys('hang').stats) ?? '{}') as {
        perLength: Record<string, { gamesPlayed: number; distribution: number[] }>;
      };
      expect(stored.perLength['5']?.gamesPlayed).toBe(1);
      expect(stored.perLength['5']?.distribution[1]).toBe(1);
      expect(stored.perLength['4']?.gamesPlayed).toBe(0);
    });

    it('records a loss and shows it in the recent games', async () => {
      const { user } = await openHang();
      await user.keyboard(MISS_LETTERS);
      await screen.findByRole('heading', { name: 'Out of misses' });

      await user.click(screen.getByRole('button', { name: 'Statistics' }));
      const dialog = await screen.findByRole('dialog', { name: 'Statistics' });

      expect(within(dialog).getByText('Win %').closest('div')).toHaveTextContent('0%');
      expect(within(dialog).getByText('Lost')).toBeInTheDocument();
    });

    it("resets only WordHang statistics, leaving other games' keys untouched (AC-56)", async () => {
      localStorage.setItem(gameKeys('wordwright').stats, '{"marker":"wordwright"}');
      localStorage.setItem(gameKeys('code').stats, '{"marker":"code"}');
      const { user } = await openHang();
      await user.keyboard('PLANT');
      await screen.findByRole('heading', { name: 'You saved them!' });

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
      expect(localStorage.getItem(gameKeys('code').stats)).toBe('{"marker":"code"}');
    });
  });
});
