import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '@/App';
import { resetDictionaryCache } from '@/dictionary';
import { gameKeys } from '@/storage';

import { HUNT_BONUS, HUNT_REQUIRED, useHuntFixtures } from './huntFixtures';

/**
 * WordHunt end to end through the real providers (T-97, T-98: FR-158 to
 * FR-167, US-40, AC-45, AC-55, AC-56, AC-59, A11Y-26).
 *
 * With the fixture lists the only seed is STAPLE, which hides twelve common
 * words (HUNT_REQUIRED) and some bonus words.
 */

type User = ReturnType<typeof userEvent.setup>;

function seed(): void {
  localStorage.setItem(
    'wordgames:v1:settings',
    JSON.stringify({ theme: 'system', colorblind: false, motion: 'reduced' }),
  );
}

async function openHunt(): Promise<{ user: User }> {
  window.history.replaceState(null, '', '/#/hunt');
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('group', { name: 'Words to find' });
  return { user };
}

async function submitWords(user: User, ...words: string[]): Promise<void> {
  for (const word of words) {
    await user.keyboard(`${word}{Enter}`);
  }
}

function polite(): HTMLElement {
  return within(screen.getByRole('main')).getAllByRole('status')[0] as HTMLElement;
}

/** The "N of M found" line above the board, apart from the screen-reader announcement. */
function foundLine(): HTMLElement {
  return screen.getByText('found', { exact: false, selector: 'p' });
}

function slots(): HTMLElement {
  return screen.getByRole('group', { name: 'Words to find' });
}

function wordRow(): HTMLElement {
  return screen.getByRole('group', { name: /^Your word:/ });
}

function trayLetters(): string[] {
  return within(screen.getByRole('group', { name: 'Letter tray' }))
    .getAllByRole('button')
    .map((button) => button.textContent ?? '');
}

