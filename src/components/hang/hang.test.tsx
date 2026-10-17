import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createHangGame,
  hangReducer,
  letterStates,
  type HangAction,
  type HangRecord,
  type HangState,
} from '@/engine/hang';
import { ToastProvider } from '@/state';
import { HangStatsProvider } from '@/state/hang';
import { letterAnnouncement, outcomeAnnouncement, spokenWord } from '@/state/hang/announcements';
import {
  createHangStatsRepository,
  defaultHangStats,
  recordHangGame,
  type HangStatsState,
} from '@/storage';

import { HangFigure } from './HangFigure';
import { HangHelpModal } from './HangHelpModal';
import { HangKeyboard } from './HangKeyboard';
import { HangResultPanel } from './HangResultPanel';
import { HangStatsModal } from './HangStatsModal';
import { HangWord } from './HangWord';
import { keyLabel, missesLabel, wordLabel } from './hangLabels';

/** WordHang panels and dialogs in isolation (T-102). */

const guess = (letter: string): HangAction => ({ type: 'GUESS_LETTER', letter, now: 1 });

function played(secret: string, ...letters: string[]): HangState {
  return letters.reduce(
    (state, letter) => hangReducer(state, guess(letter)),
    createHangGame('g', secret.length as 4 | 5 | 6, secret),
  );
}

describe('labels (A11Y-27)', () => {
  it('names the word with "blank" for each hidden letter, and as the whole word once over', () => {
    expect(wordLabel(played('PLANT'))).toBe('Word: blank, blank, blank, blank, blank');
    expect(wordLabel(played('PLANT', 'A', 'T'))).toBe('Word: blank, blank, A, blank, T');
    expect(wordLabel(played('PLANT', ...'PLANT'))).toBe('Word: PLANT');
    expect(wordLabel(played('PLANT', ...'QZXJKB'))).toBe('Word: PLANT');
  });

  it('gives the misses as text', () => {
    expect(missesLabel(played('PLANT'))).toBe('0 of 6 misses');
    expect(missesLabel(played('PLANT', 'Z', 'P', 'Q'))).toBe('2 of 6 misses');
  });

  it('names a key by its letter, and by whether it was in the word once tried', () => {
    expect(keyLabel('P', undefined)).toBe('P');
    expect(keyLabel('P', 'in')).toBe('P, in the word');
    expect(keyLabel('Z', 'out')).toBe('Z, not in the word');
  });
});

