import { screen, waitFor, within } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '@/App';
import { resetDictionaryCache } from '@/dictionary';
import { DICTIONARY_REGISTRY } from '@/dictionary/registry';
import type { WordLength } from '@/engine';

import { FIXTURE_LISTS } from './fixtures';
import { renderWithProviders } from './renderWithProviders';

/**
 * Restart, length change and reset confirmations (T-52: FR-21, FR-34, FR-47,
 * EC-15, US-6, AC-10).
 */

type User = ReturnType<typeof userEvent.setup>;

const ANSWERS: Record<WordLength, string> = { 4: 'WORD', 5: 'CRANE', 6: 'SILVER' };

function useReducedMotion(): void {
  // These flows are Wordwright's: open its view rather than Home.
  window.history.replaceState(null, '', '/#/wordwright');
  localStorage.setItem(
    'wordgames:v1:settings',
    JSON.stringify({ theme: 'system', colorblind: false, motion: 'reduced' }),
  );
}

/** Pins the answer for every length so wins are reproducible. */
function useFixtureDictionaries(): void {
  for (const length of [4, 5, 6] as const) {
    vi.spyOn(
      DICTIONARY_REGISTRY as Record<WordLength, () => Promise<unknown>>,
      length,
    ).mockResolvedValue({ ...FIXTURE_LISTS[length], answers: [ANSWERS[length]] });
  }
}

async function typeWord(user: User, word: string): Promise<void> {
  for (const letter of word) {
    await user.click(await screen.findByRole('button', { name: new RegExp(`^${letter}(,|$)`) }));
  }
}

async function submit(user: User): Promise<void> {
  await user.click(await screen.findByRole('button', { name: 'Enter' }));
}

async function settle(): Promise<void> {
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Enter' })).not.toBeDisabled();
  });
}

/** Plays one wrong guess so a game is in progress. */
async function playOneGuess(user: User, word = 'SLOTH'): Promise<void> {
  await screen.findByRole('grid');
  await typeWord(user, word);
  await submit(user);
  await settle();
}

function firstRowCells(): HTMLElement[] {
  const row = within(screen.getByRole('grid')).getAllByRole('row')[0] as HTMLElement;
  return within(row).getAllByRole('gridcell');
}

async function statsGamesPlayed(user: User): Promise<string> {
  await user.click(screen.getByRole('button', { name: 'Statistics' }));
  const dialog = await screen.findByRole('dialog');
  const text = within(dialog).queryByText(/No games yet/)
    ? '0'
    : (within(dialog).getByText('Played').closest('div')?.textContent ?? '');
  await user.keyboard('{Escape}');
  return text;
}

