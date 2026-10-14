import { act, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetDictionaryCache } from '@/dictionary';
import { DICTIONARY_REGISTRY } from '@/dictionary/registry';
import type { WordLength } from '@/engine';
import { gameKeys } from '@/storage';
import { FIXTURE_LISTS } from '@/test/fixtures';
import { Providers } from '@/test/renderWithProviders';

import { useGame } from './contexts';
import type { GameContextValue } from './GameProvider';

const actions: { current: GameContextValue | null } = { current: null };

/** Exposes the provider's actions to the test without any UI. */
function Probe(): React.JSX.Element {
  const game = useGame();
  useEffect(() => {
    actions.current = game;
  });
  return <p>{game.dictionaryStatus}</p>;
}

describe('GameProvider session persistence (FR-65, EC-24)', () => {
  beforeEach(() => {
    resetDictionaryCache();
    localStorage.clear();
    vi.spyOn(
      DICTIONARY_REGISTRY as Record<WordLength, () => Promise<unknown>>,
      5,
    ).mockResolvedValue({ ...FIXTURE_LISTS[5], answers: ['CRANE'] });
  });

  afterEach(() => {
    resetDictionaryCache();
    vi.restoreAllMocks();
  });

  it('writes the last keystroke when the view unmounts inside the debounce window', async () => {
    const { unmount } = render(
      <Providers>
        <Probe />
      </Providers>,
    );
    await waitFor(() => {
      expect(screen.getByText('ready')).toBeInTheDocument();
    });

    // Let the fresh game's own debounced write land, so the next assertion
    // can only be satisfied by the unmount flush.
    await waitFor(() => {
      expect(localStorage.getItem(gameKeys('wordwright').session)).not.toBeNull();
    });

    act(() => {
      actions.current?.addLetter('C');
    });
    const beforeUnmount = JSON.parse(
      localStorage.getItem(gameKeys('wordwright').session) ?? 'null',
    ) as { currentInput: string };
    expect(beforeUnmount.currentInput).toBe('');

    unmount();

    const stored = JSON.parse(localStorage.getItem(gameKeys('wordwright').session) ?? 'null') as {
      currentInput: string;
    };
    expect(stored.currentInput).toBe('C');
  });

  it("stores the length choice in Wordwright's own prefs, not in shared settings (FR-67)", async () => {
    vi.spyOn(
      DICTIONARY_REGISTRY as Record<WordLength, () => Promise<unknown>>,
      6,
    ).mockResolvedValue({ ...FIXTURE_LISTS[6], answers: ['SILVER'] });
    render(
      <Providers>
        <Probe />
      </Providers>,
    );
    await waitFor(() => {
      expect(screen.getByText('ready')).toBeInTheDocument();
    });

    act(() => {
      actions.current?.setWordLength(6);
    });

    expect(localStorage.getItem(gameKeys('wordwright').prefs)).toBe('{"defaultWordLength":6}');
    expect(localStorage.getItem('wordgames:v1:settings')).toBeNull();
  });

  it('opens on the length saved in prefs (FR-46)', async () => {
    localStorage.setItem(gameKeys('wordwright').prefs, '{"defaultWordLength":4}');
    const four = vi.spyOn(DICTIONARY_REGISTRY as Record<WordLength, () => Promise<unknown>>, 4);
    four.mockResolvedValue({ ...FIXTURE_LISTS[4], answers: ['WORD'] });

    render(
      <Providers>
        <Probe />
      </Providers>,
    );

    await waitFor(() => {
      expect(four).toHaveBeenCalled();
    });
  });
});