describe('HangFigure (FR-171)', () => {
  const parts = (container: HTMLElement): number =>
    container.querySelectorAll('svg > circle, svg > line').length;

  it.each([0, 1, 2, 3, 4, 5, 6])('draws %i parts for that many misses', (misses) => {
    const { container } = render(<HangFigure misses={misses} />);

    expect(parts(container)).toBe(misses);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('never draws fewer than none or more than six', () => {
    expect(parts(render(<HangFigure misses={-3} />).container)).toBe(0);
    expect(parts(render(<HangFigure misses={9} />).container)).toBe(6);
  });

  it('always draws the gallows', () => {
    const { container } = render(<HangFigure misses={0} />);

    expect(container.querySelectorAll('svg > path')).toHaveLength(1);
  });
});

describe('HangWord (FR-171)', () => {
  it('shows revealed letters and empty tiles, with the word as one labelled group', () => {
    render(<HangWord state={played('PLANT', 'A', 'T')} reducedMotion />);

    const group = screen.getByRole('group', { name: 'Word: blank, blank, A, blank, T' });
    const tiles = [...group.querySelectorAll('span[data-revealed]')];
    expect(tiles.map((tile) => tile.textContent)).toEqual(['', '', 'A', '', 'T']);
    expect(tiles.map((tile) => tile.getAttribute('data-revealed'))).toEqual([
      'false',
      'false',
      'true',
      'false',
      'true',
    ]);
  });

  it('after a loss shows the whole word, marking the letters never found', () => {
    render(<HangWord state={played('PLANT', 'P', ...'QZXJKB')} reducedMotion />);

    const group = screen.getByRole('group', { name: 'Word: PLANT' });
    const tiles = [...group.querySelectorAll('span[data-revealed]')];
    expect(tiles.map((tile) => tile.textContent).join('')).toBe('PLANT');
    expect(tiles.map((tile) => tile.getAttribute('data-revealed'))).toEqual([
      'true',
      'false',
      'false',
      'false',
      'false',
    ]);
  });

  it('pops a revealed tile unless motion is reduced', () => {
    const state = played('PLANT', 'P');
    const { container, rerender } = render(<HangWord state={state} reducedMotion={false} />);
    expect(container.querySelector('span.animate-pop')).not.toBeNull();

    rerender(<HangWord state={state} reducedMotion />);
    expect(container.querySelector('span.animate-pop')).toBeNull();
  });
});

describe('HangKeyboard (FR-169, FR-170)', () => {
  it('has the 26 letters and no Enter or Backspace', () => {
    render(<HangKeyboard letterStates={new Map()} disabled={false} onGuess={vi.fn()} />);

    expect(screen.getAllByRole('button')).toHaveLength(26);
    expect(screen.queryByRole('button', { name: 'Enter' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Backspace' })).not.toBeInTheDocument();
  });

  it('guesses a letter on a press', async () => {
    const onGuess = vi.fn();
    render(<HangKeyboard letterStates={new Map()} disabled={false} onGuess={onGuess} />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Q' }));

    expect(onGuess).toHaveBeenCalledWith('Q');
  });

  it('disables and names a tried key, with a tick or a cross', () => {
    const states = letterStates(played('PLANT', 'P', 'Z'));
    render(<HangKeyboard letterStates={states} disabled={false} onGuess={vi.fn()} />);

    const inKey = screen.getByRole('button', { name: 'P, in the word' });
    const outKey = screen.getByRole('button', { name: 'Z, not in the word' });
    expect(inKey).toBeDisabled();
    expect(inKey).toHaveTextContent('✓');
    expect(outKey).toBeDisabled();
    expect(outKey).toHaveTextContent('✗');
    expect(screen.getByRole('button', { name: 'A' })).toBeEnabled();
  });

  it('disables every key when told to', () => {
    render(<HangKeyboard letterStates={new Map()} disabled onGuess={vi.fn()} />);

    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled();
  });
});

describe('HangResultPanel (FR-172)', () => {
  it('shows a win with the misses, the time, the word, Play again and Change length', async () => {
    const onPlayAgain = vi.fn();
    render(
      <HangResultPanel
        won
        length={5}
        secret="PLANT"
        misses={2}
        elapsedMs={42_000}
        onPlayAgain={onPlayAgain}
        onChangeLength={vi.fn()}
      />,
    );

    const panel = screen.getByRole('region', { name: 'You saved them!' });
    expect(panel).toHaveTextContent('2 of 6 misses · 0:42');
    expect(panel).toHaveTextContent('PLANT');
    expect(within(panel).getByRole('button', { name: 'Change length' })).toBeInTheDocument();

    await userEvent.setup().click(within(panel).getByRole('button', { name: 'Play again' }));
    expect(onPlayAgain).toHaveBeenCalledOnce();
  });

  it('says "No misses" for a perfect win, and leaves out a missing or zero time', () => {
    const props = { won: true, length: 4 as const, secret: 'LAMB', misses: 0 };
    const { rerender } = render(
      <HangResultPanel {...props} elapsedMs={0} onPlayAgain={vi.fn()} onChangeLength={vi.fn()} />,
    );
    expect(screen.getByRole('region')).toHaveTextContent(/^You saved them!No missesThe wordLAMB/);

    rerender(<HangResultPanel {...props} onPlayAgain={vi.fn()} onChangeLength={vi.fn()} />);
    expect(screen.getByRole('region')).not.toHaveTextContent('·');
  });

  it('shows a loss with the word and no time', () => {
    render(
      <HangResultPanel
        won={false}
        length={6}
        secret="PLANET"
        misses={6}
        elapsedMs={30_000}
        onPlayAgain={vi.fn()}
        onChangeLength={vi.fn()}
      />,
    );

    const panel = screen.getByRole('region', { name: 'Out of misses' });
    expect(panel).toHaveTextContent('6 of 6 misses');
    expect(panel).not.toHaveTextContent('0:30');
    expect(panel).toHaveTextContent('PLANET');
  });
});

describe('HangHelpModal (FR-175, A11Y-13)', () => {
  it('explains the letters, the misses, the figure and the keys', () => {
    render(<HangHelpModal isOpen length={5} onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog', { name: 'How to play' });
    expect(dialog).toHaveTextContent('5-letter word');
    expect(dialog).toHaveTextContent(/6 misses/);
    expect(dialog).toHaveTextContent(/head, the body, two arms and two legs/);
    expect(dialog).toHaveTextContent(/tick.*cross/);
  });

  it.each([
    [4, 'LAMB', 'blank, A, blank, B'],
    [5, 'PLANT', 'blank, blank, A, blank, T'],
    [6, 'PLANET', 'blank, blank, A, blank, E, T'],
  ] as const)(
    'has a %i-tile example, decorative, with the meaning in text',
    (length, word, shown) => {
      render(<HangHelpModal isOpen length={length} onClose={vi.fn()} />);

      const dialog = screen.getByRole('dialog', { name: 'How to play' });
      expect(dialog.querySelectorAll('div[aria-hidden="true"] > span')).toHaveLength(length);
      expect(dialog).toHaveTextContent(word);
      expect(dialog).toHaveTextContent(`the word shows as ${shown}.`);
    },
  );

  it('renders nothing while closed', () => {
    render(<HangHelpModal isOpen={false} length={5} onClose={vi.fn()} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('announcements (A11Y-27)', () => {
  it('speaks the word with "blank" for each hidden letter', () => {
    expect(spokenWord(played('PLANT', 'A'))).toBe('blank, blank, A, blank, blank');
  });

  it('says a letter is in the word, with the word so far and the misses left', () => {
    expect(letterAnnouncement(played('PLANT', 'P'), 'P')).toBe(
      'P is in the word. Word so far: P, blank, blank, blank, blank. 6 misses left.',
    );
  });

  it('says how many times a repeated letter appears', () => {
    expect(letterAnnouncement(played('APPLE', 'P'), 'P')).toBe(
      'P is in the word, 2 times. Word so far: blank, P, P, blank, blank. 6 misses left.',
    );
  });

  it('says a letter is not in the word, and uses the singular for one miss left', () => {
    expect(letterAnnouncement(played('PLANT', 'Z'), 'Z')).toBe(
      'Z is not in the word. 5 misses left.',
    );
    expect(letterAnnouncement(played('PLANT', ...'QZXJK'), 'K')).toBe(
      'K is not in the word. 1 miss left.',
    );
  });

  it('announces the end of a game', () => {
    expect(outcomeAnnouncement(played('PLANT', ...'PLANT'), 0)).toBe(
      'You guessed PLANT with no misses.',
    );
    expect(outcomeAnnouncement(played('PLANT', 'Z', ...'PLANT'), 1)).toBe(
      'You guessed PLANT with 1 miss.',
    );
    expect(outcomeAnnouncement(played('PLANT', 'Z', 'Q', ...'PLANT'), 2)).toBe(
      'You guessed PLANT with 2 misses.',
    );
    expect(outcomeAnnouncement(played('PLANT', ...'QZXJKB'), 6)).toBe(
      'You lost. The word was PLANT.',
    );
  });
});

describe('HangStatsModal (FR-174, FR-47)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const record = (id: string, over: Partial<HangRecord> = {}): HangRecord => ({
    id,
    playedAt: 1_000,
    length: 5,
    secret: 'PLANT',
    misses: 2,
    won: true,
    solveMs: 60_000,
    ...over,
  });
  const four = (id: string, over: Partial<HangRecord> = {}): HangRecord =>
    record(id, { length: 4, secret: 'LAMB', ...over });

  function seed(build: (stats: HangStatsState) => HangStatsState): void {
    createHangStatsRepository().write(build(defaultHangStats()));
  }

  function renderModal() {
    return render(
      <ToastProvider>
        <HangStatsProvider>
          <HangStatsModal isOpen onClose={vi.fn()} />
        </HangStatsProvider>
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
    // Oldest first: 5-letter win with 0 misses (30 s), a win with 4 (90 s), a loss,
    // and a 4-letter win with 2 (60 s).
    // Overall: played 4, won 3, 75%, current streak 1, best 2, average misses 2, 1 with no misses.
    // 5 letters: played 3, won 2, 67%, current 0, best 2, average misses 2.
    // 4 letters: played 1, 100%, average misses 2.
    seed((s) => {
      let stats = recordHangGame(s, record('a', { misses: 0, solveMs: 30_000 }));
      stats = recordHangGame(stats, record('b', { misses: 4, solveMs: 90_000 }));
      stats = recordHangGame(stats, record('c', { won: false, misses: 6, secret: 'STORM' }));
      return recordHangGame(stats, four('d', { misses: 2, solveMs: 60_000 }));
    });
    const user = userEvent.setup();
    renderModal();

    expect(tile('Played')).toContain('4');
    expect(tile('Win %')).toContain('75%');
    expect(tile('Current streak')).toContain('1');
    expect(tile('Best streak')).toContain('2');
    expect(tile('Avg misses')).toContain('2.0');
    expect(tile('No misses')).toContain('1');
    expect(tile('Avg time')).toContain('1:00');
    expect(tile('Fastest')).toContain('0:30');

    await user.click(screen.getByRole('radio', { name: '5 letters' }));
    expect(tile('Played')).toContain('3');
    expect(tile('Win %')).toContain('67%');
    expect(tile('Current streak')).toContain('0');
    expect(tile('Avg misses')).toContain('2.0');

    await user.click(screen.getByRole('radio', { name: '4 letters' }));
    expect(tile('Played')).toContain('1');
    expect(tile('Win %')).toContain('100%');

    await user.click(screen.getByRole('radio', { name: '6 letters' }));
    expect(tile('Played')).toContain('0');
    expect(tile('Avg misses')).toContain('—');
    expect(tile('Fastest')).toContain('—');
  });

  it('lists recent games for the chosen view, a loss as Lost and a win with its misses', async () => {
    seed((s) =>
      recordHangGame(
        recordHangGame(s, record('a', { misses: 1 })),
        four('b', { won: false, misses: 6 }),
      ),
    );
    const user = userEvent.setup();
    renderModal();
    const dialog = screen.getByRole('dialog', { name: 'Statistics' });

    expect(dialog).toHaveTextContent('PLANT');
    expect(dialog).toHaveTextContent('1 miss · 1:00');
    expect(dialog).toHaveTextContent('Lost');

    await user.click(screen.getByRole('radio', { name: '5 letters' }));
    expect(dialog).toHaveTextContent('PLANT');
    expect(dialog).not.toHaveTextContent('Lost');
  });

  it('uses the plural for several misses in the recent list', () => {
    seed((s) => recordHangGame(s, record('a', { misses: 3 })));
    renderModal();

    expect(screen.getByRole('dialog', { name: 'Statistics' })).toHaveTextContent('3 misses · 1:00');
  });

  it('keeps the reset actions after a statistics reset, while history remains', async () => {
    seed((s) => recordHangGame(s, record('a')));
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
