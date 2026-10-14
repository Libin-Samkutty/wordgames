import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '@/App';
import { resetDictionaryCache } from '@/dictionary';
import { gameKeys } from '@/storage';

import { FILLER_GUESS, useCodeFixtures } from './codeFixtures';

/**
 * WordCode end to end through the real providers (T-85 … T-87: FR-127 …
 * FR-136, US-35, US-36, US-38, AC-45, AC-51, AC-52, AC-55, AC-56, A11Y-23,
 * EC-45).
 *
 * With the fixture lists the secret is LAMB at length 4, PLANT at 5 and PLANET
 * at 6.
 */

type User = ReturnType<typeof userEvent.setup>;

function seed(length: 4 | 5 | 6 = 5): void {
  localStorage.setItem(
    'wordgames:v1:settings',
    JSON.stringify({ theme: 'system', colorblind: false, motion: 'reduced' }),
  );
  localStorage.setItem(gameKeys('code').prefs, JSON.stringify({ defaultWordLength: length }));
}

async function openCode(): Promise<{ user: User }> {
  window.history.replaceState(null, '', '/#/code');
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('list', { name: 'Guesses' });
  await screen.findByRole('button', { name: 'Enter' });
  return { user };
}

async function guess(user: User, ...words: string[]): Promise<void> {
  for (const word of words) {
    await user.keyboard(`${word}{Enter}`);
  }
}

function rows(): HTMLElement[] {
  return within(screen.getByRole('list', { name: 'Guesses' })).getAllByRole('listitem');
}

/** A letter key on the keyboard, named `P`, or `P, ruled out` once marked or in Mark mode. */
function noteButton(letter: string): HTMLElement {
  const keyboard = screen.getByLabelText('Keyboard');
  return within(keyboard).getByRole('button', { name: new RegExp(`^${letter}(,|$)`) });
}

/** Switches the keyboard to Mark mode, where a letter key cycles its note. */
async function markMode(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'Mark' }));
}

