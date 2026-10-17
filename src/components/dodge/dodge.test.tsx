import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { evaluateGuess } from '@/engine';
import { createDodgeGame, dodgeReducer, type DodgeAction, type DodgeRecord } from '@/engine/dodge';
import { ToastProvider } from '@/state';
import { DodgeStatsProvider } from '@/state/dodge';
import { guessAnnouncement, outcomeAnnouncement } from '@/state/dodge/announcements';
import {
  createDodgeStatsRepository,
  defaultDodgeStats,
  recordDodgeGame,
  type DodgeStatsState,
} from '@/storage';

import { DodgeHelpModal } from './DodgeHelpModal';
import { DodgeResultPanel } from './DodgeResultPanel';
import { DodgeStatsModal } from './DodgeStatsModal';
import { dodgeHelpExample } from './helpExample';

/** WordDodge panels and dialogs in isolation (T-94). */

const ANSWERS = ['MUSIC', 'PLANE', 'PLANS', 'PLANT', 'STORM'];
const submit = (word: string): DodgeAction => ({ type: 'SUBMIT_GUESS', word, now: 1 });
const reveal: DodgeAction = { type: 'REVEAL_COMPLETE', now: 2 };

function played(...words: string[]) {
  return words.reduce(
    (state, word) => dodgeReducer(dodgeReducer(state, submit(word)), reveal),
    createDodgeGame('g', 5, ANSWERS),
  );
}

describe('DodgeResultPanel (FR-154)', () => {
  const noop = { onPlayAgain: vi.fn(), onChangeLength: vi.fn() };

  it('shows a win, the guesses, the time, the word, Play again and Change length', async () => {
    const onPlayAgain = vi.fn();
    render(
      <DodgeResultPanel
        won
        length={5}
        word="PLANS"
        guessesUsed={4}
        elapsedMs={42_000}
        othersLeft={0}
        onPlayAgain={onPlayAgain}
        onChangeLength={vi.fn()}
      />,
    );

    const panel = screen.getByRole('region', { name: 'You cornered it!' });
    expect(panel).toHaveTextContent('4 guesses · 0:42');
    expect(panel).toHaveTextContent('PLANS');
    expect(panel).not.toHaveTextContent('still possible');
    expect(within(panel).getByRole('button', { name: 'Change length' })).toBeInTheDocument();

    await userEvent.setup().click(within(panel).getByRole('button', { name: 'Play again' }));
    expect(onPlayAgain).toHaveBeenCalledOnce();
  });

  it('uses the singular for one guess, and leaves out a time of 0', () => {
    render(
      <DodgeResultPanel
        won
        length={4}
        word="LAMB"
        guessesUsed={1}
        elapsedMs={0}
        othersLeft={0}
        {...noop}
      />,
    );

    expect(screen.getByRole('region')).toHaveTextContent(/^You cornered it!1 guessThe wordLAMB/);
  });

  it('leaves out the time when the clock never started', () => {
    render(
      <DodgeResultPanel won length={4} word="LAMB" guessesUsed={2} othersLeft={0} {...noop} />,
    );

    expect(screen.getByRole('region')).toHaveTextContent('2 guesses');
    expect(screen.getByRole('region')).not.toHaveTextContent('·');
  });

  it('shows a give up with the word, and how many others were possible', () => {
    render(
      <DodgeResultPanel
        won={false}
        length={5}
        word="PLANE"
        guessesUsed={3}
        othersLeft={2}
        {...noop}
      />,
    );

    const panel = screen.getByRole('region', { name: 'Gave up' });
    expect(panel).toHaveTextContent('It could have been');
    expect(panel).toHaveTextContent('PLANE');
    expect(panel).toHaveTextContent('2 other words were still possible.');
  });

  it('says "word was" for one other, and nothing for none', () => {
    const { rerender } = render(
      <DodgeResultPanel
        won={false}
        length={5}
        word="PLANE"
        guessesUsed={3}
        othersLeft={1}
        {...noop}
      />,
    );
    expect(screen.getByRole('region')).toHaveTextContent('1 other word was still possible.');

    rerender(
      <DodgeResultPanel
        won={false}
        length={5}
        word="PLANE"
        guessesUsed={3}
        othersLeft={0}
        {...noop}
      />,
    );
    expect(screen.getByRole('region')).not.toHaveTextContent('still possible');
  });
});

