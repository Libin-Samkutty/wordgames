import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DICTIONARY_REGISTRY } from '@/dictionary/registry';
import { HEAT_LEVELS, createRangeGame, heatOf, listDistance, rangeReducer } from '@/engine/range';
import type { RangeRecord, RangeState } from '@/engine/range';
import { ToastProvider } from '@/state';
import { RangeStatsProvider } from '@/state/range';
import { guessAnnouncement, outcomeAnnouncement } from '@/state/range/announcements';
import {
  createRangeStatsRepository,
  defaultRangeStats,
  recordRangeGame,
  type RangeStatsState,
} from '@/storage';

import { HeatBadge } from './HeatBadge';
import { HEAT_LABEL, heatPips } from './heatLabel';
import { RANGE_HELP_EXAMPLE } from './helpExample';
import { RangeBoard } from './RangeBoard';
import { RangeHelpModal } from './RangeHelpModal';
import { RangeResultPanel } from './RangeResultPanel';
import { RangeStatsModal } from './RangeStatsModal';

/** WordRange panels and dialogs in isolation (T-82, T-83). */

const submit = (state: RangeState, word: string, distance: number): RangeState =>
  rangeReducer(state, { type: 'SUBMIT_GUESS', word, distance, now: 1 });

describe('heat as a word (FR-121, A11Y-22)', () => {
  it('writes every level as a word, with Burning the most pips and Freezing one', () => {
    expect(HEAT_LEVELS.map((heat) => HEAT_LABEL[heat])).toEqual([
      'Burning',
      'Hot',
      'Warm',
      'Cold',
      'Freezing',
    ]);
    expect(HEAT_LEVELS.map(heatPips)).toEqual([5, 4, 3, 2, 1]);
  });

  it.each(HEAT_LEVELS)('HeatBadge renders the word for %s', (heat) => {
    render(<HeatBadge heat={heat} />);

    expect(screen.getByText(HEAT_LABEL[heat])).toBeInTheDocument();
  });
});

describe('RangeBoard (FR-121)', () => {
  const noop = { shake: false, reducedMotion: true } as const;

  it('shows every heat level as a word in the guess list', () => {
    let state = createRangeGame('g', 'PLANT');
    // Distances at each band edge, so the five levels all appear.
    const words = ['ABOUT', 'BRAVE', 'CRANE', 'FIGHT', 'JUMPY'];
    const distances = [20, 100, 500, 2000, 2001];
    words.forEach((word, index) => {
      state = submit(state, word, distances[index] as number);
    });

    render(<RangeBoard state={state} {...noop} />);

    const items = within(
      screen.getByRole('list', { name: 'Your guesses, in alphabetical order' }),
    ).getAllByRole('listitem');
    expect(
      items.map((item) => /Burning|Hot|Warm|Cold|Freezing/.exec(item.textContent)?.[0]),
    ).toEqual(['Burning', 'Hot', 'Warm', 'Cold', 'Freezing']);
  });

  it('sorts alphabetically and marks the secret itself "Found it"', () => {
    let state = createRangeGame('g', 'PLANT');
    state = submit(state, 'STORM', 300);
    state = submit(state, 'BRAVE', 5000);
    state = submit(state, 'PLANT', 0);

    render(<RangeBoard state={state} {...noop} />);

    const items = within(
      screen.getByRole('list', { name: 'Your guesses, in alphabetical order' }),
    ).getAllByRole('listitem');
    expect(items.map((item) => item.querySelector('span')?.textContent)).toEqual([
      'BRAVE',
      'PLANT',
      'STORM',
    ]);
    expect(items[1]).toHaveTextContent('Found it');
  });

  it('shows no list and "No guesses yet" before the first guess', () => {
    render(<RangeBoard state={createRangeGame('g', 'PLANT')} {...noop} />);

    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.getByText('No guesses yet')).toBeInTheDocument();
    expect(screen.getByText('14 guesses left')).toBeInTheDocument();
  });

  it('says "1 guess left" in the singular', () => {
    let state = createRangeGame('g', 'PLANT');
    for (const word of ['ABOUT', 'ADIEU', 'BLAZE', 'BRAVE', 'CRANE', 'FIGHT', 'JUMPY']) {
      state = submit(state, word, 5000);
    }
    state = { ...state, guesses: [...state.guesses, ...state.guesses].slice(0, 13) };

    render(<RangeBoard state={state} {...noop} />);

    expect(screen.getByText('1 guess left')).toBeInTheDocument();
  });

  it('names the input row with the letters typed and hides the tiles from assistive tech', () => {
    const state = rangeReducer(createRangeGame('g', 'PLANT'), {
      type: 'ADD_LETTER',
      letter: 'P',
      now: 1,
    });

    render(<RangeBoard state={state} {...noop} />);

    const row = screen.getByRole('group', { name: 'Your guess: P' });
    expect(row.querySelectorAll('[aria-hidden="true"]')).toHaveLength(5);
    expect(screen.queryByRole('gridcell')).not.toBeInTheDocument();
  });

  it('shows the bounds, sentinels included', () => {
    render(<RangeBoard state={createRangeGame('g', 'PLANT')} {...noop} />);

    expect(screen.getByText('ZZZZZ')).toBeInTheDocument();
    expect(screen.getByText('AAAAA')).toBeInTheDocument();
  });
});

