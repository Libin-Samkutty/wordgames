import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DICTIONARY_REGISTRY } from '@/dictionary/registry';
import {
  anagramKey,
  anagramsOf,
  buildAnagramIndex,
  createShuffleGame,
  shuffleReducer,
} from '@/engine/shuffle';
import type { ShuffleAction, ShuffleRecord, ShuffleState } from '@/engine/shuffle';
import { ToastProvider } from '@/state';
import { ShuffleStatsProvider } from '@/state/shuffle';
import {
  giveUpAnnouncement,
  hintAnnouncement,
  reshuffleAnnouncement,
  solveAnnouncement,
} from '@/state/shuffle/announcements';
import {
  createShuffleStatsRepository,
  defaultShuffleStats,
  recordShuffleGame,
  type ShuffleStatsState,
} from '@/storage';

import { ShuffleBoard } from './ShuffleBoard';
import { ShuffleHelpModal } from './ShuffleHelpModal';
import { ShuffleResultPanel } from './ShuffleResultPanel';
import { ShuffleStatsModal } from './ShuffleStatsModal';
import { SHUFFLE_HELP_EXAMPLE } from './helpExample';
import { answerLabel, trayLabel } from './shuffleLabels';

/** WordShuffle panels and dialogs in isolation (T-90, T-91). */

const NOW = 1;
const HINT: ShuffleAction = { type: 'HINT', now: NOW };
const add = (letters: string): ShuffleAction[] =>
  [...letters].map((letter) => ({ type: 'ADD_LETTER', letter, now: NOW }));

function run(state: ShuffleState, ...actions: ShuffleAction[]): ShuffleState {
  return actions.reduce(shuffleReducer, state);
}

const fresh = (): ShuffleState => createShuffleGame('g', 6, 'LISTEN', 'NTSELI');

describe('labels (A11Y-24)', () => {
  it('names the answer row letter by letter, marking hinted letters and gaps', () => {
    expect(answerLabel(fresh())).toBe('Your answer: empty, empty, empty, empty, empty, empty');
    expect(answerLabel(run(fresh(), HINT, ...add('S')))).toBe(
      'Your answer: L (hinted), S, empty, empty, empty, empty',
    );
  });

  it('names a tray button with the letter and how many copies are left', () => {
    const state = createShuffleGame('g', 5, 'SPEED', 'EDSEP');

    expect(trayLabel(state, 'E')).toBe('E, 2 left');
    expect(trayLabel(run(state, ...add('E')), 'E')).toBe('E, 1 left');
    expect(trayLabel(state, 'S')).toBe('S, 1 left');
  });
});

describe('ShuffleBoard (FR-139, FR-142)', () => {
  const props = { shake: false, reducedMotion: true, disabled: false, onTapLetter: vi.fn() };

  it('shows the tray as buttons and the answer row as one labelled group', () => {
    render(<ShuffleBoard state={fresh()} {...props} />);

    const tray = screen.getByRole('group', { name: 'Letter tray' });
    expect(within(tray).getAllByRole('button')).toHaveLength(6);
    expect(screen.getByRole('group', { name: /^Your answer: empty/ })).toBeInTheDocument();
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
  });

  it('taps a tray letter into the answer', async () => {
    const onTapLetter = vi.fn();
    render(<ShuffleBoard state={fresh()} {...props} onTapLetter={onTapLetter} />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'S, 1 left' }));

    expect(onTapLetter).toHaveBeenCalledWith('S');
  });

  it('draws a hinted letter locked, as a correct tile, with the colourblind marker', () => {
    const { container } = render(<ShuffleBoard state={run(fresh(), HINT)} {...props} />);

    const hinted = container.querySelectorAll('[data-hinted="true"]');
    expect(hinted).toHaveLength(1);
    expect(hinted[0]).toHaveTextContent('L');
    expect(hinted[0]?.className).toContain('border-tile-correct');
    expect(hinted[0]).toHaveTextContent('✓');
    expect(container.querySelectorAll('[data-hinted="false"]')).toHaveLength(5);
  });

  it('says so when every letter is in the answer', () => {
    render(<ShuffleBoard state={run(fresh(), ...add('NTSELI'))} {...props} />);

    expect(screen.getByText('All letters used')).toBeInTheDocument();
    expect(
      within(screen.getByRole('group', { name: 'Letter tray' })).queryAllByRole('button'),
    ).toHaveLength(0);
  });

  it('disables the tray when input is locked', () => {
    render(<ShuffleBoard state={fresh()} {...props} disabled />);

    for (const button of within(screen.getByRole('group', { name: 'Letter tray' })).getAllByRole(
      'button',
    )) {
      expect(button).toBeDisabled();
    }
  });

  it('tiles are at least 44 px square (class size-11) and hidden from assistive tech', () => {
    const { container } = render(<ShuffleBoard state={fresh()} {...props} />);

    const tiles = container.querySelectorAll('[role="group"][aria-label^="Your answer"] > span');
    expect(tiles).toHaveLength(6);
    for (const tile of tiles) {
      expect(tile).toHaveAttribute('aria-hidden', 'true');
      expect(tile.className).toContain('size-11');
    }
    for (const button of within(screen.getByRole('group', { name: 'Letter tray' })).getAllByRole(
      'button',
    )) {
      expect(button.className).toContain('size-11');
    }
  });
});

