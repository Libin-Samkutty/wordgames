import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '@/App';
import { resetDictionaryCache } from '@/dictionary';
import { gameKeys } from '@/storage';

import { WINNING_FIVE, useDodgeFixtures, useDodgeShuffle } from './dodgeFixtures';

/**
 * WordDodge end to end through the real providers (T-93, T-94: FR-148 to
 * FR-157, US-39, AC-45, AC-55, AC-56, AC-58, A11Y-25).
 *
 * With the fixture lists, PLANK keeps three words, and PLANK, PLANT, PLANE,
 * PLANS wins at length 5.
 */

type User = ReturnType<typeof userEvent.setup>;

function seed(length: 4 | 5 | 6 = 5): void {
  localStorage.setItem(
    'wordgames:v1:settings',
    JSON.stringify({ theme: 'system', colorblind: false, motion: 'reduced' }),
  );
  localStorage.setItem(gameKeys('dodge').prefs, JSON.stringify({ defaultWordLength: length }));
}

async function openDodge(): Promise<{ user: User }> {
  window.history.replaceState(null, '', '/#/dodge');
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('grid', { name: 'Guess board' });
  await screen.findByRole('button', { name: 'Enter' });
  return { user };
}

/** Types each word and waits for its reveal to finish, so the next one is accepted. */
async function guess(user: User, ...words: string[]): Promise<void> {
  for (const word of words) {
    await user.keyboard(`${word}{Enter}`);
    await waitFor(() => {
      // The reveal is over once input is open again, or the game has ended.
      const ended = screen.queryByRole('region', { name: /cornered|Gave up/ }) !== null;
      const open = !screen.getByRole('button', { name: 'Enter' }).hasAttribute('disabled');
      expect(ended || open).toBe(true);
    });
  }
}

function rows(): HTMLElement[] {
  return within(screen.getByRole('grid', { name: 'Guess board' })).getAllByRole('row');
}

function wordsLeft(): string {
  return screen.getByText('left', { exact: false, selector: 'p' }).textContent ?? '';
}

function polite(): HTMLElement {
  return within(screen.getByRole('main')).getByRole('status');
}

