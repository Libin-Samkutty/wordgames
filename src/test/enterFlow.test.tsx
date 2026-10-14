import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '@/App';
import { resetDictionaryCache } from '@/dictionary';
import { DICTIONARY_REGISTRY } from '@/dictionary/registry';
import type { WordLength } from '@/engine';

import { FIXTURE_LISTS } from './fixtures';

/**
 * Enter to continue on Wordwright's result panel (T-56: FR-72, FR-73,
 * US-24, A11Y-18, EC-36, AC-28), driven with the physical keyboard.
 */

describe('Wordwright: Enter to continue', () => {
  beforeEach(() => {
    resetDictionaryCache();
    localStorage.clear();
    window.history.replaceState(null, '', '/#/wordwright');
    localStorage.setItem(
      'wordgames:v1:settings',
      JSON.stringify({ theme: 'system', colorblind: false, motion: 'reduced' }),
    );
    vi.spyOn(
      DICTIONARY_REGISTRY as Record<WordLength, () => Promise<unknown>>,
      5,
    ).mockResolvedValue({ ...FIXTURE_LISTS[5], answers: ['CRANE'] });
  });

  afterEach(() => {
    resetDictionaryCache();
    vi.restoreAllMocks();
  });

  async function winWithKeyboard(user: ReturnType<typeof userEvent.setup>): Promise<void> {
    await screen.findByRole('grid', { name: 'Guess board' });
    await user.keyboard('CRANE{Enter}');
    await screen.findByRole('heading', { name: 'You won!' });
  }

  it('does not start a new game on the Enter that won, and does on the next (AC-28)', async () => {
    const user = userEvent.setup();
    render(<App />);
    await winWithKeyboard(user);

    // Give any wrongly attached listener time to fire.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByRole('heading', { name: 'You won!' })).toBeInTheDocument();

    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'You won!' })).not.toBeInTheDocument();
    });
    const firstRow = within(screen.getByRole('grid')).getAllByRole('row')[0] as HTMLElement;
    expect(within(firstRow).getAllByRole('gridcell')[0]).toHaveAccessibleName(/letter 1: empty/);
  });

  it('does not move focus when the result panel appears (A11Y-18)', async () => {
    const user = userEvent.setup();
    render(<App />);
    await winWithKeyboard(user);

    expect(screen.getByRole('button', { name: 'Play again' })).not.toHaveFocus();
    expect(document.activeElement).toBe(document.body);
  });

  it('ignores Enter with a dialog open over the result panel (EC-36)', async () => {
    const user = userEvent.setup();
    render(<App />);
    await winWithKeyboard(user);

    await user.click(screen.getByRole('button', { name: 'Statistics' }));
    const dialog = await screen.findByRole('dialog', { name: 'Statistics' });

    // Focus the dialog's own close control so Enter reaches the dialog, not the page.
    await user.keyboard('{Enter}');

    expect(screen.getByRole('heading', { name: 'You won!' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(dialog).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'You won!' })).toBeInTheDocument();
  });

  it('lets a focused Play again button keep its own Enter, starting exactly one game (FR-72)', async () => {
    const user = userEvent.setup();
    render(<App />);
    await winWithKeyboard(user);
    const newGame = vi.spyOn(crypto, 'randomUUID');

    screen.getByRole('button', { name: 'Play again' }).focus();
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'You won!' })).not.toBeInTheDocument();
    });
    expect(newGame).toHaveBeenCalledTimes(1);
  });
});