describe('WordHunt', () => {
  beforeEach(() => {
    resetDictionaryCache();
    localStorage.clear();
    seed();
    useHuntFixtures();
  });

  afterEach(() => {
    resetDictionaryCache();
    vi.restoreAllMocks();
  });

  describe('the screen (FR-158, FR-160)', () => {
    it('opens with the right title, a tray of six letters and every slot empty (AC-45)', async () => {
      await openHunt();

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('WordHunt');
      expect(document.title).toBe('WordHunt · WordGames');
      expect([...trayLetters()].sort().join('')).toBe('AELPST');
      expect(trayLetters().join('')).not.toBe('STAPLE');
      expect(foundLine()).toHaveTextContent('0 of 12 found');
      expect(wordRow()).toHaveAccessibleName('Your word: empty');
    });

    it('groups the slots by length with a count for each', async () => {
      await openHunt();

      expect(within(slots()).getByText('4 letters · 0 of 8')).toBeInTheDocument();
      expect(within(slots()).getByText('5 letters · 0 of 3')).toBeInTheDocument();
      expect(within(slots()).getByText('6 letters · 0 of 1')).toBeInTheDocument();
      expect(within(slots()).getAllByRole('listitem')).toHaveLength(12);
      expect(within(slots()).getAllByLabelText('4 letters, not found')).toHaveLength(8);
    });

    it('has no length selector, and reads 0:00 before the first letter', async () => {
      await openHunt();

      expect(screen.queryByRole('radio')).not.toBeInTheDocument();
      expect(screen.getByRole('timer', { name: 'Time' })).toHaveTextContent('0:00');
    });
  });

  describe('building a word (FR-160)', () => {
    it('typing and tapping build the same word', async () => {
      const { user } = await openHunt();

      await user.keyboard('LE');
      const tray = screen.getByRole('group', { name: 'Letter tray' });
      await user.click(within(tray).getByRole('button', { name: 'A' }));
      await user.click(within(tray).getByRole('button', { name: 'P' }));

      expect(wordRow()).toHaveAccessibleName('Your word: LEAP');
    });

    it('marks the tray letters in use, and gives them back on Backspace', async () => {
      const { user } = await openHunt();
      const tray = screen.getByRole('group', { name: 'Letter tray' });

      await user.keyboard('LE');
      expect(within(tray).getByRole('button', { name: 'L, used' })).toBeDisabled();
      expect(within(tray).getByRole('button', { name: 'E, used' })).toBeDisabled();

      await user.keyboard('{Backspace}');
      expect(within(tray).getByRole('button', { name: 'E' })).toBeEnabled();
      expect(within(tray).getByRole('button', { name: 'L, used' })).toBeDisabled();
    });

    it('ignores a letter that is not in the tray, and one that has run out, with no toast', async () => {
      const { user } = await openHunt();

      await user.keyboard('ZPP');

      expect(wordRow()).toHaveAccessibleName('Your word: P');
      expect(screen.getByRole('alert')).toBeEmptyDOMElement();
    });

    it('Backspace on an empty row does nothing', async () => {
      const { user } = await openHunt();

      await user.keyboard('{Backspace}');

      expect(wordRow()).toHaveAccessibleName('Your word: empty');
    });
  });

  describe('submitting words (FR-161, FR-162, AC-59)', () => {
    it('a common word fills its slot and is announced with the count (A11Y-26)', async () => {
      const { user } = await openHunt();

      await submitWords(user, 'LEAP');

      expect(within(slots()).getByText('4 letters · 1 of 8')).toBeInTheDocument();
      expect(within(slots()).getByLabelText('LEAP')).toHaveAttribute('data-found', 'true');
      expect(foundLine()).toHaveTextContent('1 of 12 found');
      expect(wordRow()).toHaveAccessibleName('Your word: empty');
      expect(polite().textContent?.trim()).toBe('LEAP. 1 of 12 found. 11 words left.');
    });

    it('a real word that is not in the slots is a bonus word, and does not fill a slot', async () => {
      const { user } = await openHunt();

      await submitWords(user, 'PEAL');

      expect(screen.getByText('PEAL')).toBeInTheDocument();
      expect(screen.getByText(/Bonus words \(1\)/)).toBeInTheDocument();
      expect(foundLine()).toHaveTextContent('0 of 12 found');
      expect(polite().textContent?.trim()).toBe('PEAL is a bonus word. 1 bonus word.');
    });

    it('says "bonus words" for more than one', async () => {
      const { user } = await openHunt();

      await submitWords(user, 'PEAL', 'PLEA');

      expect(polite().textContent?.trim()).toBe('PLEA is a bonus word. 2 bonus words.');
    });

    it('rejects a short word, a non-word and a repeat with the exact toast, and keeps the letters', async () => {
      const { user } = await openHunt();

      await user.keyboard('LEA{Enter}');
      expect(await screen.findByRole('alert')).toHaveTextContent('Not enough letters');
      await user.keyboard('{Backspace}{Backspace}{Backspace}');

      await user.keyboard('ELAP{Enter}');
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Not in word list');
      });
      await user.keyboard('{Backspace}{Backspace}{Backspace}{Backspace}');

      await submitWords(user, 'LEAP');
      await user.keyboard('LEAP{Enter}');
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Already found');
      });
      expect(wordRow()).toHaveAccessibleName('Your word: LEAP');
      expect(within(slots()).getByText('4 letters · 1 of 8')).toBeInTheDocument();
    });

    it('rejects a repeated bonus word too', async () => {
      const { user } = await openHunt();
      await submitWords(user, 'PEAL');

      await user.keyboard('PEAL{Enter}');

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Already found');
      });
    });

    it('keeps errors in the assertive region, not the polite one (A11Y-4)', async () => {
      const { user } = await openHunt();

      await user.keyboard('LEA{Enter}');

      expect(await screen.findByRole('alert')).toBeInTheDocument();
      expect(polite().textContent?.trim()).toBe('');
    });

    it('Submit and Backspace buttons work like the keys', async () => {
      const { user } = await openHunt();
      await user.keyboard('LEAPS');

      await user.click(screen.getByRole('button', { name: 'Backspace' }));
      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(within(slots()).getByLabelText('LEAP')).toBeInTheDocument();
    });
  });

  describe('reshuffling (FR-163)', () => {
    it('reorders the tray and keeps its letters, and keeps typed letters', async () => {
      const { user } = await openHunt();
      const before = trayLetters().join('');
      await user.keyboard('L');

      await user.click(screen.getByRole('button', { name: 'Reshuffle' }));

      const after = trayLetters().join('');
      expect(after).not.toBe(before);
      expect([...after].sort().join('')).toBe([...before].sort().join(''));
      expect(wordRow()).toHaveAccessibleName('Your word: L');
    });
  });

  describe('finishing (FR-163, AC-55)', () => {
    it('finding every word wins, with the counts and bonus words in the result', async () => {
      const { user } = await openHunt();

      await submitWords(user, HUNT_BONUS[0], ...HUNT_REQUIRED);

      const panel = await screen.findByRole('region', { name: 'Every word found!' });
      expect(panel).toHaveTextContent('12 of 12 words');
      expect(panel).toHaveTextContent('1 bonus word');
      expect(polite().textContent?.trim()).toBe('You found all 12 words and 1 bonus word.');
      expect(screen.queryByRole('group', { name: 'Letter tray' })).not.toBeInTheDocument();
    });

    it('says nothing about bonus words in the announcement when there are none', async () => {
      const { user } = await openHunt();

      await submitWords(user, ...HUNT_REQUIRED);

      await screen.findByRole('heading', { name: 'Every word found!' });
      expect(polite().textContent?.trim()).toBe('You found all 12 words.');
    });

    it('does not start a new puzzle on the Enter that won, and does on the next (AC-55)', async () => {
      const { user } = await openHunt();
      await submitWords(user, ...HUNT_REQUIRED);
      await screen.findByRole('heading', { name: 'Every word found!' });

      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(
          screen.queryByRole('heading', { name: 'Every word found!' }),
        ).not.toBeInTheDocument();
      });
      expect(foundLine()).toHaveTextContent('0 of 12 found');
    });

    it('Give up asks first, then shows the missed words on the board and in the result', async () => {
      const { user } = await openHunt();
      await submitWords(user, 'LEAP', 'PALE');

      await user.click(screen.getByRole('button', { name: 'Give up' }));
      const dialog = await screen.findByRole('alertdialog', { name: 'Give up?' });
      await user.click(within(dialog).getByRole('button', { name: 'Give up' }));

      const panel = await screen.findByRole('region', { name: 'Gave up' });
      expect(panel).toHaveTextContent('2 of 12 words');
      expect(within(panel).getByText('Words you missed')).toBeInTheDocument();
      expect(within(panel).getAllByRole('listitem')).toHaveLength(10);
      expect(within(slots()).getByLabelText('TAPE, missed')).toBeInTheDocument();
      expect(within(slots()).getByLabelText('LEAP')).toBeInTheDocument();
      expect(polite().textContent?.trim()).toBe('You gave up with 2 of 12 words found.');
    });

    it('Cancel on the give up dialog keeps the puzzle going', async () => {
      const { user } = await openHunt();

      await user.click(screen.getByRole('button', { name: 'Give up' }));
      await user.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }),
      );

      expect(screen.queryByRole('heading', { name: 'Gave up' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Give up' })).toBeEnabled();
    });
  });

  describe('a new puzzle (FR-164)', () => {
    it('does not ask with no progress', async () => {
      const { user } = await openHunt();

      await user.click(screen.getByRole('button', { name: 'New puzzle' }));

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('asks after progress; Cancel keeps the puzzle and the abandoned puzzle is not recorded', async () => {
      const { user } = await openHunt();
      await submitWords(user, 'LEAP');

      await user.click(screen.getByRole('button', { name: 'New puzzle' }));
      await user.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }),
      );
      expect(within(slots()).getByLabelText('LEAP')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'New puzzle' }));
      await user.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', {
          name: 'New puzzle',
        }),
      );

      await waitFor(() => {
        expect(foundLine()).toHaveTextContent('0 of 12 found');
      });
      expect(localStorage.getItem(gameKeys('hunt').stats)).toBeNull();
    });

    it('asks when only a letter has been typed', async () => {
      const { user } = await openHunt();
      await user.keyboard('L');

      await user.click(screen.getByRole('button', { name: 'New puzzle' }));

      expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    });
  });

  describe('leaving and returning (FR-65, FR-164, EC-24)', () => {
    async function leaveAndReturn(user: User): Promise<void> {
      await user.click(screen.getByRole('link', { name: 'All games' }));
      await screen.findByRole('link', { name: 'Play WordHunt' });
      await user.click(screen.getByRole('link', { name: 'Play WordHunt' }));
      await screen.findByRole('group', { name: 'Words to find' });
    }

    it('restores the tray, the found and bonus words and the typed letters', async () => {
      const { user } = await openHunt();
      const tray = trayLetters().join('');
      await submitWords(user, 'LEAP', 'PEAL');
      await user.keyboard('SE');

      await leaveAndReturn(user);

      expect(trayLetters().join('')).toBe(tray);
      expect(within(slots()).getByLabelText('LEAP')).toBeInTheDocument();
      expect(screen.getByText(/Bonus words \(1\)/)).toBeInTheDocument();
      expect(wordRow()).toHaveAccessibleName('Your word: SE');
    });

    it('restores a finished puzzle with its result', async () => {
      const { user } = await openHunt();
      await submitWords(user, ...HUNT_REQUIRED);
      await screen.findByRole('heading', { name: 'Every word found!' });

      await leaveAndReturn(user);

      expect(screen.getByRole('heading', { name: 'Every word found!' })).toBeInTheDocument();
    });

    it('restores a saved puzzle with its own words, whatever the lists now hold', async () => {
      localStorage.setItem(
        gameKeys('hunt').session,
        JSON.stringify({
          id: 'old',
          seed: 'CARPET',
          tray: 'TERCAP',
          required: ['PACT', 'CARE', 'CARPET'],
          found: ['CARE'],
          bonus: [],
          currentInput: '',
          status: 'playing',
          startedAt: 1,
          finishedAt: null,
        }),
      );

      await openHunt();

      expect(trayLetters().join('')).toBe('TERCAP');
      expect(foundLine()).toHaveTextContent('1 of 3 found');
      expect(within(slots()).getByLabelText('CARE')).toBeInTheDocument();
    });

    it('ignores a saved puzzle that is corrupt and starts a new one', async () => {
      localStorage.setItem(gameKeys('hunt').session, JSON.stringify({ id: 'x', seed: 'nope' }));

      await openHunt();

      expect([...trayLetters()].sort().join('')).toBe('AELPST');
      expect(foundLine()).toHaveTextContent('0 of 12 found');
    });
  });

  describe('help and statistics (T-98: FR-165, FR-166, US-40, AC-56)', () => {
    it('never opens the help dialog by itself (ADR-020)', async () => {
      await openHunt();

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('opens How to play, with the tray, the bonus words and the clock', async () => {
      const { user } = await openHunt();

      await user.click(screen.getByRole('button', { name: 'How to play' }));

      const dialog = await screen.findByRole('dialog', { name: 'How to play' });
      expect(dialog).toHaveTextContent('Six letters sit in the tray');
      expect(dialog).toHaveTextContent('bonus word');
      expect(dialog).toHaveTextContent('clock');
      expect(dialog).toHaveTextContent('PLATES');
    });

    it('records a completed puzzle once, with its words and bonus words', async () => {
      const { user } = await openHunt();
      await submitWords(user, 'PEAL', ...HUNT_REQUIRED);
      await screen.findByRole('heading', { name: 'Every word found!' });

      await user.click(screen.getByRole('button', { name: 'Statistics' }));
      const dialog = await screen.findByRole('dialog', { name: 'Statistics' });

      expect(within(dialog).getByText('Played').closest('div')).toHaveTextContent('1');
      expect(within(dialog).getByText('Done %').closest('div')).toHaveTextContent('100%');
      expect(within(dialog).getByText('Words found').closest('div')).toHaveTextContent('100%');
      expect(within(dialog).getByText('Bonus words').closest('div')).toHaveTextContent('1');
      expect(dialog).toHaveTextContent('STAPLE');
      const stored = JSON.parse(localStorage.getItem(gameKeys('hunt').stats) ?? '{}') as {
        overall: { gamesPlayed: number; totalFound: number; totalBonus: number };
      };
      expect(stored.overall).toMatchObject({ gamesPlayed: 1, totalFound: 12, totalBonus: 1 });
    });

    it('records a give up as not completed, and ends the streak', async () => {
      const { user } = await openHunt();
      await submitWords(user, 'LEAP');
      await user.click(screen.getByRole('button', { name: 'Give up' }));
      await user.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Give up' }),
      );
      await screen.findByRole('heading', { name: 'Gave up' });

      await user.click(screen.getByRole('button', { name: 'Statistics' }));
      const dialog = await screen.findByRole('dialog', { name: 'Statistics' });

      expect(within(dialog).getByText('Done %').closest('div')).toHaveTextContent('0%');
      expect(within(dialog).getByText('Words found').closest('div')).toHaveTextContent('8%');
      expect(dialog).toHaveTextContent('1 of 12 · gave up');
    });

    it("resets only WordHunt statistics, leaving other games' keys untouched (AC-56)", async () => {
      localStorage.setItem(gameKeys('wordwright').stats, '{"marker":"wordwright"}');
      localStorage.setItem(gameKeys('code').stats, '{"marker":"code"}');
      const { user } = await openHunt();
      await submitWords(user, ...HUNT_REQUIRED);
      await screen.findByRole('heading', { name: 'Every word found!' });

      await user.click(screen.getByRole('button', { name: 'Statistics' }));
      const dialog = await screen.findByRole('dialog', { name: 'Statistics' });
      await user.click(within(dialog).getByRole('button', { name: 'Reset statistics' }));
      await user.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
      );

      await waitFor(() => {
        expect(within(dialog).getByText(/No puzzles yet/)).toBeInTheDocument();
      });
      expect(localStorage.getItem(gameKeys('wordwright').stats)).toBe('{"marker":"wordwright"}');
      expect(localStorage.getItem(gameKeys('code').stats)).toBe('{"marker":"code"}');
    });
  });
});