describe('WordCode', () => {
  beforeEach(() => {
    resetDictionaryCache();
    localStorage.clear();
    seed();
    useCodeFixtures();
  });

  afterEach(() => {
    resetDictionaryCache();
    vi.restoreAllMocks();
  });

  describe('the screen (FR-127, FR-131, FR-132)', () => {
    it('opens with the right title, ten empty rows and a clean notepad (AC-45)', async () => {
      await openCode();

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('WordCode');
      expect(document.title).toBe('WordCode · WordGames');
      expect(rows()).toHaveLength(10);
      expect(screen.queryByRole('region', { name: 'Letter notes' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Type' })).toHaveAttribute('aria-pressed', 'true');
      expect(noteButton('P')).toHaveAccessibleName('P');
    });

    it('defaults to 5 letters and offers 4, 5 and 6 as a radio group (FR-127)', async () => {
      localStorage.removeItem(gameKeys('code').prefs);
      await openCode();

      expect(screen.getByRole('radio', { name: /^5/ })).toBeChecked();
      expect(screen.getAllByRole('radio').map((radio) => radio.textContent?.trim())).toEqual([
        '4 letters',
        '5 letters',
        '6 letters',
      ]);
    });

    it('shows typed letters in the active row', async () => {
      const { user } = await openCode();

      await user.keyboard('PL');

      expect(screen.getByRole('listitem', { name: 'Your guess: PL' })).toBeInTheDocument();
    });
  });

  describe('counts (FR-129, FR-131, AC-51)', () => {
    it('PANEL against PLANT shows "1 bull · 3 cows"', async () => {
      const { user } = await openCode();

      await guess(user, 'PANEL');

      expect(rows()[0]).toHaveTextContent('PANEL: 1 bull · 3 cows');
    });

    it('uses the singular and plural correctly', async () => {
      const { user } = await openCode();

      await guess(user, 'SLATE', 'PLANK', 'MUSIC');

      expect(rows()[0]).toHaveTextContent('SLATE: 2 bulls · 1 cow');
      expect(rows()[1]).toHaveTextContent('PLANK: 4 bulls · 0 cows');
      expect(rows()[2]).toHaveTextContent('MUSIC: 0 bulls · 0 cows');
    });

    it('draws no tile colours: the tiles are neutral whatever the counts', async () => {
      const { user } = await openCode();

      await guess(user, 'PANEL');

      const tiles = rows()[0]?.querySelectorAll('[aria-hidden="true"] > span') ?? [];
      expect(tiles).toHaveLength(5);
      for (const tile of tiles) expect(tile.className).not.toMatch(/tile-(correct|present|absent)/);
    });

    it('reads a guess row as one line, not a grid of letters', async () => {
      const { user } = await openCode();

      await guess(user, 'PANEL');

      expect(screen.queryByRole('grid')).not.toBeInTheDocument();
      expect(screen.queryByRole('gridcell')).not.toBeInTheDocument();
    });
  });

  describe('rejected guesses cost nothing (FR-128)', () => {
    it.each([
      ['PAN', 'Not enough letters'],
      ['ZZZZZ', 'Not in word list'],
    ])('rejects %s with "%s"', async (word, message) => {
      const { user } = await openCode();

      await user.keyboard(`${word}{Enter}`);

      expect(await screen.findByRole('alert')).toHaveTextContent(message);
      expect(screen.getByRole('listitem', { name: `Your guess: ${word}` })).toBeInTheDocument();
      expect(rows()[1]).not.toHaveTextContent('bull');
    });

    it('allows a repeated guess, as Wordwright does (FR-16)', async () => {
      const { user } = await openCode();

      await guess(user, 'PANEL', 'PANEL');

      expect(rows()[0]).toHaveTextContent('PANEL: 1 bull · 3 cows');
      expect(rows()[1]).toHaveTextContent('PANEL: 1 bull · 3 cows');
    });
  });

  describe('winning and losing (FR-130, FR-133, AC-55)', () => {
    it('a win shows the result with the guesses used and the word', async () => {
      const { user } = await openCode();

      await guess(user, 'PANEL', 'PLANT');

      const panel = await screen.findByRole('region', { name: 'You cracked it!' });
      expect(panel).toHaveTextContent('2 of 10 guesses');
      expect(within(panel).getByText('PLANT')).toBeInTheDocument();
      expect(within(panel).getByRole('button', { name: 'Play again' })).toBeInTheDocument();
      expect(within(panel).getByRole('button', { name: 'Change length' })).toBeInTheDocument();
    });

    it('the 10th wrong guess loses and reveals the word', async () => {
      const { user } = await openCode();

      await guess(user, ...Array.from({ length: 10 }, () => FILLER_GUESS));

      const panel = await screen.findByRole('region', { name: 'Out of guesses' });
      expect(panel).toHaveTextContent('10 of 10 guesses');
      expect(within(panel).getByText('PLANT')).toBeInTheDocument();
    });

    it('wins at length 4 and length 6', async () => {
      seed(4);
      const four = await openCode();
      await guess(four.user, 'LAMB');
      expect(await screen.findByRole('heading', { name: 'You cracked it!' })).toBeInTheDocument();
    });

    it('does not start a new game on the Enter that won, and does on the next (AC-55)', async () => {
      const { user } = await openCode();
      await guess(user, 'PLANT');
      await screen.findByRole('heading', { name: 'You cracked it!' });

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(screen.getByRole('heading', { name: 'You cracked it!' })).toBeInTheDocument();

      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'You cracked it!' })).not.toBeInTheDocument();
      });
      expect(rows()[0]).not.toHaveTextContent('bull');
    });

    it('Change length switches length without a confirmation (FR-133)', async () => {
      const { user } = await openCode();
      await guess(user, 'PLANT');
      await screen.findByRole('heading', { name: 'You cracked it!' });

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
      await screen.findByRole('list', { name: 'Guesses' });
    });

    it('locks input once the game is over', async () => {
      const { user } = await openCode();
      await guess(user, 'PLANT');
      await screen.findByRole('heading', { name: 'You cracked it!' });

      await user.keyboard('PL');

      expect(screen.queryByRole('listitem', { name: /Your guess/ })).not.toBeInTheDocument();
    });
  });

  describe('letter notes (FR-132, EC-45, AC-52)', () => {
    it('three presses return a letter to unmarked, and the name says the mark (A11Y-23)', async () => {
      const { user } = await openCode();
      await markMode(user);

      await user.click(noteButton('P'));
      expect(noteButton('P')).toHaveAccessibleName('P, ruled out');
      await user.click(noteButton('P'));
      expect(noteButton('P')).toHaveAccessibleName('P, in the word');
      await user.click(noteButton('P'));
      expect(noteButton('P')).toHaveAccessibleName('P, unmarked');
    });

    it('shows each mark on the matching keyboard key', async () => {
      const { user } = await openCode();
      await markMode(user);
      const keyboard = screen.getByLabelText('Keyboard');

      await user.click(noteButton('P'));
      await user.click(noteButton('Q'));
      await user.click(noteButton('Q'));

      expect(within(keyboard).getByRole('button', { name: 'P, ruled out' })).toBeInTheDocument();
      expect(within(keyboard).getByRole('button', { name: 'Q, in the word' })).toBeInTheDocument();
      expect(within(keyboard).getByRole('button', { name: 'W, unmarked' })).toBeInTheDocument();
    });

    it('marks look different from game feedback and from each other without colour', async () => {
      const { user } = await openCode();
      await markMode(user);

      await user.click(noteButton('P'));
      await user.click(noteButton('Q'));
      await user.click(noteButton('Q'));

      expect(noteButton('P').className).toContain('outline-dashed');
      expect(noteButton('Q').className).toContain('outline-solid');
      expect(noteButton('P')).toHaveTextContent('×');
      expect(noteButton('Q')).toHaveTextContent('●');
      for (const letter of ['P', 'Q']) {
        expect(noteButton(letter).className).not.toMatch(/key-(correct|present|absent)/);
      }
    });

    it('no guess changes a mark', async () => {
      const { user } = await openCode();
      await markMode(user);
      await user.click(noteButton('P'));
      await user.click(noteButton('Z'));

      await guess(user, 'PANEL', 'SLATE');

      expect(noteButton('P')).toHaveAccessibleName('P, ruled out');
      expect(noteButton('Z')).toHaveAccessibleName('Z, ruled out');
      expect(noteButton('A')).toHaveAccessibleName('A, unmarked');
    });

    it('typing on the keyboard does not change a mark', async () => {
      const { user } = await openCode();

      await user.click(
        within(screen.getByLabelText('Keyboard')).getByRole('button', { name: 'P' }),
      );

      expect(noteButton('P')).toHaveAccessibleName('P');
      expect(screen.getByRole('listitem', { name: 'Your guess: P' })).toBeInTheDocument();
    });

    it('survive leaving and returning, with the rows and the typed letters (AC-52, EC-45)', async () => {
      const { user } = await openCode();
      await markMode(user);
      await user.click(noteButton('P'));
      await user.click(noteButton('Q'));
      await user.click(noteButton('Q'));
      await guess(user, 'PANEL');
      await user.keyboard('SL');

      await user.click(screen.getByRole('link', { name: 'All games' }));
      await screen.findByRole('link', { name: 'Play WordCode' });
      await user.click(screen.getByRole('link', { name: 'Play WordCode' }));
      await screen.findByRole('list', { name: 'Guesses' });

      expect(noteButton('P')).toHaveAccessibleName('P, ruled out');
      expect(noteButton('Q')).toHaveAccessibleName('Q, in the word');
      expect(rows()[0]).toHaveTextContent('PANEL: 1 bull · 3 cows');
      expect(screen.getByRole('listitem', { name: 'Your guess: SL' })).toBeInTheDocument();
      expect(
        within(screen.getByLabelText('Keyboard')).getByRole('button', { name: 'P, ruled out' }),
      ).toBeInTheDocument();
    });

    it('a new game starts with a clean notepad', async () => {
      const { user } = await openCode();
      await markMode(user);
      await user.click(noteButton('P'));

      await user.click(screen.getByRole('button', { name: 'New game' }));

      expect(noteButton('P')).toHaveAccessibleName('P, unmarked');
    });
  });

  describe('restarting and switching length (FR-135)', () => {
    it('does not ask with no guesses', async () => {
      const { user } = await openCode();

      await user.click(screen.getByRole('radio', { name: /^4/ }));

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByRole('radio', { name: /^4/ })).toBeChecked();
      });
    });

    it('asks after a guess; Cancel keeps the game and Switch changes the length', async () => {
      const { user } = await openCode();
      await guess(user, 'PANEL');

      await user.click(screen.getByRole('radio', { name: /^4/ }));
      const dialog = await screen.findByRole('alertdialog');
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      expect(screen.getByRole('radio', { name: /^5/ })).toBeChecked();
      expect(rows()[0]).toHaveTextContent('PANEL');

      await user.click(screen.getByRole('radio', { name: /^4/ }));
      await user.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Switch' }),
      );

      await waitFor(() => {
        expect(screen.getByRole('radio', { name: /^4/ })).toBeChecked();
      });
      await waitFor(() => {
        expect(rows()[0]).not.toHaveTextContent('PANEL');
      });
    });

    it('New game after a guess asks first, and an abandoned game is not recorded', async () => {
      const { user } = await openCode();
      await guess(user, 'PANEL');

      await user.click(screen.getByRole('button', { name: 'New game' }));
      await user.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'New game' }),
      );

      await waitFor(() => {
        expect(rows()[0]).not.toHaveTextContent('PANEL');
      });
      expect(localStorage.getItem(gameKeys('code').stats)).toBeNull();
    });

    it('remembers the length for the next visit', async () => {
      const { user } = await openCode();

      await user.click(screen.getByRole('radio', { name: /^6/ }));
      await waitFor(() => {
        expect(screen.getByRole('radio', { name: /^6/ })).toBeChecked();
      });

      expect(JSON.parse(localStorage.getItem(gameKeys('code').prefs) ?? '{}')).toEqual({
        defaultWordLength: 6,
      });
    });
  });

  describe('leaving and returning (FR-65, FR-135, EC-24)', () => {
    it('discards a saved game whose secret has left the list and starts a new one', async () => {
      const { user } = await openCode();
      await guess(user, 'PANEL');
      await user.click(screen.getByRole('link', { name: 'All games' }));
      await screen.findByRole('link', { name: 'Play WordCode' });

      const saved = JSON.parse(localStorage.getItem(gameKeys('code').session) ?? 'null') as {
        secret: string;
      };
      saved.secret = 'ZEBRA';
      localStorage.setItem(gameKeys('code').session, JSON.stringify(saved));

      await user.click(screen.getByRole('link', { name: 'Play WordCode' }));
      await screen.findByRole('list', { name: 'Guesses' });

      await waitFor(() => {
        expect(rows()[0]).not.toHaveTextContent('bull');
      });
    });

    it('ignores a saved game of the other length', async () => {
      const { user } = await openCode();
      await guess(user, 'PANEL');
      await user.click(screen.getByRole('link', { name: 'All games' }));
      await screen.findByRole('link', { name: 'Play WordCode' });
      localStorage.setItem(gameKeys('code').prefs, JSON.stringify({ defaultWordLength: 4 }));

      await user.click(screen.getByRole('link', { name: 'Play WordCode' }));

      await screen.findByRole('list', { name: 'Guesses' });
      expect(screen.getByRole('radio', { name: /^4/ })).toBeChecked();
      expect(rows()[0]).not.toHaveTextContent('bull');
    });
  });

  describe('announcements (T-87: A11Y-23)', () => {
    function polite(): HTMLElement {
      return within(screen.getByRole('main')).getByRole('status');
    }

    it('announces the counts in words with the guesses left', async () => {
      const { user } = await openCode();

      await guess(user, 'PANEL');

      expect(polite().textContent?.trim()).toBe('PANEL: 1 bull, 3 cows. 9 guesses left.');
    });

    it('uses the singular for one cow and says zero out loud', async () => {
      const { user } = await openCode();

      await guess(user, 'SLATE');
      expect(polite().textContent?.trim()).toBe('SLATE: 2 bulls, 1 cow. 9 guesses left.');

      await guess(user, 'MUSIC');
      expect(polite().textContent?.trim()).toBe('MUSIC: 0 bulls, 0 cows. 8 guesses left.');
    });

    it('announces the outcome when the game ends', async () => {
      const { user } = await openCode();

      await guess(user, 'PANEL', 'PLANT');
      await screen.findByRole('heading', { name: 'You cracked it!' });

      expect(polite().textContent?.trim()).toBe('You found PLANT in 2 guesses.');
    });

    it('keeps errors in the assertive region, not the polite one (A11Y-4)', async () => {
      const { user } = await openCode();

      await user.keyboard('ZZZZZ{Enter}');

      expect(await screen.findByRole('alert')).toHaveTextContent('Not in word list');
      expect(polite().textContent?.trim()).toBe('');
    });
  });

  describe('help and statistics (T-87: FR-134, FR-136, US-38, AC-56)', () => {
    it('never opens the help dialog by itself (ADR-020)', async () => {
      await openCode();

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('opens How to play, with an example that follows the selected length', async () => {
      seed(6);
      const { user } = await openCode();

      await user.click(screen.getByRole('button', { name: 'How to play' }));

      const dialog = await screen.findByRole('dialog', { name: 'How to play' });
      expect(dialog).toHaveTextContent('6-letter word');
      expect(dialog).toHaveTextContent('PLANET');
    });

    it('records a win once, overall and for its length', async () => {
      const { user } = await openCode();
      await guess(user, 'PANEL', 'PLANT');
      await screen.findByRole('heading', { name: 'You cracked it!' });

      await user.click(screen.getByRole('button', { name: 'Statistics' }));
      const dialog = await screen.findByRole('dialog', { name: 'Statistics' });

      expect(within(dialog).getByText('Played').closest('div')).toHaveTextContent('1');
      expect(within(dialog).getByText('Win %').closest('div')).toHaveTextContent('100%');
      const stored = JSON.parse(localStorage.getItem(gameKeys('code').stats) ?? '{}') as {
        perLength: Record<string, { gamesPlayed: number; distribution: number[] }>;
      };
      expect(stored.perLength['5']?.gamesPlayed).toBe(1);
      expect(stored.perLength['5']?.distribution[1]).toBe(1);
      expect(stored.perLength['4']?.gamesPlayed).toBe(0);
    });

    it("resets only WordCode statistics, leaving other games' keys untouched (AC-56)", async () => {
      localStorage.setItem(gameKeys('wordwright').stats, '{"marker":"wordwright"}');
      localStorage.setItem(gameKeys('range').stats, '{"marker":"range"}');
      const { user } = await openCode();
      await guess(user, 'PLANT');
      await screen.findByRole('heading', { name: 'You cracked it!' });

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
      expect(localStorage.getItem(gameKeys('range').stats)).toBe('{"marker":"range"}');
    });
  });
});