describe('RangeResultPanel (FR-123)', () => {
  it('shows a win with the guesses and the word, and Play again', async () => {
    const onPlayAgain = vi.fn();
    render(<RangeResultPanel won guessesUsed={6} secret="PLANT" onPlayAgain={onPlayAgain} />);

    const panel = screen.getByRole('region', { name: 'You found it!' });
    expect(panel).toHaveTextContent('6 of 14 guesses');
    expect(panel).toHaveTextContent('PLANT');

    await userEvent.setup().click(within(panel).getByRole('button', { name: 'Play again' }));
    expect(onPlayAgain).toHaveBeenCalledOnce();
  });

  it('shows a loss and reveals the word', () => {
    render(<RangeResultPanel won={false} guessesUsed={14} secret="PLANT" onPlayAgain={vi.fn()} />);

    const panel = screen.getByRole('region', { name: 'Out of guesses' });
    expect(panel).toHaveTextContent('14 of 14 guesses');
    expect(panel).toHaveTextContent('PLANT');
  });
});

describe('RangeHelpModal (FR-126, A11Y-13)', () => {
  it('explains before and after, the range and all five heat levels', () => {
    render(<RangeHelpModal isOpen onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog', { name: 'How to play' });
    expect(dialog).toHaveTextContent(/before or after/);
    expect(dialog).toHaveTextContent(/14 guesses/);
    for (const label of Object.values(HEAT_LABEL)) expect(dialog).toHaveTextContent(label);
  });

  it('has a three-guess example, decorative, with the meaning in sentences', () => {
    render(<RangeHelpModal isOpen onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog', { name: 'How to play' });
    expect(RANGE_HELP_EXAMPLE.steps).toHaveLength(3);
    expect(dialog.querySelectorAll('ol[aria-hidden="true"] > li')).toHaveLength(3);
    expect(dialog).toHaveTextContent('BRAVE: the word is after it. Freezing.');
    expect(dialog).toHaveTextContent('PLUMB: the word is before it. Hot.');
    expect(dialog).toHaveTextContent('PLAIN: the word is after it. Burning.');
  });

  it('renders nothing while closed', () => {
    render(<RangeHelpModal isOpen={false} onClose={vi.fn()} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('example agrees with the shipped 5-letter list, so it can never disagree with the game', async () => {
    const lists = await DICTIONARY_REGISTRY[5]();
    const sorted = [...lists.guesses].sort();

    for (const step of RANGE_HELP_EXAMPLE.steps) {
      const distance = listDistance(sorted, step.word, RANGE_HELP_EXAMPLE.secret) as number;
      expect(heatOf(distance)).toBe(step.heat);
      expect(step.word < RANGE_HELP_EXAMPLE.secret ? 'after' : 'before').toBe(step.direction);
    }
  });
});

describe('announcements (A11Y-22)', () => {
  it('words a guess with direction, range, heat and guesses left', () => {
    const state = submit(createRangeGame('g', 'PLANT'), 'BRAVE', 7171);

    expect(guessAnnouncement(state)).toBe(
      'BRAVE: the word is after it. Range BRAVE to ZZZZZ. Freezing. 13 guesses left.',
    );
  });

  it('uses the singular for one guess left', () => {
    let state = createRangeGame('g', 'PLANT');
    for (let i = 0; i < 12; i += 1) state = submit(state, 'BRAVE', 5000);
    state = submit(state, 'STORM', 40);

    expect(guessAnnouncement(state)).toBe(
      'STORM: the word is before it. Range BRAVE to STORM. Hot. 1 guess left.',
    );
  });

  it('says nothing for the secret itself, which the outcome message covers', () => {
    expect(guessAnnouncement(submit(createRangeGame('g', 'PLANT'), 'PLANT', 0))).toBe('');
  });

  it('announces a win in the singular and plural, and a loss with the word', () => {
    const one = submit(createRangeGame('g', 'PLANT'), 'PLANT', 0);
    const two = submit(submit(createRangeGame('g', 'PLANT'), 'BRAVE', 5000), 'PLANT', 0);

    expect(outcomeAnnouncement(one)).toBe('You found PLANT in 1 guess.');
    expect(outcomeAnnouncement(two)).toBe('You found PLANT in 2 guesses.');
    expect(outcomeAnnouncement({ ...two, status: 'lost' })).toBe('Game over. The word was PLANT.');
  });
});

describe('RangeStatsModal (FR-124, FR-47)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const record = (id: string, over: Partial<RangeRecord> = {}): RangeRecord => ({
    id,
    playedAt: 1_000,
    secret: 'PLANT',
    guessesUsed: 5,
    won: true,
    ...over,
  });

  function seed(build: (stats: RangeStatsState) => RangeStatsState): void {
    createRangeStatsRepository().write(build(defaultRangeStats()));
  }

  function renderModal() {
    return render(
      <ToastProvider>
        <RangeStatsProvider>
          <RangeStatsModal isOpen onClose={vi.fn()} />
        </RangeStatsProvider>
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

  it('matches a hand-computed set of statistics', () => {
    // Oldest first: win in 3, win in 5, loss, win in 14. Played 4, won 3, 75%,
    // current streak 1, best streak 2.
    seed((s) => {
      let stats = recordRangeGame(s, record('a', { guessesUsed: 3 }));
      stats = recordRangeGame(stats, record('b', { guessesUsed: 5, secret: 'STORM' }));
      stats = recordRangeGame(stats, record('c', { won: false, guessesUsed: 14, secret: 'CRANE' }));
      return recordRangeGame(stats, record('d', { guessesUsed: 14, secret: 'MOUND' }));
    });
    renderModal();

    expect(tile('Played')).toBe('Played4');
    expect(tile('Win %')).toBe('Win %75%');
    expect(tile('Current streak')).toBe('Current streak1');
    expect(tile('Best streak')).toBe('Best streak2');

    const dialog = screen.getByRole('dialog', { name: 'Statistics' });
    expect(dialog).toHaveTextContent('Wins by guesses (1 to 14)');
    // Newest first, with the loss marked.
    const rows = within(dialog).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual([
      'MOUND14/14',
      'CRANENot found',
      'STORM5/14',
      'PLANT3/14',
    ]);
    // 14 distribution rows.
    expect(dialog.querySelectorAll('[data-has-count]')).toHaveLength(14);
    expect(dialog.querySelectorAll('[data-has-count="true"]')).toHaveLength(3);
  });

  it('keeps the reset actions after a statistics reset, while history remains', async () => {
    seed((s) => recordRangeGame(s, record('a')));
    const user = userEvent.setup();
    renderModal();

    const dialog = screen.getByRole('dialog', { name: 'Statistics' });
    await user.click(within(dialog).getByRole('button', { name: 'Reset statistics' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );

    expect(within(dialog).getByText(/No games yet/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Reset history' })).toBeInTheDocument();
  });
});
