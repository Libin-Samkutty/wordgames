import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '@/App';
import { resetDictionaryCache } from '@/dictionary';
import { gameKeys } from '@/storage';

import { FIRST_SCRAMBLE, useShuffleFixtures } from './shuffleFixtures';

/**
 * WordShuffle end to end through the real providers (T-89 … T-91: FR-137 …
 * FR-147, US-37, US-38, AC-45, AC-53, AC-54, AC-55, AC-56, A11Y-24, EC-46,
 * EC-47, EC-48).
 *
 * With the fixture lists the target is LAMB at length 4, PLANT at 5 and LISTEN
 * at 6, and the scramble is the first ordering in alphabetical order.
 */

type User = ReturnType<typeof userEvent.setup>;

function seed(length: 4 | 5 | 6 = 5): void {
  localStorage.setItem(
    'wordgames:v1:settings',
    JSON.stringify({ theme: 'system', colorblind: false, motion: 'reduced' }),
  );
  localStorage.setItem(gameKeys('shuffle').prefs, JSON.stringify({ defaultWordLength: length }));
}

async function openShuffle(): Promise<{ user: User }> {
  window.history.replaceState(null, '', '/#/shuffle');
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('group', { name: /^Your answer/ });
  await screen.findByRole('group', { name: 'Letter tray' });
  return { user };
}

const answerGroup = (): HTMLElement => screen.getByRole('group', { name: /^Your answer/ });
const answerText = (): string => answerGroup().getAttribute('aria-label') ?? '';
const tray = (): HTMLElement => screen.getByRole('group', { name: 'Letter tray' });
const trayLetters = (): string[] =>
  within(tray())
    .queryAllByRole('button')
    .map((button) => (button.getAttribute('aria-label') ?? '').charAt(0));

async function typeWord(user: User, word: string): Promise<void> {
  await user.keyboard(word);
}