describe('ShuffleResultPanel (FR-145)', () => {
  const baseProps = {
    length: 6 as const,
    onPlayAgain: vi.fn(),
    onChangeLength: vi.fn(),
  };

  it('shows a solve with the word, the hints used and the other anagrams', async () => {
    const onPlayAgain = vi.fn();
    render(
      <ShuffleResultPanel
        {...baseProps}
        solved
        word="SILENT"
        hintsUsed={1}
        others={['ENLIST', 'LISTEN']}
        onPlayAgain={onPlayAgain}
      />,
    );

    const panel = screen.getByRole('region', { name: 'Solved!' });
    expect(panel).toHaveTextContent('SILENT');
    expect(panel).toHaveTextContent('1 hint used');
    expect(
      within(panel)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['ENLIST', 'LISTEN']);
    expect(within(panel).getByRole('button', { name: 'Change length' })).toBeInTheDocument();

    await userEvent.setup().click(within(panel).getByRole('button', { name: 'Play again' }));
    expect(onPlayAgain).toHaveBeenCalledOnce();
  });

  it('shows a give up with the word and says so when there is no other anagram', () => {
    render(
      <ShuffleResultPanel {...baseProps} solved={false} word="PLANT" hintsUsed={2} others={[]} />,
    );

    const panel = screen.getByRole('region', { name: 'Gave up' });
    expect(panel).toHaveTextContent('PLANT');
    expect(panel).toHaveTextContent('2 hints used');
    expect(panel).toHaveTextContent('No other word uses these letters.');
    expect(within(panel).queryByRole('list')).not.toBeInTheDocument();
  });

  it('says "No hints used" with none', () => {
    render(<ShuffleResultPanel {...baseProps} solved word="PLANT" hintsUsed={0} others={[]} />);

    expect(screen.getByText('No hints used')).toBeInTheDocument();
  });
});

