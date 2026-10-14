import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { codeReducer, createCodeGame, scoreCode } from '@/engine/code';
import type { CodeAction, CodeRecord, CodeState } from '@/engine/code';
import { ToastProvider } from '@/state';
import { CodeStatsProvider } from '@/state/code';
import { guessAnnouncement, outcomeAnnouncement } from '@/state/code/announcements';
import {
  createCodeStatsRepository,
  defaultCodeStats,
  recordCodeGame,
  type CodeStatsState,
} from '@/storage';

import { CodeHelpModal } from './CodeHelpModal';
import { CodeKeyboard } from './CodeKeyboard';
import { CodeResultPanel } from './CodeResultPanel';
import { CodeRows } from './CodeRows';
import { CodeStatsModal } from './CodeStatsModal';
import { NotesPanel } from './NotesPanel';
import { codeHelpExample } from './helpExample';
import { countLabel, noteLabel, noteName } from './noteLabel';

/** WordCode panels and dialogs in isolation (T-86, T-87). */

const submit = (word: string): CodeAction => ({ type: 'SUBMIT_GUESS', word, now: 1 });

function played(length: 4 | 5 | 6, secret: string, ...words: string[]): CodeState {
  return words.reduce(
    (state, word) => codeReducer(state, submit(word)),
    createCodeGame('g', length, secret),
  );
}

describe('labels', () => {
  it('names each mark and builds the button label (A11Y-23)', () => {
    expect(noteName(undefined)).toBe('unmarked');
    expect(noteName('out')).toBe('ruled out');
    expect(noteName('in')).toBe('in the word');
    expect(noteLabel('P', 'out')).toBe('P, ruled out');
  });

  it('counts in the singular and the plural', () => {
    expect(countLabel(1, 'bull', 'bulls')).toBe('1 bull');
    expect(countLabel(0, 'cow', 'cows')).toBe('0 cows');
    expect(countLabel(2, 'bull', 'bulls')).toBe('2 bulls');
  });
});

describe('CodeRows (FR-131)', () => {
  const noop = { shake: false, reducedMotion: true } as const;

  it.each([4, 5, 6] as const)('draws ten rows of %i neutral tiles', (length) => {
    render(<CodeRows state={createCodeGame('g', length, 'A'.repeat(length))} {...noop} />);

    const items = within(screen.getByRole('list', { name: 'Guesses' })).getAllByRole('listitem');
    expect(items).toHaveLength(10);
    expect(items[0]?.querySelectorAll('[aria-hidden="true"] > span')).toHaveLength(length);
  });

  it('shows each guess with its counts as text, and the row being typed', () => {
    const state = codeReducer(played(5, 'PLANT', 'PANEL', 'SLATE'), {
      type: 'ADD_LETTER',
      letter: 'P',
      now: 2,
    });

    render(<CodeRows state={state} {...noop} />);

    const items = within(screen.getByRole('list', { name: 'Guesses' })).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('PANEL: 1 bull · 3 cows');
    expect(items[1]).toHaveTextContent('SLATE: 2 bulls · 1 cow');
    expect(items[2]).toHaveAccessibleName('Your guess: P');
  });

  it('has no active row once the game is over', () => {
    render(<CodeRows state={played(5, 'PLANT', 'PLANT')} {...noop} />);

    expect(screen.queryByRole('listitem', { name: /Your guess/ })).not.toBeInTheDocument();
  });
});

describe('NotesPanel (FR-132, A11Y-23)', () => {
  it('has 26 buttons named for their mark and cycles on press', async () => {
    const onCycle = vi.fn();
    render(<NotesPanel notes={{ P: 'out', Q: 'in' }} disabled={false} onCycle={onCycle} />);

    expect(screen.getAllByRole('button')).toHaveLength(26);
    expect(screen.getByRole('button', { name: 'P, ruled out' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Q, in the word' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'A, unmarked' })).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: 'A, unmarked' }));
    expect(onCycle).toHaveBeenCalledWith('A');
  });

  it('is disabled once the game is over', () => {
    render(<NotesPanel notes={{}} disabled onCycle={vi.fn()} />);

    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled();
  });

  it('writes the mark on the button, so it never relies on colour', () => {
    render(<NotesPanel notes={{ P: 'out', Q: 'in' }} disabled={false} onCycle={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'P, ruled out' })).toHaveTextContent('out');
    expect(screen.getByRole('button', { name: 'Q, in the word' })).toHaveTextContent('in');
  });
});

describe('CodeKeyboard (FR-132)', () => {
  it('names a marked key for its mark and presses its letter', async () => {
    const onKeyPress = vi.fn();
    render(<CodeKeyboard notes={{ P: 'out' }} disabled={false} onKeyPress={onKeyPress} />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'P, ruled out' }));
    await userEvent.setup().click(screen.getByRole('button', { name: 'Q' }));

    expect(onKeyPress).toHaveBeenNthCalledWith(1, 'P');
    expect(onKeyPress).toHaveBeenNthCalledWith(2, 'Q');
  });

  it('has Enter and Backspace, and is disabled as a whole', () => {
    render(<CodeKeyboard notes={{}} disabled onKeyPress={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Enter' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Backspace' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'A' })).toBeDisabled();
  });
});

