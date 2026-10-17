import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createHuntGame,
  huntReducer,
  type HuntAction,
  type HuntRecord,
  type HuntState,
} from '@/engine/hunt';
import { ToastProvider } from '@/state';
import { HuntStatsProvider } from '@/state/hunt';
import { outcomeAnnouncement, wordAnnouncement } from '@/state/hunt/announcements';
import {
  createHuntStatsRepository,
  defaultHuntStats,
  recordHuntGame,
  type HuntStatsState,
} from '@/storage';

import { HuntBoard } from './HuntBoard';
import { HuntHelpModal } from './HuntHelpModal';
import { HuntResultPanel } from './HuntResultPanel';
import { HuntStatsModal } from './HuntStatsModal';
import { groupHeading, slotLabel, trayLabel, wordRowLabel } from './huntLabels';

/** WordHunt panels and dialogs in isolation (T-98). */

const PUZZLE = {
  seed: 'STAPLE',
  tray: 'PLATES',
  required: ['LEAP', 'PALE', 'LEAST', 'STAPLE'],
};
const add = (letter: string): HuntAction => ({ type: 'ADD_LETTER', letter, now: 1 });
const submit = (word: string): HuntAction => ({ type: 'SUBMIT_WORD', word, now: 2 });

function played(...actions: HuntAction[]): HuntState {
  return actions.reduce(huntReducer, createHuntGame('g', PUZZLE));
}

describe('labels (A11Y-26)', () => {
  it('names the word row for what is typed, or empty', () => {
    expect(wordRowLabel(played())).toBe('Your word: empty');
    expect(wordRowLabel(played(add('L'), add('E')))).toBe('Your word: LE');
  });

  it('names a tray button for its letter, and says when it is used', () => {
    expect(trayLabel('P', false)).toBe('P');
    expect(trayLabel('P', true)).toBe('P, used');
  });

  it('names a slot: the word if found, the length if not, and the word marked missed after a give up', () => {
    expect(slotLabel({ word: 'LEAP', found: true }, false)).toBe('LEAP');
    expect(slotLabel({ word: 'LEAP', found: false }, false)).toBe('4 letters, not found');
    expect(slotLabel({ word: 'LEAP', found: false }, true)).toBe('LEAP, missed');
    expect(slotLabel({ word: 'LEAP', found: true }, true)).toBe('LEAP');
  });

  it('heads a group with its length and how many are found', () => {
    expect(
      groupHeading(4, [
        { word: 'LEAP', found: true },
        { word: 'PALE', found: false },
      ]),
    ).toBe('4 letters · 1 of 2');
  });
});