describe('DodgeHelpModal (FR-156, A11Y-13)', () => {
  it('explains the adversary, the colours, the count and Give up', () => {
    render(<DodgeHelpModal isOpen length={5} onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog', { name: 'How to play' });
    expect(dialog).toHaveTextContent('5-letter word');
    expect(dialog).toHaveTextContent(/has not picked one/);
    expect(dialog).toHaveTextContent(/Green.*yellow.*grey/);
    expect(dialog).toHaveTextContent(/how many words are still possible/);
    expect(dialog).toHaveTextContent(/Give up/);
  });

  it.each([4, 5, 6] as const)(
    'has an example with %i tiles, decorative, with the meaning in text',
    (length) => {
      render(<DodgeHelpModal isOpen length={length} onClose={vi.fn()} />);

      const dialog = screen.getByRole('dialog', { name: 'How to play' });
      const tiles = dialog.querySelectorAll('div[aria-hidden="true"] > span');
      expect(tiles).toHaveLength(length);
      const { word, candidate } = dodgeHelpExample(length);
      expect(dialog).toHaveTextContent(`${word}:`);
      expect(dialog).toHaveTextContent(`Words like ${candidate} would score this way.`);
    },
  );

  it('renders nothing while closed', () => {
    render(<DodgeHelpModal isOpen={false} length={5} onClose={vi.fn()} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it.each([4, 5, 6] as const)('the example at length %i uses the engine colours', (length) => {
    const { word, candidate, evaluation } = dodgeHelpExample(length);

    expect(word).toHaveLength(length);
    expect(candidate).toHaveLength(length);
    expect(evaluation).toEqual(evaluateGuess(word, candidate));
  });
});

describe('announcements (A11Y-25)', () => {
  it('words a guess with the colours and the words left', () => {
    expect(guessAnnouncement(played('PLANK'))).toBe(
      'PLANK: P correct, L correct, A correct, N correct, K not in word. 3 words left.',
    );
  });

  it('uses the singular for one word left', () => {
    expect(guessAnnouncement(played('PLANK', 'PLANT', 'PLANE'))).toMatch(/1 word left\.$/);
  });

  it('says nothing before a guess', () => {
    expect(guessAnnouncement(createDodgeGame('g', 5, ANSWERS))).toBe('');
  });

  it('announces a win in the singular and plural, and a give up with the word', () => {
    const one = dodgeReducer(createDodgeGame('g', 5, ['PLANT']), submit('PLANT'));
    expect(outcomeAnnouncement({ ...one, status: 'won' })).toBe('You found PLANT in 1 guess.');

    const four = played('PLANK', 'PLANT', 'PLANE', 'PLANS');
    expect(outcomeAnnouncement({ ...four, status: 'won' })).toBe('You found PLANS in 4 guesses.');

    expect(outcomeAnnouncement({ ...played('PLANK'), status: 'gave-up' })).toBe(
      'You gave up. The word could have been PLANE.',
    );
  });

  it('falls back to empty words for a game with no data', () => {
    const empty = createDodgeGame('g', 5, []);

    expect(outcomeAnnouncement({ ...empty, status: 'won' })).toBe('You found  in 0 guesses.');
    expect(outcomeAnnouncement({ ...empty, status: 'gave-up' })).toBe(
      'You gave up. The word could have been .',
    );
  });
});

describe('DodgeStatsModal (FR-155, FR-47)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const record = (id: string, over: Partial<DodgeRecord> = {}): DodgeRecord => ({
    id,
    playedAt: 1_000,
    length: 5,
    word: 'PLANT',
    guessesUsed: 6,
    won: true,
    solveMs: 60_000,
    ...over,
  });
  const four = (id: string, over: Partial<DodgeRecord> = {}): DodgeRecord =>
    record(id, { length: 4, word: 'LAMB', ...over });

  function seed(build: (stats: DodgeStatsState) => DodgeStatsState): void {
    createDodgeStatsRepository().write(build(defaultDodgeStats()));
  }

  function renderModal() {
    return render(
      <ToastProvider>
        <DodgeStatsProvider>
          <DodgeStatsModal isOpen onClose={vi.fn()} />
        </DodgeStatsProvider>
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

  it('matches a hand-computed set of statistics, overall and per length', async () => {
    // Oldest first: 5-letter win in 4 and in 8, a 5-letter give up, a 4-letter win in 12.
    // Overall: played 4, won 3, 75%, current streak 1, best 2, average 8, fewest 4.
    // 5 letters: played 3, won 2, 67%, current 0, best 2, average 6.
    // 4 letters: played 1, 100%, average 12.
    seed((s) => {
      let stats = recordDodgeGame(s, record('a', { guessesUsed: 4, solveMs: 30_000 }));
      stats = recordDodgeGame(stats, record('b', { guessesUsed: 8, solveMs: 90_000 }));
      stats = recordDodgeGame(stats, record('c', { won: false, guessesUsed: 3, word: 'PLANE' }));
      return recordDodgeGame(stats, four('d', { guessesUsed: 12, solveMs: 60_000 }));
    });
    const user = userEvent.setup();
    renderModal();

    expect(tile('Played')).toContain('4');
    expect(tile('Win %')).toContain('75%');
    expect(tile('Current streak')).toContain('1');
    expect(tile('Best streak')).toContain('2');
    expect(tile('Avg guesses')).toContain('8.0');
    expect(tile('Fewest')).toContain('4');
    expect(tile('Avg time')).toContain('1:00');
    expect(tile('Fastest')).toContain('0:30');

    await user.click(screen.getByRole('radio', { name: '5 letters' }));
    expect(tile('Played')).toContain('3');
    expect(tile('Win %')).toContain('67%');
    expect(tile('Current streak')).toContain('0');
    expect(tile('Avg guesses')).toContain('6.0');

    await user.click(screen.getByRole('radio', { name: '4 letters' }));
    expect(tile('Played')).toContain('1');
    expect(tile('Win %')).toContain('100%');
    expect(tile('Avg guesses')).toContain('12.0');

    await user.click(screen.getByRole('radio', { name: '6 letters' }));
    expect(tile('Played')).toContain('0');
    expect(tile('Avg guesses')).toContain('—');
    expect(tile('Fewest')).toContain('—');
  });

  it('labels the distribution rows and lists recent games for the chosen view', async () => {
    seed((s) =>
      recordDodgeGame(
        recordDodgeGame(s, record('a', { guessesUsed: 9 })),
        four('b', { won: false, guessesUsed: 2 }),
      ),
    );
    const user = userEvent.setup();
    renderModal();
    const dialog = screen.getByRole('dialog', { name: 'Statistics' });

    // The numbered rows share text with other tiles, so check the two that are words.
    expect(within(dialog).getByText('≤5')).toBeInTheDocument();
    expect(within(dialog).getByText('12+')).toBeInTheDocument();
    expect(dialog).toHaveTextContent('PLANT');
    expect(dialog).toHaveTextContent('9 guesses · 1:00');
    expect(dialog).toHaveTextContent('Gave up');

    await user.click(screen.getByRole('radio', { name: '5 letters' }));
    expect(dialog).toHaveTextContent('PLANT');
    expect(dialog).not.toHaveTextContent('Gave up');
  });

  it('shows a single guess in the singular', () => {
    seed((s) => recordDodgeGame(s, record('a', { guessesUsed: 1 })));
    renderModal();

    expect(screen.getByRole('dialog', { name: 'Statistics' })).toHaveTextContent('1 guess · 1:00');
  });

  it('keeps the reset actions after a statistics reset, while history remains', async () => {
    seed((s) => recordDodgeGame(s, record('a')));
    const user = userEvent.setup();
    renderModal();
    const dialog = screen.getByRole('dialog', { name: 'Statistics' });

    await user.click(within(dialog).getByRole('button', { name: 'Reset statistics' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );

    await waitFor(() => {
      expect(within(dialog).getByText(/No games yet/)).toBeInTheDocument();
    });
    expect(within(dialog).getByRole('button', { name: 'Reset history' })).toBeInTheDocument();
  });
});