describe('CodeResultPanel (FR-133)', () => {
  it('shows a win, the guesses, the word, Play again and Change length', async () => {
    const onPlayAgain = vi.fn();
    render(
      <CodeResultPanel
        won
        length={5}
        guessesUsed={4}
        secret="PLANT"
        onPlayAgain={onPlayAgain}
        onChangeLength={vi.fn()}
      />,
    );

    const panel = screen.getByRole('region', { name: 'You cracked it!' });
    expect(panel).toHaveTextContent('4 of 10 guesses');
    expect(panel).toHaveTextContent('PLANT');
    expect(within(panel).getByRole('button', { name: 'Change length' })).toBeInTheDocument();

    await userEvent.setup().click(within(panel).getByRole('button', { name: 'Play again' }));
    expect(onPlayAgain).toHaveBeenCalledOnce();
  });

  it('shows a loss and reveals the word', () => {
    render(
      <CodeResultPanel
        won={false}
        length={4}
        guessesUsed={10}
        secret="LAMB"
        onPlayAgain={vi.fn()}
        onChangeLength={vi.fn()}
      />,
    );

    const panel = screen.getByRole('region', { name: 'Out of guesses' });
    expect(panel).toHaveTextContent('10 of 10 guesses');
    expect(panel).toHaveTextContent('LAMB');
  });
});