describe('ShuffleHelpModal (FR-147, A11Y-13)', () => {
  it('explains the tray, any valid anagram, reshuffle, hints and give up', () => {
    render(<ShuffleHelpModal isOpen onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog', { name: 'How to play' });
    expect(dialog).toHaveTextContent(/tray/);
    expect(dialog).toHaveTextContent(/Any real word/);
    expect(dialog).toHaveTextContent(/Reshuffle/);
    expect(dialog).toHaveTextContent(/2 hints/);
    expect(dialog).toHaveTextContent(/no clock/i);
    expect(dialog).toHaveTextContent(/Give up/);
  });

  it('has a decorative example with the meaning in text', () => {
    render(<ShuffleHelpModal isOpen onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog', { name: 'How to play' });
    expect(dialog.querySelector('[aria-hidden="true"].flex-col')).not.toBeNull();
    expect(within(dialog).queryByRole('gridcell')).not.toBeInTheDocument();
    expect(dialog).toHaveTextContent('The tray holds N T S E L I.');
    expect(dialog).toHaveTextContent(
      `The hidden word is ${SHUFFLE_HELP_EXAMPLE.target}, and so is ${SHUFFLE_HELP_EXAMPLE.other}`,
    );
  });

  it('renders nothing while closed', () => {
    render(<ShuffleHelpModal isOpen={false} onClose={vi.fn()} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('the example agrees with the shipped 6-letter list, so it can never disagree with the game', async () => {
    const { scramble, target, other } = SHUFFLE_HELP_EXAMPLE;
    const lists = await DICTIONARY_REGISTRY[6]();
    const guesses = new Set(lists.guesses);
    const index = buildAnagramIndex(lists.guesses);

    // Both words are real and share the tray's letters; the tray itself is not a word.
    expect(anagramKey(scramble)).toBe(anagramKey(target));
    expect(guesses.has(target)).toBe(true);
    expect(guesses.has(other)).toBe(true);
    expect(anagramsOf(index, scramble)).toEqual(expect.arrayContaining([target, other]));
    expect(guesses.has(scramble)).toBe(false);
    expect(lists.answers).toContain(target);
  });
});

describe('announcements (A11Y-24)', () => {
  it('words a hint with the letter, its place and the hints left', () => {
    const one = run(fresh(), HINT);
    const two = run(fresh(), HINT, HINT);

    expect(hintAnnouncement(one)).toBe('Hint: letter 1 is L. 1 hint left.');
    expect(hintAnnouncement(two)).toBe('Hint: letter 2 is I. No hints left.');
    expect(hintAnnouncement(fresh())).toBe('');
  });

  it('words a reshuffle with the new tray order', () => {
    const state = run(fresh(), ...add('N'), { type: 'RESHUFFLE', tray: ['I', 'L', 'E', 'S', 'T'] });

    expect(reshuffleAnnouncement(state)).toBe('Letters reshuffled: I, L, E, S, T.');
  });

  it('words a solve with the word and the hints used, singular and plural', () => {
    const solved = (hints: number): ShuffleState => ({
      ...fresh(),
      status: 'solved',
      found: 'SILENT',
      hinted: [0, 1].slice(0, hints),
    });

    expect(solveAnnouncement(solved(0))).toBe('Solved with SILENT. No hints used.');
    expect(solveAnnouncement(solved(1))).toBe('Solved with SILENT. 1 hint used.');
    expect(solveAnnouncement(solved(2))).toBe('Solved with SILENT. 2 hints used.');
  });

  it('words a give up with the word', () => {
    expect(giveUpAnnouncement(fresh())).toBe('Gave up. The word was LISTEN.');
  });
});

describe('ShuffleStatsModal (FR-146, FR-47)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const solve = (id: string, over: Partial<ShuffleRecord> = {}): ShuffleRecord => ({
    id,
    playedAt: 1_000,
    length: 5,
    target: 'PLANT',
    found: 'PLANT',
    hintsUsed: 0,
    solved: true,
    ...over,
  });
  const gaveUp = (id: string, over: Partial<ShuffleRecord> = {}): ShuffleRecord =>
    solve(id, { solved: false, found: null, ...over });
  const four = (id: string, over: Partial<ShuffleRecord> = {}): ShuffleRecord =>
    solve(id, { length: 4, target: 'LAMB', found: 'LAMB', ...over });

  function seed(build: (stats: ShuffleStatsState) => ShuffleStatsState): void {
    createShuffleStatsRepository().write(build(defaultShuffleStats()));
  }

  function renderModal() {
    return render(
      <ToastProvider>
        <ShuffleStatsProvider>
          <ShuffleStatsModal isOpen onClose={vi.fn()} />
        </ShuffleStatsProvider>
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
    expect(dialog).toHaveTextContent('No games yet');
    expect(dialog.textContent).not.toContain('NaN');
    expect(within(dialog).queryByRole('button', { name: /Reset/ })).not.toBeInTheDocument();
  });

  it('shows the em dash for hints per solve when nothing has been solved', () => {
    seed((s) => recordShuffleGame(s, gaveUp('a')));
    renderModal();

    expect(tile('Hints per solve')).toBe('Hints per solve—');
    expect(tile('Solve %')).toBe('Solve %0%');
  });

  it('matches a hand-computed set of statistics, overall and per length', async () => {
    // Oldest first: 5-letter solve with no hints, solve with 2 hints, give up,
    // then a 4-letter solve with 1 hint.
    // Overall: played 4, solved 3, gave up 1, 75%, no hints 1, hints per solve 3/3 = 1.0,
    // current streak 1, best streak 2.
    // 5 letters: played 3, solved 2, gave up 1, 67%, no hints 1, hints per solve 2/2 = 1.0, streak 0, best 2.
    // 4 letters: played 1, solved 1, 100%, no hints 0, hints per solve 1.0, streak 1.
    seed((s) => {
      let stats = recordShuffleGame(s, solve('a'));
      stats = recordShuffleGame(
        stats,
        solve('b', { hintsUsed: 2, target: 'STORM', found: 'STORM' }),
      );
      stats = recordShuffleGame(stats, gaveUp('c', { target: 'CRANE', hintsUsed: 1 }));
      return recordShuffleGame(stats, four('d', { hintsUsed: 1 }));
    });
    const user = userEvent.setup();
    renderModal();

    expect(tile('Played')).toBe('Played4');
    expect(tile('Solved')).toBe('Solved3');
    expect(tile('Gave up')).toBe('Gave up1');
    expect(tile('Solve %')).toBe('Solve %75%');
    expect(tile('No hints')).toBe('No hints1');
    expect(tile('Hints per solve')).toBe('Hints per solve1.0');
    expect(tile('Current streak')).toBe('Current streak1');
    expect(tile('Best streak')).toBe('Best streak2');

    const dialog = screen.getByRole('dialog', { name: 'Statistics' });
    await user.click(within(dialog).getByRole('radio', { name: '5 letters' }));
    expect(tile('Played')).toBe('Played3');
    expect(tile('Gave up')).toBe('Gave up1');
    expect(tile('Solve %')).toBe('Solve %67%');
    expect(tile('Current streak')).toBe('Current streak0');
    expect(
      within(dialog)
        .getAllByRole('listitem')
        .map((row) => row.textContent),
    ).toEqual(['CRANEGave up', 'STORMSolved, 2 hints', 'PLANTSolved']);

    await user.click(within(dialog).getByRole('radio', { name: '4 letters' }));
    expect(tile('Played')).toBe('Played1');
    expect(tile('Solve %')).toBe('Solve %100%');
    expect(tile('Hints per solve')).toBe('Hints per solve1.0');
    expect(
      within(dialog)
        .getAllByRole('listitem')
        .map((row) => row.textContent),
    ).toEqual(['LAMBSolved, 1 hint']);
  });

  it('keeps the reset actions after a statistics reset, while history remains', async () => {
    seed((s) => recordShuffleGame(s, solve('a')));
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