describe('HuntBoard (FR-160)', () => {
  const noop = { shake: false, reducedMotion: true, disabled: false, onTapLetter: vi.fn() };

  it('draws a slot for every required word, grouped by length', () => {
    render(<HuntBoard state={played()} {...noop} />);

    expect(screen.getByRole('region', { name: '4-letter words' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '5-letter words' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '6-letter words' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
  });

  it('shows a found word in its slot, and an unfound one as a blank with its length in the name', () => {
    render(<HuntBoard state={played(submit('LEAP'))} {...noop} />);

    expect(screen.getByLabelText('LEAP')).toHaveTextContent('LEAP');
    expect(screen.getByLabelText('4 letters, not found')).toHaveTextContent('');
  });

  it('lists the bonus words found, and none when there are none', () => {
    const { rerender } = render(<HuntBoard state={played()} {...noop} />);
    expect(screen.queryByText(/Bonus words/)).not.toBeInTheDocument();

    rerender(<HuntBoard state={played(submit('PEAL'))} {...noop} />);
    expect(screen.getByText(/Bonus words \(1\)/)).toBeInTheDocument();
    expect(screen.getByText('PEAL')).toBeInTheDocument();
  });

  it('shows the typed letters in the word row and marks the tray letters in use', () => {
    render(<HuntBoard state={played(add('L'), add('E'))} {...noop} />);

    expect(screen.getByRole('group', { name: 'Your word: LE' })).toHaveTextContent('LE');
    expect(screen.getByRole('button', { name: 'L, used' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'A' })).toBeEnabled();
  });

  it('taps a tray letter through onTapLetter, and disables the tray when told to', async () => {
    const onTapLetter = vi.fn();
    const { rerender } = render(<HuntBoard state={played()} {...noop} onTapLetter={onTapLetter} />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'P' }));
    expect(onTapLetter).toHaveBeenCalledWith('P');

    rerender(<HuntBoard state={played()} {...noop} disabled onTapLetter={onTapLetter} />);
    expect(screen.getByRole('button', { name: 'P' })).toBeDisabled();
  });

  it('shakes the word row only when asked, and not under reduced motion', () => {
    const { rerender } = render(
      <HuntBoard state={played()} {...noop} shake reducedMotion={false} />,
    );
    expect(screen.getByRole('group', { name: 'Your word: empty' }).className).toContain(
      'animate-shake',
    );

    rerender(<HuntBoard state={played()} {...noop} shake reducedMotion />);
    expect(screen.getByRole('group', { name: 'Your word: empty' }).className).not.toContain(
      'animate-shake',
    );
  });

  it('animates a typed tile unless motion is reduced', () => {
    const typed = played(add('L'));
    const { container, rerender } = render(
      <HuntBoard state={typed} {...noop} reducedMotion={false} />,
    );
    expect(container.querySelector('span.animate-pop')).not.toBeNull();

    rerender(<HuntBoard state={typed} {...noop} reducedMotion />);
    expect(container.querySelector('span.animate-pop')).toBeNull();
  });

  it('after a give up, shows the missed words marked in text, and no word row or tray', () => {
    const state = huntReducer(played(submit('LEAP')), { type: 'GIVE_UP', now: 3 });
    render(<HuntBoard state={state} {...noop} />);

    expect(screen.getByLabelText('PALE, missed')).toHaveTextContent('PALE');
    expect(screen.getByLabelText('LEAP')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Letter tray' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /^Your word/ })).not.toBeInTheDocument();
  });
});

describe('HuntResultPanel (FR-163)', () => {
  it('shows a completed puzzle with the counts, bonus words and time', async () => {
    const onPlayAgain = vi.fn();
    render(
      <HuntResultPanel
        completed
        foundCount={12}
        requiredCount={12}
        bonusCount={2}
        elapsedMs={83_000}
        missed={[]}
        onPlayAgain={onPlayAgain}
      />,
    );

    const panel = screen.getByRole('region', { name: 'Every word found!' });
    expect(panel).toHaveTextContent('12 of 12 words · 1:23');
    expect(panel).toHaveTextContent('2 bonus words');
    expect(within(panel).queryByText('Words you missed')).not.toBeInTheDocument();

    await userEvent.setup().click(within(panel).getByRole('button', { name: 'Play again' }));
    expect(onPlayAgain).toHaveBeenCalledOnce();
  });

  it('uses the singular for one bonus word, and leaves out none and a missing time', () => {
    const props = { foundCount: 3, requiredCount: 3, missed: [], onPlayAgain: vi.fn() };
    const { rerender } = render(
      <HuntResultPanel completed bonusCount={1} elapsedMs={0} {...props} />,
    );
    expect(screen.getByRole('region')).toHaveTextContent('1 bonus word');
    expect(screen.getByRole('region')).not.toHaveTextContent('·');

    rerender(<HuntResultPanel completed bonusCount={0} {...props} />);
    expect(screen.getByRole('region')).not.toHaveTextContent('bonus');
  });

  it('shows a give up with the words missed', () => {
    render(
      <HuntResultPanel
        completed={false}
        foundCount={2}
        requiredCount={4}
        bonusCount={0}
        missed={['LEAST', 'STAPLE']}
        onPlayAgain={vi.fn()}
      />,
    );

    const panel = screen.getByRole('region', { name: 'Gave up' });
    expect(panel).toHaveTextContent('2 of 4 words');
    expect(within(panel).getByText('Words you missed')).toBeInTheDocument();
    expect(
      within(panel)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['LEAST', 'STAPLE']);
  });
});

describe('HuntHelpModal (FR-166, A11Y-13)', () => {
  it('explains the tray, the slots, bonus words, reshuffle, the clock and Give up', () => {
    render(<HuntHelpModal isOpen onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog', { name: 'How to play' });
    expect(dialog).toHaveTextContent('Six letters sit in the tray');
    expect(dialog).toHaveTextContent(/slots show how many words/);
    expect(dialog).toHaveTextContent(/bonus word/);
    expect(dialog).toHaveTextContent(/Reshuffle/);
    expect(dialog).toHaveTextContent(/clock/);
    expect(dialog).toHaveTextContent(/Give up/);
  });

  it('has a decorative example with the meaning in text', () => {
    render(<HuntHelpModal isOpen onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog', { name: 'How to play' });
    expect(dialog.querySelectorAll('div[aria-hidden="true"] > span')).toHaveLength(6);
    expect(dialog).toHaveTextContent('From PLATES you can make LEAP, STALE, PLATES and more.');
  });

  it('renders nothing while closed', () => {
    render(<HuntHelpModal isOpen={false} onClose={vi.fn()} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('announcements (A11Y-26)', () => {
  it('words a found word with the counts', () => {
    const state = played(submit('LEAP'));

    expect(wordAnnouncement(state, 'LEAP', true)).toBe('LEAP. 1 of 4 found. 3 words left.');
  });

  it('uses the singular for one word left', () => {
    const state = played(submit('LEAP'), submit('PALE'), submit('LEAST'));

    expect(wordAnnouncement(state, 'LEAST', true)).toBe('LEAST. 3 of 4 found. 1 word left.');
  });

  it('words a bonus word with the bonus count, singular and plural', () => {
    expect(wordAnnouncement(played(submit('PEAL')), 'PEAL', false)).toBe(
      'PEAL is a bonus word. 1 bonus word.',
    );
    expect(wordAnnouncement(played(submit('PEAL'), submit('PLEA')), 'PLEA', false)).toBe(
      'PLEA is a bonus word. 2 bonus words.',
    );
  });

  it('announces the end of a puzzle, with or without bonus words', () => {
    const all = ['LEAP', 'PALE', 'LEAST', 'STAPLE'].map(submit);

    expect(outcomeAnnouncement(played(...all))).toBe('You found all 4 words.');
    expect(outcomeAnnouncement(played(submit('PEAL'), ...all))).toBe(
      'You found all 4 words and 1 bonus word.',
    );
    expect(outcomeAnnouncement(played(submit('PEAL'), submit('PLEA'), ...all))).toBe(
      'You found all 4 words and 2 bonus words.',
    );
    expect(
      outcomeAnnouncement(huntReducer(played(submit('LEAP')), { type: 'GIVE_UP', now: 5 })),
    ).toBe('You gave up with 1 of 4 words found.');
  });
});

describe('HuntStatsModal (FR-165, FR-47)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const record = (id: string, over: Partial<HuntRecord> = {}): HuntRecord => ({
    id,
    playedAt: 1_000,
    seed: 'STAPLE',
    requiredCount: 10,
    foundCount: 10,
    bonusCount: 2,
    completed: true,
    solveMs: 60_000,
    ...over,
  });

  function seed(build: (stats: HuntStatsState) => HuntStatsState): void {
    createHuntStatsRepository().write(build(defaultHuntStats()));
  }

  function renderModal() {
    return render(
      <ToastProvider>
        <HuntStatsProvider>
          <HuntStatsModal isOpen onClose={vi.fn()} />
        </HuntStatsProvider>
      </ToastProvider>,
    );
  }

  function tile(label: string): string {
    const dialog = screen.getByRole('dialog', { name: 'Statistics' });
    return within(dialog).getByText(label, { selector: 'dt' }).closest('div')?.textContent ?? '';
  }

  it('shows the empty state, never zeros or NaN, with no puzzles played (FR-41)', () => {
    renderModal();

    const dialog = screen.getByRole('dialog', { name: 'Statistics' });
    expect(dialog).toHaveTextContent('No puzzles yet');
    expect(dialog.textContent).not.toContain('NaN');
    expect(within(dialog).queryByRole('button', { name: /Reset/ })).not.toBeInTheDocument();
  });

  it('matches a hand-computed set of statistics', () => {
    // Oldest first: a completion in 30 s, a give up with 6 of 10, a completion in 90 s.
    // Played 3, completed 2 (67%), current streak 1, best 1.
    // Words found 26 of 30 (87%), bonus words 2 + 1 + 3 = 6, average time 60 s, fastest 30 s.
    seed((s) => {
      let stats = recordHuntGame(s, record('a', { solveMs: 30_000, bonusCount: 2 }));
      stats = recordHuntGame(
        stats,
        record('b', { completed: false, foundCount: 6, bonusCount: 1 }),
      );
      return recordHuntGame(stats, record('c', { solveMs: 90_000, bonusCount: 3 }));
    });
    renderModal();

    expect(tile('Played')).toContain('3');
    expect(tile('Done %')).toContain('67%');
    expect(tile('Current streak')).toContain('1');
    expect(tile('Best streak')).toContain('1');
    expect(tile('Words found')).toContain('87%');
    expect(tile('Bonus words')).toContain('6');
    expect(tile('Avg time')).toContain('1:00');
    expect(tile('Fastest')).toContain('0:30');
  });

  it('lists recent puzzles with their counts, time and whether they were given up', () => {
    seed((s) =>
      recordHuntGame(
        recordHuntGame(s, record('a')),
        record('b', { completed: false, foundCount: 6, seed: 'CARPET' }),
      ),
    );
    renderModal();
    const dialog = screen.getByRole('dialog', { name: 'Statistics' });

    expect(dialog).toHaveTextContent('STAPLE');
    expect(dialog).toHaveTextContent('10 of 10 · 1:00');
    expect(dialog).toHaveTextContent('CARPET');
    expect(dialog).toHaveTextContent('6 of 10 · gave up');
  });

  it('shows — for the average time and the words found when nothing was completed or found', () => {
    seed((s) => recordHuntGame(s, record('a', { completed: false, foundCount: 0, bonusCount: 0 })));
    renderModal();

    expect(tile('Avg time')).toContain('—');
    expect(tile('Fastest')).toContain('—');
    expect(tile('Words found')).toContain('0%');
  });

  it('keeps the reset actions after a statistics reset, while history remains', async () => {
    seed((s) => recordHuntGame(s, record('a')));
    const user = userEvent.setup();
    renderModal();
    const dialog = screen.getByRole('dialog', { name: 'Statistics' });

    await user.click(within(dialog).getByRole('button', { name: 'Reset statistics' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );

    await waitFor(() => {
      expect(within(dialog).getByText(/No puzzles yet/)).toBeInTheDocument();
    });
    expect(within(dialog).getByRole('button', { name: 'Reset history' })).toBeInTheDocument();
  });
});