describe('CodeHelpModal (FR-136, A11Y-13)', () => {
  it('explains bulls, cows, repeated letters and the letter notes', () => {
    render(<CodeHelpModal isOpen length={5} onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog', { name: 'How to play' });
    expect(dialog).toHaveTextContent(/bull.*right place/);
    expect(dialog).toHaveTextContent(/cow.*wrong place/);
    expect(dialog).toHaveTextContent(/Repeated letters/);
    expect(dialog).toHaveTextContent(/Letter notes/);
    expect(dialog).toHaveTextContent('5-letter word');
  });

  it.each([4, 5, 6] as const)(
    'has a two-guess example with %i tiles per guess, decorative, with the meaning in text',
    (length) => {
      render(<CodeHelpModal isOpen length={length} onClose={vi.fn()} />);

      const dialog = screen.getByRole('dialog', { name: 'How to play' });
      const rows = dialog.querySelectorAll('ol[aria-hidden="true"] > li');
      expect(rows).toHaveLength(2);
      for (const row of rows) {
        expect(row.querySelectorAll('span.size-8, span.sm\\:size-10')).toHaveLength(length);
      }
      const { secret, guesses } = codeHelpExample(length);
      expect(dialog).toHaveTextContent(`The hidden word is ${secret}.`);
      for (const guess of guesses) {
        expect(dialog).toHaveTextContent(
          `${guess.word}: ${countLabel(guess.bulls, 'bull', 'bulls')} and ${countLabel(guess.cows, 'cow', 'cows')}.`,
        );
      }
    },
  );

  it('renders nothing while closed', () => {
    render(<CodeHelpModal isOpen={false} length={5} onClose={vi.fn()} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it.each([4, 5, 6] as const)('example counts at length %i are the engine counts', (length) => {
    const { secret, guesses } = codeHelpExample(length);

    expect(secret).toHaveLength(length);
    for (const guess of guesses) {
      expect(guess.word).toHaveLength(length);
      expect({ bulls: guess.bulls, cows: guess.cows }).toEqual(scoreCode(guess.word, secret));
    }
  });
});

describe('announcements (A11Y-23)', () => {
  it('words a guess with the counts and the guesses left', () => {
    expect(guessAnnouncement(played(5, 'PLANT', 'PANEL'))).toBe(
      'PANEL: 1 bull, 3 cows. 9 guesses left.',
    );
  });

  it('uses singular and plural, says zero, and counts down to 1 guess left', () => {
    expect(guessAnnouncement(played(5, 'PLANT', 'SLATE'))).toBe(
      'SLATE: 2 bulls, 1 cow. 9 guesses left.',
    );
    const words = [...Array.from({ length: 8 }, () => 'SLOTH'), 'MUSIC'];
    expect(guessAnnouncement(played(5, 'PLANT', ...words))).toBe(
      'MUSIC: 0 bulls, 0 cows. 1 guess left.',
    );
  });

  it('says nothing before a guess', () => {
    expect(guessAnnouncement(createCodeGame('g', 5, 'PLANT'))).toBe('');
  });

  it('announces a win in the singular and plural, and a loss with the word', () => {
    expect(outcomeAnnouncement(played(5, 'PLANT', 'PLANT'))).toBe('You found PLANT in 1 guess.');
    expect(outcomeAnnouncement(played(5, 'PLANT', 'PANEL', 'PLANT'))).toBe(
      'You found PLANT in 2 guesses.',
    );
    expect(outcomeAnnouncement({ ...played(5, 'PLANT', 'PANEL'), status: 'lost' })).toBe(
      'Game over. The word was PLANT.',
    );
  });
});

describe('CodeStatsModal (FR-134, FR-47)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const record = (id: string, over: Partial<CodeRecord> = {}): CodeRecord => ({
    id,
    playedAt: 1_000,
    length: 5,
    secret: 'PLANT',
    guessesUsed: 5,
    won: true,
    ...over,
  });
  const four = (id: string, over: Partial<CodeRecord> = {}): CodeRecord =>
    record(id, { length: 4, secret: 'LAMB', ...over });

  function seed(build: (stats: CodeStatsState) => CodeStatsState): void {
    createCodeStatsRepository().write(build(defaultCodeStats()));
  }

  function renderModal() {
    return render(
      <ToastProvider>
        <CodeStatsProvider>
          <CodeStatsModal isOpen onClose={vi.fn()} />
        </CodeStatsProvider>
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
    // Oldest first: 5-letter win in 3, 5-letter win in 5, 5-letter loss, 4-letter win in 10.
    // Overall: played 4, won 3, 75%, current streak 1, best 2.
    // 5 letters: played 3, won 2, 67%, current 0, best 2. 4 letters: played 1, 100%.
    seed((s) => {
      let stats = recordCodeGame(s, record('a', { guessesUsed: 3 }));
      stats = recordCodeGame(stats, record('b', { guessesUsed: 5, secret: 'STORM' }));
      stats = recordCodeGame(stats, record('c', { won: false, guessesUsed: 10, secret: 'CRANE' }));
      return recordCodeGame(stats, four('d', { guessesUsed: 10 }));
    });
    const user = userEvent.setup();
    renderModal();

    expect(tile('Played')).toBe('Played4');
    expect(tile('Win %')).toBe('Win %75%');
    expect(tile('Current streak')).toBe('Current streak1');
    expect(tile('Best streak')).toBe('Best streak2');
    const dialog = screen.getByRole('dialog', { name: 'Statistics' });
    expect(dialog).toHaveTextContent('Wins by guesses (1 to 10)');
    expect(dialog.querySelectorAll('[data-has-count]')).toHaveLength(10);
    expect(dialog.querySelectorAll('[data-has-count="true"]')).toHaveLength(3);

    await user.click(within(dialog).getByRole('radio', { name: '5 letters' }));
    expect(tile('Played')).toBe('Played3');
    expect(tile('Win %')).toBe('Win %67%');
    expect(tile('Current streak')).toBe('Current streak0');
    expect(tile('Best streak')).toBe('Best streak2');
    expect(
      within(dialog)
        .getAllByRole('listitem')
        .map((row) => row.textContent),
    ).toEqual(['CRANENot found', 'STORM5/10', 'PLANT3/10']);

    await user.click(within(dialog).getByRole('radio', { name: '4 letters' }));
    expect(tile('Played')).toBe('Played1');
    expect(tile('Win %')).toBe('Win %100%');
    expect(
      within(dialog)
        .getAllByRole('listitem')
        .map((row) => row.textContent),
    ).toEqual(['LAMB10/10']);
  });

  it('keeps the reset actions after a statistics reset, while history remains', async () => {
    seed((s) => recordCodeGame(s, record('a')));
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