describe('restart and length change', () => {
  beforeEach(() => {
    resetDictionaryCache();
    localStorage.clear();
    useReducedMotion();
    useFixtureDictionaries();
  });

  afterEach(() => {
    resetDictionaryCache();
    vi.restoreAllMocks();
  });

  it('restarts without asking when no guess has been made (FR-34)', async () => {
    const { user } = renderWithProviders(<App />);
    await screen.findByRole('grid');

    await user.click(screen.getByRole('button', { name: 'New game' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('asks before restarting once a guess exists, and Cancel keeps the board (FR-34, US-6)', async () => {
    const { user } = renderWithProviders(<App />);
    await playOneGuess(user);

    await user.click(screen.getByRole('button', { name: 'New game' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveAccessibleName('Start a new game?');

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(firstRowCells()[0]).toHaveAccessibleName(/S, not in word/);
  });

  it('starts a fresh board on confirm with no statistics change (FR-34, FR-24)', async () => {
    const { user } = renderWithProviders(<App />);
    await playOneGuess(user);

    await user.click(screen.getByRole('button', { name: 'New game' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'New game' }),
    );

    await waitFor(() => {
      expect(firstRowCells()[0]).toHaveAccessibleName(/letter 1: empty/);
    });
    expect(await statsGamesPlayed(user)).toBe('0');
  });

  it('confirms a length switch mid-game; Cancel keeps the board (EC-15)', async () => {
    const { user } = renderWithProviders(<App />);
    await playOneGuess(user);

    await user.click(screen.getByRole('radio', { name: new RegExp('^6') }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveAccessibleName('Switch to 6 letters?');

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(firstRowCells()).toHaveLength(5);
    expect(firstRowCells()[0]).toHaveAccessibleName(/S, not in word/);
    expect(screen.getByRole('radio', { name: new RegExp('^5') })).toBeChecked();
  });

  it('switches from 5 to 6 letters on confirm with stats unchanged (AC-10)', async () => {
    const { user } = renderWithProviders(<App />);
    await playOneGuess(user);

    await user.click(screen.getByRole('radio', { name: new RegExp('^6') }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Switch' }),
    );

    await waitFor(() => {
      expect(firstRowCells()).toHaveLength(6);
    });
    expect(firstRowCells()[0]).toHaveAccessibleName(/letter 1: empty/);
    expect(await statsGamesPlayed(user)).toBe('0');
  });

  it('switches length without asking when no guess has been made', async () => {
    const { user } = renderWithProviders(<App />);
    await screen.findByRole('grid');

    await user.click(screen.getByRole('radio', { name: new RegExp('^4') }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(firstRowCells()).toHaveLength(4);
    });
  });

  it('offers Change length on the result panel without a confirmation (FR-21)', async () => {
    const { user } = renderWithProviders(<App />);
    await screen.findByRole('grid');
    await typeWord(user, 'CRANE');
    await submit(user);
    await screen.findByRole('heading', { name: 'You won!' });

    await user.click(screen.getByRole('button', { name: 'Change length' }));
    const group = screen.getByRole('group', { name: 'New game length' });
    expect(within(group).queryByRole('button', { name: '5 letters' })).not.toBeInTheDocument();
    await user.click(within(group).getByRole('button', { name: '4 letters' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(firstRowCells()).toHaveLength(4);
    });
    expect(screen.queryByRole('heading', { name: 'You won!' })).not.toBeInTheDocument();
  });

  it('does not ask to restart from a finished game (FR-34)', async () => {
    const { user } = renderWithProviders(<App />);
    await screen.findByRole('grid');
    await typeWord(user, 'CRANE');
    await submit(user);
    await screen.findByRole('heading', { name: 'You won!' });

    await user.click(screen.getByRole('button', { name: 'New game' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'You won!' })).not.toBeInTheDocument();
    });
  });
});

describe('reset confirmations use the shared dialog (FR-47)', () => {
  beforeEach(() => {
    resetDictionaryCache();
    localStorage.clear();
    useReducedMotion();
    useFixtureDictionaries();
  });

  afterEach(() => {
    resetDictionaryCache();
    vi.restoreAllMocks();
  });

  async function winAndOpenStats(user: User): Promise<HTMLElement> {
    await screen.findByRole('grid');
    await typeWord(user, 'CRANE');
    await submit(user);
    await screen.findByRole('heading', { name: 'You won!' });
    await user.click(screen.getByRole('button', { name: 'Statistics' }));
    return screen.findByRole('dialog', { name: 'Statistics' });
  }

  it('names exactly what Reset statistics deletes, and Cancel deletes nothing', async () => {
    const { user } = renderWithProviders(<App />);
    const stats = await winAndOpenStats(user);

    await user.click(within(stats).getByRole('button', { name: 'Reset statistics' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent(/games played, streaks, distribution and scores/);
    expect(dialog).toHaveTextContent(/recent games list is kept/);

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await user.keyboard('{Escape}');

    expect(await statsGamesPlayed(user)).toContain('1');
  });

  it('names exactly what Reset history deletes', async () => {
    const { user } = renderWithProviders(<App />);
    const stats = await winAndOpenStats(user);

    await user.click(within(stats).getByRole('button', { name: 'Reset history' }));

    expect(await screen.findByRole('alertdialog')).toHaveTextContent(
      'Permanently delete your recent games list? Your statistics are kept.',
    );
  });

  it('Escape cancels the confirmation but leaves Statistics open', async () => {
    const { user } = renderWithProviders(<App />);
    const stats = await winAndOpenStats(user);

    await user.click(within(stats).getByRole('button', { name: 'Reset history' }));
    await screen.findByRole('alertdialog');
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Statistics' })).toBeInTheDocument();
  });

  it('deletes on confirm and says so', async () => {
    const { user } = renderWithProviders(<App />);
    const stats = await winAndOpenStats(user);

    await user.click(within(stats).getByRole('button', { name: 'Reset statistics' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );

    expect(await screen.findByRole('button', { name: /Statistics reset/ })).toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).getByText(/No games yet/)).toBeInTheDocument();
    // History was kept, so it can still be cleared.
    expect(screen.getByRole('button', { name: 'Reset history' })).toBeInTheDocument();
  });

  it('clearing history keeps the statistics', async () => {
    const { user } = renderWithProviders(<App />);
    const stats = await winAndOpenStats(user);

    await user.click(within(stats).getByRole('button', { name: 'Reset history' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );

    expect(await screen.findByRole('button', { name: /History reset/ })).toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).queryByText(/Recent games/)).not.toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).getByText('Played').closest('div')).toHaveTextContent(
      '1',
    );
  });

  it('Settings has no destructive actions of its own', async () => {
    const { user } = renderWithProviders(<App />);
    await screen.findByRole('grid');

    await user.click(screen.getByRole('button', { name: 'Settings' }));

    const dialog = await screen.findByRole('dialog', { name: 'Settings' });
    expect(within(dialog).queryByRole('button', { name: /Reset/ })).not.toBeInTheDocument();
  });
});