describe('WordShuffle', () => {
  beforeEach(() => {
    resetDictionaryCache();
    localStorage.clear();
    seed();
    useShuffleFixtures();
  });

  afterEach(() => {
    resetDictionaryCache();
    vi.restoreAllMocks();
  });

  describe('the screen (FR-137, FR-138, FR-139)', () => {
    it('opens with the right title, an empty answer row and the scramble in the tray (AC-45)', async () => {
      await openShuffle();

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('WordShuffle');
      expect(document.title).toBe('WordShuffle · WordGames');
      expect(answerText()).toBe('Your answer: empty, empty, empty, empty, empty');
      expect(trayLetters().join('')).toBe(FIRST_SCRAMBLE[5]);
    });

    it('defaults to 5 letters and offers 4, 5 and 6 as a radio group (FR-137)', async () => {
      localStorage.removeItem(gameKeys('shuffle').prefs);
      await openShuffle();

      expect(screen.getByRole('radio', { name: /^5/ })).toBeChecked();
      expect(screen.getAllByRole('radio')).toHaveLength(3);
    });

    it('labels each tray button with its letter and how many are left (A11Y-24)', async () => {
      seed(6);
      await openShuffle();

      const labels = within(tray())
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label'));
      expect(labels).toEqual([
        'E, 1 left',
        'I, 1 left',
        'L, 1 left',
        'N, 1 left',
        'S, 1 left',
        'T, 1 left',
      ]);
    });

    it('has no on-screen QWERTY keyboard and no timer', async () => {
      await openShuffle();

      expect(screen.queryByLabelText('Keyboard')).not.toBeInTheDocument();
      expect(screen.queryByText(/\d:\d\d/)).not.toBeInTheDocument();
    });
  });

  describe('building an answer (FR-139, EC-46)', () => {
    it('typing builds the answer and empties the tray', async () => {
      const { user } = await openShuffle();

      await typeWord(user, 'PLANT');

      expect(answerText()).toBe('Your answer: P, L, A, N, T');
      expect(trayLetters()).toEqual([]);
      expect(within(tray()).getByText('All letters used')).toBeInTheDocument();
    });

    it('tapping tray letters builds the same answer', async () => {
      const { user } = await openShuffle();

      for (const letter of 'PLANT') {
        await user.click(within(tray()).getByRole('button', { name: new RegExp(`^${letter}, `) }));
      }

      expect(answerText()).toBe('Your answer: P, L, A, N, T');
      expect(trayLetters()).toEqual([]);
    });

    it('ignores a letter that is not left in the tray, with no toast (EC-46)', async () => {
      const { user } = await openShuffle();

      await typeWord(user, 'ZQ');
      await typeWord(user, 'PP');

      expect(answerText()).toBe('Your answer: P, empty, empty, empty, empty');
      // The toast region is always there; nothing was said in it.
      expect(screen.getByRole('alert')).toBeEmptyDOMElement();
    });

    it('Backspace returns the last letter to the tray, by key and by button', async () => {
      const { user } = await openShuffle();
      await typeWord(user, 'PLA');

      await user.keyboard('{Backspace}');
      expect(answerText()).toBe('Your answer: P, L, empty, empty, empty');
      expect(trayLetters()).toContain('A');

      await user.click(screen.getByRole('button', { name: 'Backspace' }));
      expect(answerText()).toBe('Your answer: P, empty, empty, empty, empty');
    });
  });

  describe('submitting (FR-140, FR-141, AC-53, EC-47)', () => {
    it('a full row of the target solves, with the result panel', async () => {
      const { user } = await openShuffle();

      await typeWord(user, 'PLANT');
      await user.keyboard('{Enter}');

      const panel = await screen.findByRole('region', { name: 'Solved!' });
      expect(panel).toHaveTextContent('PLANT');
      expect(panel).toHaveTextContent('No hints used');
      expect(within(panel).getByText('No other word uses these letters.')).toBeInTheDocument();
    });

    it('a different anagram solves, and the result lists the others (AC-53, EC-47)', async () => {
      seed(6);
      const { user } = await openShuffle();

      await typeWord(user, 'SILENT');
      await user.click(screen.getByRole('button', { name: 'Submit' }));

      const panel = await screen.findByRole('region', { name: 'Solved!' });
      expect(panel).toHaveTextContent('SILENT');
      const others = within(panel)
        .getAllByRole('listitem')
        .map((item) => item.textContent);
      expect(others).toEqual(['ENLIST', 'INLETS', 'LISTEN', 'TINSEL']);
    });

    it('a partial row says "Not enough letters" and costs nothing', async () => {
      const { user } = await openShuffle();
      await typeWord(user, 'PLA');

      await user.keyboard('{Enter}');

      expect(await screen.findByRole('alert')).toHaveTextContent('Not enough letters');
      expect(answerText()).toBe('Your answer: P, L, A, empty, empty');
    });

    it('a full row that is not a word says "Not in word list" and keeps the row', async () => {
      const { user } = await openShuffle();
      await typeWord(user, 'ALNPT');

      await user.keyboard('{Enter}');

      expect(await screen.findByRole('alert')).toHaveTextContent('Not in word list');
      expect(answerText()).toBe('Your answer: A, L, N, P, T');
      expect(screen.queryByRole('region', { name: 'Solved!' })).not.toBeInTheDocument();
    });

    it('locks input once solved', async () => {
      const { user } = await openShuffle();
      await typeWord(user, 'PLANT');
      await user.keyboard('{Enter}');
      await screen.findByRole('heading', { name: 'Solved!' });

      await user.keyboard('S');

      expect(answerText()).toBe('Your answer: P, L, A, N, T');
    });

    it('does not start a new puzzle on the Enter that solved, and does on the next (AC-55)', async () => {
      const { user } = await openShuffle();
      await typeWord(user, 'PLANT');
      await user.keyboard('{Enter}');
      await screen.findByRole('heading', { name: 'Solved!' });

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(screen.getByRole('heading', { name: 'Solved!' })).toBeInTheDocument();

      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'Solved!' })).not.toBeInTheDocument();
      });
      expect(answerText()).toBe('Your answer: empty, empty, empty, empty, empty');
    });
  });

  describe('hints (FR-142, AC-54, EC-48)', () => {
    it('fixes the first letter of the target in place and takes it from the tray', async () => {
      const { user } = await openShuffle();

      await user.click(screen.getByRole('button', { name: 'Hint, 2 left' }));

      expect(answerText()).toBe('Your answer: P (hinted), empty, empty, empty, empty');
      expect(trayLetters()).not.toContain('P');
      expect(screen.getByRole('button', { name: 'Hint, 1 left' })).toBeInTheDocument();
    });

    it('a second hint fixes the next letter, and the third is not offered', async () => {
      const { user } = await openShuffle();

      await user.click(screen.getByRole('button', { name: 'Hint, 2 left' }));
      await user.click(screen.getByRole('button', { name: 'Hint, 1 left' }));

      expect(answerText()).toBe('Your answer: P (hinted), L (hinted), empty, empty, empty');
      expect(screen.getByRole('button', { name: 'Hint, 0 left' })).toBeDisabled();
    });

    it('typing skips a locked letter and Backspace never removes one', async () => {
      const { user } = await openShuffle();
      await user.click(screen.getByRole('button', { name: 'Hint, 2 left' }));

      await typeWord(user, 'LA');
      expect(answerText()).toBe('Your answer: P (hinted), L, A, empty, empty');

      await user.keyboard('{Backspace}{Backspace}{Backspace}{Backspace}');
      expect(answerText()).toBe('Your answer: P (hinted), empty, empty, empty, empty');
    });

    it('takes back typed letters first, so the hinted letter never collides', async () => {
      const { user } = await openShuffle();
      await typeWord(user, 'PLA');

      await user.click(screen.getByRole('button', { name: 'Hint, 2 left' }));

      expect(answerText()).toBe('Your answer: P (hinted), empty, empty, empty, empty');
      expect(trayLetters().sort().join('')).toBe('ALNT');
    });

    it('an anagram that keeps the hinted letters in place solves', async () => {
      seed(6);
      const { user } = await openShuffle();
      await user.click(screen.getByRole('button', { name: 'Hint, 2 left' }));

      await typeWord(user, 'ISTEN');
      await user.keyboard('{Enter}');

      const panel = await screen.findByRole('region', { name: 'Solved!' });
      expect(panel).toHaveTextContent('1 hint used');
    });
  });

  describe('reshuffle (FR-143)', () => {
    it('reorders only the letters left in the tray, as often as asked', async () => {
      seed(6);
      const { user } = await openShuffle();
      await typeWord(user, 'S');
      const before = trayLetters().sort().join('');

      for (let i = 0; i < 3; i += 1) {
        await user.click(screen.getByRole('button', { name: 'Reshuffle' }));
        expect(trayLetters().sort().join('')).toBe(before);
      }

      expect(answerText()).toBe('Your answer: S, empty, empty, empty, empty, empty');
      expect(screen.getByRole('button', { name: 'Hint, 2 left' })).toBeInTheDocument();
    });
  });

  describe('giving up (FR-144)', () => {
    it('asks first; Cancel keeps the puzzle and Give up shows the word and every anagram', async () => {
      seed(6);
      const { user } = await openShuffle();

      await user.click(screen.getByRole('button', { name: 'Give up' }));
      const dialog = await screen.findByRole('alertdialog');
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('region', { name: 'Gave up' })).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Give up' }));
      await user.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Give up' }),
      );

      const panel = await screen.findByRole('region', { name: 'Gave up' });
      expect(panel).toHaveTextContent('LISTEN');
      expect(
        within(panel)
          .getAllByRole('listitem')
          .map((item) => item.textContent),
      ).toEqual(['ENLIST', 'INLETS', 'SILENT', 'TINSEL']);
    });

    it('asks even with nothing typed', async () => {
      const { user } = await openShuffle();

      await user.click(screen.getByRole('button', { name: 'Give up' }));

      expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    });
  });

  describe('restarting and switching length (FR-147)', () => {
    it('does not ask with nothing in the row', async () => {
      const { user } = await openShuffle();

      await user.click(screen.getByRole('radio', { name: /^4/ }));

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByRole('radio', { name: /^4/ })).toBeChecked();
      });
      await waitFor(() => {
        expect(trayLetters().join('')).toBe(FIRST_SCRAMBLE[4]);
      });
    });

    it('asks after input; Cancel keeps the puzzle and Switch changes the length', async () => {
      const { user } = await openShuffle();
      await typeWord(user, 'PL');

      await user.click(screen.getByRole('radio', { name: /^4/ }));
      await user.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }),
      );
      expect(screen.getByRole('radio', { name: /^5/ })).toBeChecked();
      expect(answerText()).toBe('Your answer: P, L, empty, empty, empty');

      await user.click(screen.getByRole('radio', { name: /^4/ }));
      await user.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Switch' }),
      );

      await waitFor(() => {
        expect(screen.getByRole('radio', { name: /^4/ })).toBeChecked();
      });
    });

    it('a hint counts as input, and an abandoned puzzle is not recorded', async () => {
      const { user } = await openShuffle();
      await user.click(screen.getByRole('button', { name: 'Hint, 2 left' }));

      await user.click(screen.getByRole('button', { name: 'New puzzle' }));
      await user.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'New puzzle' }),
      );

      await waitFor(() => {
        expect(answerText()).toBe('Your answer: empty, empty, empty, empty, empty');
      });
      expect(localStorage.getItem(gameKeys('shuffle').stats)).toBeNull();
    });

    it('Change length on the result starts a puzzle at the new length without asking', async () => {
      const { user } = await openShuffle();
      await typeWord(user, 'PLANT');
      await user.keyboard('{Enter}');
      await screen.findByRole('heading', { name: 'Solved!' });

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
    });
  });

  describe('leaving and returning (FR-65, FR-147, EC-24)', () => {
    async function leaveAndReturn(user: User): Promise<void> {
      await user.click(screen.getByRole('link', { name: 'All games' }));
      await screen.findByRole('link', { name: 'Play WordShuffle' });
      await user.click(screen.getByRole('link', { name: 'Play WordShuffle' }));
      await screen.findByRole('group', { name: /^Your answer/ });
    }

    it('restores the tray, the answer row and the hints exactly', async () => {
      seed(6);
      const { user } = await openShuffle();
      await user.click(screen.getByRole('button', { name: 'Hint, 2 left' }));
      await typeWord(user, 'ST');
      await user.click(screen.getByRole('button', { name: 'Reshuffle' }));
      const before = { answer: answerText(), tray: trayLetters() };

      await leaveAndReturn(user);

      expect(answerText()).toBe(before.answer);
      expect(trayLetters()).toEqual(before.tray);
      expect(screen.getByRole('button', { name: 'Hint, 1 left' })).toBeInTheDocument();
    });

    it('discards a saved puzzle whose target has left the list and starts a new one', async () => {
      const { user } = await openShuffle();
      await typeWord(user, 'PL');
      await user.click(screen.getByRole('link', { name: 'All games' }));
      await screen.findByRole('link', { name: 'Play WordShuffle' });

      const saved = JSON.parse(localStorage.getItem(gameKeys('shuffle').session) ?? 'null') as {
        target: string;
        scramble: string;
      };
      saved.target = 'ZEBRA';
      saved.scramble = 'ZEBRA';
      localStorage.setItem(gameKeys('shuffle').session, JSON.stringify(saved));

      await user.click(screen.getByRole('link', { name: 'Play WordShuffle' }));
      await screen.findByRole('group', { name: /^Your answer/ });

      await waitFor(() => {
        expect(answerText()).toBe('Your answer: empty, empty, empty, empty, empty');
      });
    });

    it('ignores a saved puzzle of the other length', async () => {
      const { user } = await openShuffle();
      await typeWord(user, 'PL');
      await user.click(screen.getByRole('link', { name: 'All games' }));
      await screen.findByRole('link', { name: 'Play WordShuffle' });
      localStorage.setItem(gameKeys('shuffle').prefs, JSON.stringify({ defaultWordLength: 4 }));

      await user.click(screen.getByRole('link', { name: 'Play WordShuffle' }));

      await screen.findByRole('group', { name: /^Your answer/ });
      expect(screen.getByRole('radio', { name: /^4/ })).toBeChecked();
      expect(answerText()).toBe('Your answer: empty, empty, empty, empty');
    });
  });

  describe('announcements (T-91: A11Y-24)', () => {
    function polite(): HTMLElement {
      return within(screen.getByRole('main')).getByRole('status');
    }

    it('announces each hint with the letter, its place and the hints left', async () => {
      const { user } = await openShuffle();

      await user.click(screen.getByRole('button', { name: 'Hint, 2 left' }));
      expect(polite().textContent?.trim()).toBe('Hint: letter 1 is P. 1 hint left.');

      await user.click(screen.getByRole('button', { name: 'Hint, 1 left' }));
      expect(polite().textContent?.trim()).toBe('Hint: letter 2 is L. No hints left.');
    });

    it('announces a reshuffle with the new order', async () => {
      const { user } = await openShuffle();

      await user.click(screen.getByRole('button', { name: 'Reshuffle' }));

      expect(polite().textContent?.trim()).toMatch(/^Letters reshuffled: [A-Z](, [A-Z]){4}\.$/);
    });

    it('announces a solve with the word and the hints used', async () => {
      const { user } = await openShuffle();
      await user.click(screen.getByRole('button', { name: 'Hint, 2 left' }));
      await typeWord(user, 'LANT');
      await user.keyboard('{Enter}');
      await screen.findByRole('heading', { name: 'Solved!' });

      expect(polite().textContent?.trim()).toBe('Solved with PLANT. 1 hint used.');
    });

    it('announces a give up with the word', async () => {
      const { user } = await openShuffle();

      await user.click(screen.getByRole('button', { name: 'Give up' }));
      await user.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Give up' }),
      );
      await screen.findByRole('heading', { name: 'Gave up' });

      expect(polite().textContent?.trim()).toBe('Gave up. The word was PLANT.');
    });

    it('keeps errors in the assertive region, not the polite one (A11Y-4)', async () => {
      const { user } = await openShuffle();
      await typeWord(user, 'ALNPT');

      await user.keyboard('{Enter}');

      expect(await screen.findByRole('alert')).toHaveTextContent('Not in word list');
      expect(polite().textContent?.trim()).toBe('');
    });
  });

  describe('help and statistics (T-91: FR-146, FR-147, US-38, AC-56)', () => {
    it('never opens the help dialog by itself (ADR-020)', async () => {
      await openShuffle();

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('opens How to play from the header', async () => {
      const { user } = await openShuffle();

      await user.click(screen.getByRole('button', { name: 'How to play' }));

      const dialog = await screen.findByRole('dialog', { name: 'How to play' });
      expect(dialog).toHaveTextContent('Any real word');
      expect(dialog).toHaveTextContent('Reshuffle');
    });

    it('records a solve once, with its hints, overall and for its length', async () => {
      const { user } = await openShuffle();
      await user.click(screen.getByRole('button', { name: 'Hint, 2 left' }));
      await typeWord(user, 'LANT');
      await user.keyboard('{Enter}');
      await screen.findByRole('heading', { name: 'Solved!' });

      await user.click(screen.getByRole('button', { name: 'Statistics' }));
      const dialog = await screen.findByRole('dialog', { name: 'Statistics' });

      expect(within(dialog).getByText('Played').closest('div')).toHaveTextContent('1');
      expect(within(dialog).getByText('Hints per solve').closest('div')).toHaveTextContent('1.0');
      const stored = JSON.parse(localStorage.getItem(gameKeys('shuffle').stats) ?? '{}') as {
        perLength: Record<string, { gamesSolved: number; totalHintsOnSolves: number }>;
      };
      expect(stored.perLength['5']).toMatchObject({ gamesSolved: 1, totalHintsOnSolves: 1 });
      expect(stored.perLength['4']?.gamesSolved).toBe(0);
    });

    it('a give up is played but not solved, and resets the streak', async () => {
      const { user } = await openShuffle();
      await typeWord(user, 'PLANT');
      await user.keyboard('{Enter}');
      await screen.findByRole('heading', { name: 'Solved!' });
      await user.keyboard('{Enter}');
      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'Solved!' })).not.toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Give up' }));
      await user.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Give up' }),
      );
      await screen.findByRole('heading', { name: 'Gave up' });

      const stored = JSON.parse(localStorage.getItem(gameKeys('shuffle').stats) ?? '{}') as {
        overall: {
          gamesPlayed: number;
          gamesSolved: number;
          currentStreak: number;
          bestStreak: number;
        };
      };
      expect(stored.overall).toMatchObject({
        gamesPlayed: 2,
        gamesSolved: 1,
        currentStreak: 0,
        bestStreak: 1,
      });
    });

    it("resets only WordShuffle statistics, leaving other games' keys untouched (AC-56)", async () => {
      localStorage.setItem(gameKeys('wordwright').stats, '{"marker":"wordwright"}');
      localStorage.setItem(gameKeys('code').stats, '{"marker":"code"}');
      const { user } = await openShuffle();
      await typeWord(user, 'PLANT');
      await user.keyboard('{Enter}');
      await screen.findByRole('heading', { name: 'Solved!' });

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