describe('WordDodge', () => {
  beforeEach(() => {
    resetDictionaryCache();
    localStorage.clear();
    seed();
    useDodgeFixtures();
  });

  afterEach(() => {
    resetDictionaryCache();
    vi.restoreAllMocks();
  });

  describe('the screen (FR-148, FR-150)', () => {
    it('opens with the right title, one empty row and every word left (AC-45)', async () => {
      await openDodge();

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('WordDodge');
      expect(document.title).toBe('WordDodge · WordGames');
      expect(rows()).toHaveLength(1);
      expect(wordsLeft()).toBe('5 words left');
      expect(screen.getByRole('button', { name: 'Give up' })).toBeDisabled();
    });

    it('defaults to 5 letters and offers 4, 5 and 6 as a radio group (FR-148)', async () => {
      localStorage.removeItem(gameKeys('dodge').prefs);
      await openDodge();

      expect(screen.getByRole('radio', { name: /^5/ })).toBeChecked();
      expect(screen.getAllByRole('radio').map((radio) => radio.textContent?.trim())).toEqual([
        '4 letters',
        '5 letters',
        '6 letters',
      ]);
    });

    it('shows typed letters in the active row', async () => {
      const { user } = await openDodge();

      await user.keyboard('PL');

      const cells = within(rows()[0] as HTMLElement).getAllByRole('gridcell');
      expect(cells[0]).toHaveAccessibleName('Row 1, letter 1: P, entered');
      expect(cells[1]).toHaveAccessibleName('Row 1, letter 2: L, entered');
      expect(cells[2]).toHaveAccessibleName('Row 1, letter 3: empty, empty');
    });
  });

  describe('the adversary (FR-149, AC-58)', () => {
    it('answers PLANK with the colours that keep three words, and the board grows', async () => {
      const { user } = await openDodge();

      await guess(user, 'PLANK');

      expect(wordsLeft()).toBe('3 words left');
      expect(rows()).toHaveLength(2);
      const cells = within(rows()[0] as HTMLElement).getAllByRole('gridcell');
      expect(cells.map((cell) => cell.getAttribute('aria-label'))).toEqual([
        'Row 1, letter 1: P, correct position',
        'Row 1, letter 2: L, correct position',
        'Row 1, letter 3: A, correct position',
        'Row 1, letter 4: N, correct position',
        'Row 1, letter 5: K, not in word',
      ]);
    });

    it('narrows to one word and wins on the fourth guess (FR-154)', async () => {
      const { user } = await openDodge();

      await guess(user, ...WINNING_FIVE);

      expect(await screen.findByRole('heading', { name: 'You cornered it!' })).toBeInTheDocument();
      expect(
        within(screen.getByRole('region', { name: 'You cornered it!' })).getByText(/4 guesses/),
      ).toBeInTheDocument();
      expect(screen.getByText('PLANS')).toBeInTheDocument();
      expect(wordsLeft()).toBe('1 word left');
    });

    it('wins at length 4', async () => {
      seed(4);
      const four = await openDodge();
      await guess(four.user, 'LAMB', 'PLUM');
      await screen.findByRole('heading', { name: 'You cornered it!' });
    });

    it('wins at length 6', async () => {
      seed(6);
      const six = await openDodge();
      await guess(six.user, 'PLANET', 'SILVER');
      await screen.findByRole('heading', { name: 'You cornered it!' });
    });

    it('colours the keyboard from the replies it gave', async () => {
      const { user } = await openDodge();

      await guess(user, 'PLANK');

      const keyboard = screen.getByLabelText('Keyboard');
      expect(within(keyboard).getByRole('button', { name: /^P/ }).className).toMatch(/correct/);
      expect(within(keyboard).getByRole('button', { name: /^K/ }).className).toMatch(/absent/);
    });
  });

  describe('the pool of words (FR-149, ADR-042)', () => {
    it('starts with the answers and the shuffle list, each word once', async () => {
      // PLANT is in both lists, and CRANE only in the shuffle list.
      useDodgeShuffle(['CRANE', 'PLANT']);
      await openDodge();

      expect(wordsLeft()).toBe('6 words left');
    });

    it('answers a guess from the whole pool, so the shuffle words count too', async () => {
      // PLANK would give all grey to these three, which makes the grey group the largest.
      useDodgeShuffle(['GUEST', 'QUEST', 'QUIET']);
      const { user } = await openDodge();
      expect(wordsLeft()).toBe('8 words left');

      await guess(user, 'PLANK');

      expect(wordsLeft()).toBe('5 words left');
      const cells = within(rows()[0] as HTMLElement).getAllByRole('gridcell');
      expect(cells.every((cell) => /not in word/.test(cell.getAttribute('aria-label') ?? ''))).toBe(
        true,
      );
    });

    it('drops a game saved under the old answers-only rule, which no longer replays', async () => {
      useDodgeShuffle(['GUEST', 'QUEST', 'QUIET']);
      localStorage.setItem(
        gameKeys('dodge').session,
        JSON.stringify({
          id: 'old',
          wordLength: 5,
          guesses: [
            {
              word: 'PLANK',
              evaluation: ['correct', 'correct', 'correct', 'correct', 'absent'],
            },
          ],
          currentInput: '',
          status: 'playing',
          startedAt: 1,
          finishedAt: null,
        }),
      );

      await openDodge();

      expect(rows()).toHaveLength(1);
      expect(wordsLeft()).toBe('8 words left');
    });
  });

  describe('rejected guesses cost nothing (FR-149)', () => {
    it('a word that is not in the list is refused with a toast and no row', async () => {
      const { user } = await openDodge();

      await user.keyboard('ZZZZZ{Enter}');

      expect(await screen.findByRole('alert')).toHaveTextContent('Not in word list');
      expect(rows()).toHaveLength(1);
      expect(wordsLeft()).toBe('5 words left');
    });

    it('a short word is refused with a toast', async () => {
      const { user } = await openDodge();

      await user.keyboard('PL{Enter}');

      expect(await screen.findByRole('alert')).toHaveTextContent('Not enough letters');
    });

    it('allows a repeated guess, which tells nothing new', async () => {
      const { user } = await openDodge();

      await guess(user, 'PLANK', 'PLANK');

      expect(rows()).toHaveLength(3);
      expect(wordsLeft()).toBe('3 words left');
    });
  });

  describe('the result (FR-154, AC-55)', () => {
    it('does not start a new game on the Enter that won, and does on the next', async () => {
      const { user } = await openDodge();
      await guess(user, ...WINNING_FIVE);
      await screen.findByRole('heading', { name: 'You cornered it!' });

      expect(screen.getByRole('grid', { name: 'Guess board' })).toBeInTheDocument();
      expect(rows()).toHaveLength(4);

      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'You cornered it!' })).not.toBeInTheDocument();
      });
      expect(rows()).toHaveLength(1);
      expect(wordsLeft()).toBe('5 words left');
    });

    it('Change length switches length without a confirmation', async () => {
      const { user } = await openDodge();
      await guess(user, ...WINNING_FIVE);
      await screen.findByRole('heading', { name: 'You cornered it!' });

      await user.click(screen.getByRole('button', { name: 'Change length' }));
      await user.click(
        within(screen.getByRole('group', { name: 'New game length' })).getByRole('button', {
          name: '6 letters',
        }),
      );

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByRole('radio', { name: /^6/ })).toBeChecked();
      });
      await screen.findByRole('grid', { name: 'Guess board' });
    });

    it('locks input once the game is over', async () => {
      const { user } = await openDodge();
      await guess(user, ...WINNING_FIVE);
      await screen.findByRole('heading', { name: 'You cornered it!' });

      expect(screen.getByRole('button', { name: 'Enter' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Give up' })).toBeDisabled();
    });
  });

  describe('giving up (FR-152)', () => {
    it('asks first, then shows one of the words left and counts a loss', async () => {
      const { user } = await openDodge();
      await guess(user, 'PLANK');

      await user.click(screen.getByRole('button', { name: 'Give up' }));
      const dialog = await screen.findByRole('alertdialog', { name: 'Give up?' });
      await user.click(within(dialog).getByRole('button', { name: 'Give up' }));

      expect(await screen.findByRole('heading', { name: 'Gave up' })).toBeInTheDocument();
      expect(screen.getByText('PLANE')).toBeInTheDocument();
      expect(screen.getByText('2 other words were still possible.')).toBeInTheDocument();

      const stored = JSON.parse(localStorage.getItem(gameKeys('dodge').stats) ?? '{}') as {
        overall: { gamesPlayed: number; gamesWon: number };
      };
      expect(stored.overall).toMatchObject({ gamesPlayed: 1, gamesWon: 0 });
    });

    it('Cancel keeps the game going', async () => {
      const { user } = await openDodge();
      await guess(user, 'PLANK');

      await user.click(screen.getByRole('button', { name: 'Give up' }));
      await user.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }),
      );

      expect(screen.queryByRole('heading', { name: 'Gave up' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Give up' })).toBeEnabled();
    });
  });

  describe('restarting and switching length (FR-153)', () => {
    it('does not ask with no guesses', async () => {
      const { user } = await openDodge();

      await user.click(screen.getByRole('radio', { name: /^4/ }));

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByRole('radio', { name: /^4/ })).toBeChecked();
      });
    });

    it('asks after a guess; Cancel keeps the game and Switch changes the length', async () => {
      const { user } = await openDodge();
      await guess(user, 'PLANK');

      await user.click(screen.getByRole('radio', { name: /^4/ }));
      const dialog = await screen.findByRole('alertdialog');
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      expect(screen.getByRole('radio', { name: /^5/ })).toBeChecked();
      expect(wordsLeft()).toBe('3 words left');

      await user.click(screen.getByRole('radio', { name: /^4/ }));
      await user.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Switch' }),
      );

      await waitFor(() => {
        expect(screen.getByRole('radio', { name: /^4/ })).toBeChecked();
      });
      await waitFor(() => {
        expect(wordsLeft()).toBe('2 words left');
      });
    });

    it('New game after a guess asks first, and an abandoned game is not recorded', async () => {
      const { user } = await openDodge();
      await guess(user, 'PLANK');

      await user.click(screen.getByRole('button', { name: 'New game' }));
      await user.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'New game' }),
      );

      await waitFor(() => {
        expect(wordsLeft()).toBe('5 words left');
      });
      expect(localStorage.getItem(gameKeys('dodge').stats)).toBeNull();
    });

    it('remembers the length for the next visit', async () => {
      const { user } = await openDodge();

      await user.click(screen.getByRole('radio', { name: /^6/ }));
      await waitFor(() => {
        expect(screen.getByRole('radio', { name: /^6/ })).toBeChecked();
      });

      expect(JSON.parse(localStorage.getItem(gameKeys('dodge').prefs) ?? '{}')).toEqual({
        defaultWordLength: 6,
      });
    });
  });

  describe('leaving and returning (FR-65, FR-153, EC-24)', () => {
    async function leaveAndReturn(user: User): Promise<void> {
      await user.click(screen.getByRole('link', { name: 'All games' }));
      await screen.findByRole('link', { name: 'Play WordDodge' });
    }

    it('restores the rows and the words left, replayed from the guesses, with a typed letter', async () => {
      const { user } = await openDodge();
      await guess(user, 'PLANK');
      await user.keyboard('SL');

      await leaveAndReturn(user);
      const saved = localStorage.getItem(gameKeys('dodge').session) ?? '';
      expect(saved).not.toContain('candidates');

      await user.click(screen.getByRole('link', { name: 'Play WordDodge' }));
      await screen.findByRole('grid', { name: 'Guess board' });

      await waitFor(() => {
        expect(wordsLeft()).toBe('3 words left');
      });
      expect(rows()).toHaveLength(2);
      const typed = within(rows()[1] as HTMLElement).getAllByRole('gridcell');
      expect(typed[0]).toHaveAccessibleName('Row 2, letter 1: S, entered');
      expect(typed[1]).toHaveAccessibleName('Row 2, letter 2: L, entered');
    });

    it('restores a finished game with its result', async () => {
      const { user } = await openDodge();
      await guess(user, ...WINNING_FIVE);
      await screen.findByRole('heading', { name: 'You cornered it!' });

      await leaveAndReturn(user);
      await user.click(screen.getByRole('link', { name: 'Play WordDodge' }));

      expect(await screen.findByRole('heading', { name: 'You cornered it!' })).toBeInTheDocument();
    });

    it('discards a saved game that no longer replays and starts a new one', async () => {
      const { user } = await openDodge();
      await guess(user, 'PLANK');
      await leaveAndReturn(user);

      const saved = JSON.parse(localStorage.getItem(gameKeys('dodge').session) ?? 'null') as {
        guesses: { evaluation: string[] }[];
      };
      // A reply the adversary would never have given for PLANK on these answers.
      saved.guesses[0]!.evaluation = ['absent', 'absent', 'absent', 'absent', 'correct'];
      localStorage.setItem(gameKeys('dodge').session, JSON.stringify(saved));

      await user.click(screen.getByRole('link', { name: 'Play WordDodge' }));
      await screen.findByRole('grid', { name: 'Guess board' });

      await waitFor(() => {
        expect(wordsLeft()).toBe('5 words left');
      });
      expect(rows()).toHaveLength(1);
    });

    it('ignores a saved game of the other length', async () => {
      const { user } = await openDodge();
      await guess(user, 'PLANK');
      await leaveAndReturn(user);
      localStorage.setItem(gameKeys('dodge').prefs, JSON.stringify({ defaultWordLength: 4 }));

      await user.click(screen.getByRole('link', { name: 'Play WordDodge' }));

      await screen.findByRole('grid', { name: 'Guess board' });
      expect(screen.getByRole('radio', { name: /^4/ })).toBeChecked();
      expect(rows()).toHaveLength(1);
    });
  });

  describe('announcements (A11Y-25)', () => {
    it('says what the guess scored and how many words are left, once the reveal is done', async () => {
      const { user } = await openDodge();

      await guess(user, 'PLANK');

      expect(polite().textContent?.trim()).toBe(
        'PLANK: P correct, L correct, A correct, N correct, K not in word. 3 words left.',
      );
    });

    it('uses the singular for one word left', async () => {
      const { user } = await openDodge();

      await guess(user, 'PLANK', 'PLANT', 'PLANE');

      expect(polite().textContent?.trim()).toMatch(/1 word left\.$/);
    });

    it('announces the outcome when the game ends', async () => {
      const { user } = await openDodge();

      await guess(user, ...WINNING_FIVE);
      await screen.findByRole('heading', { name: 'You cornered it!' });

      expect(polite().textContent?.trim()).toBe('You found PLANS in 4 guesses.');
    });

    it('announces a give up with the word shown', async () => {
      const { user } = await openDodge();
      await guess(user, 'PLANK');

      await user.click(screen.getByRole('button', { name: 'Give up' }));
      await user.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Give up' }),
      );
      await screen.findByRole('heading', { name: 'Gave up' });

      expect(polite().textContent?.trim()).toBe('You gave up. The word could have been PLANE.');
    });

    it('keeps errors in the assertive region, not the polite one (A11Y-4)', async () => {
      const { user } = await openDodge();

      await user.keyboard('ZZZZZ{Enter}');

      expect(await screen.findByRole('alert')).toHaveTextContent('Not in word list');
      expect(polite().textContent?.trim()).toBe('');
    });
  });

  describe('help and statistics (T-94: FR-155, FR-156, US-39, AC-56)', () => {
    it('never opens the help dialog by itself (ADR-020)', async () => {
      await openDodge();

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('opens How to play, with an example that follows the selected length', async () => {
      seed(6);
      const { user } = await openDodge();

      await user.click(screen.getByRole('button', { name: 'How to play' }));

      const dialog = await screen.findByRole('dialog', { name: 'How to play' });
      expect(dialog).toHaveTextContent('6-letter word');
      expect(dialog).toHaveTextContent('PLANET');
    });

    it('records a win once, overall and for its length', async () => {
      const { user } = await openDodge();
      await guess(user, ...WINNING_FIVE);
      await screen.findByRole('heading', { name: 'You cornered it!' });

      await user.click(screen.getByRole('button', { name: 'Statistics' }));
      const dialog = await screen.findByRole('dialog', { name: 'Statistics' });

      expect(within(dialog).getByText('Played').closest('div')).toHaveTextContent('1');
      expect(within(dialog).getByText('Win %').closest('div')).toHaveTextContent('100%');
      const stored = JSON.parse(localStorage.getItem(gameKeys('dodge').stats) ?? '{}') as {
        perLength: Record<string, { gamesPlayed: number; fewestGuesses: number | null }>;
      };
      expect(stored.perLength['5']).toMatchObject({ gamesPlayed: 1, fewestGuesses: 4 });
      expect(stored.perLength['4']?.gamesPlayed).toBe(0);
    });

    it('shows a give up as a loss in the recent games', async () => {
      const { user } = await openDodge();
      await guess(user, 'PLANK');
      await user.click(screen.getByRole('button', { name: 'Give up' }));
      await user.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Give up' }),
      );
      await screen.findByRole('heading', { name: 'Gave up' });

      await user.click(screen.getByRole('button', { name: 'Statistics' }));
      const dialog = await screen.findByRole('dialog', { name: 'Statistics' });

      expect(within(dialog).getByText('Win %').closest('div')).toHaveTextContent('0%');
      expect(within(dialog).getByText('Gave up')).toBeInTheDocument();
    });

    it("resets only WordDodge statistics, leaving other games' keys untouched (AC-56)", async () => {
      localStorage.setItem(gameKeys('wordwright').stats, '{"marker":"wordwright"}');
      localStorage.setItem(gameKeys('code').stats, '{"marker":"code"}');
      const { user } = await openDodge();
      await guess(user, ...WINNING_FIVE);
      await screen.findByRole('heading', { name: 'You cornered it!' });

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
