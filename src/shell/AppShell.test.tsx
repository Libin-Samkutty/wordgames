import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '@/App';
import { resetDictionaryCache } from '@/dictionary';
import { DICTIONARY_REGISTRY } from '@/dictionary/registry';
import type { WordLength } from '@/engine';
import { FIXTURE_LISTS } from '@/test/fixtures';

/**
 * The suite shell: Home, routing, titles, focus and leaving a game (T-54,
 * T-55: FR-61 … FR-66, A11Y-14, A11Y-15, EC-22, EC-38, AC-24 … AC-26).
 */

function useReducedMotion(): void {
  localStorage.setItem(
    'wordgames:v1:settings',
    JSON.stringify({ theme: 'system', colorblind: false, motion: 'reduced' }),
  );
}

function spyOnRegistry(): Record<WordLength, ReturnType<typeof vi.spyOn>> {
  const registry = DICTIONARY_REGISTRY as Record<WordLength, () => Promise<unknown>>;
  const spies = {} as Record<WordLength, ReturnType<typeof vi.spyOn>>;
  for (const length of [4, 5, 6] as const) {
    spies[length] = vi
      .spyOn(registry, length)
      .mockResolvedValue({ ...FIXTURE_LISTS[length], answers: [FIXTURE_LISTS[length].answers[0]] });
  }
  return spies;
}

function goTo(hash: string): void {
  window.history.replaceState(null, '', `/${hash}`);
}

async function navigate(hash: string): Promise<void> {
  window.location.hash = hash;
  await waitFor(() => {
    expect(window.location.hash).toBe(hash);
  });
}

describe('suite shell', () => {
  beforeEach(() => {
    resetDictionaryCache();
    localStorage.clear();
    useReducedMotion();
    goTo('');
    document.title = '';
  });

  afterEach(() => {
    resetDictionaryCache();
    vi.restoreAllMocks();
    goTo('');
  });

  describe('Home (FR-63, A11Y-14, AC-24)', () => {
    it('lists a card for each game as links with accessible names and descriptions', () => {
      spyOnRegistry();
      render(<App />);

      const list = screen.getByRole('list');
      const links = within(list).getAllByRole('link');

      expect(links.map((link) => link.getAttribute('href'))).toEqual([
        '#/wordwright',
        '#/weaver',
        '#/stack',
        '#/range',
        '#/code',
        '#/shuffle',
      ]);
      expect(screen.getByRole('link', { name: 'Play WordWright' })).toHaveAccessibleDescription(
        /six tries/,
      );
      expect(screen.getByRole('link', { name: 'Play WordWeaver' })).toHaveAccessibleDescription(
        /one letter/,
      );
    });

    it('loads no word list and mounts no game', () => {
      const spies = spyOnRegistry();
      render(<App />);

      for (const length of [4, 5, 6] as const) expect(spies[length]).not.toHaveBeenCalled();
      expect(screen.queryByRole('grid')).not.toBeInTheDocument();
    });

    it('shows the suite name and Settings only in the header (FR-64)', () => {
      spyOnRegistry();
      render(<App />);

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('wordgames');
      expect(screen.queryByRole('link', { name: 'All games' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'How to play' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    });

    it('opens Settings from Home so appearance applies there too (FR-67)', async () => {
      spyOnRegistry();
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole('button', { name: 'Settings' }));
      await user.click(screen.getByRole('radio', { name: 'Dark' }));

      expect(document.documentElement).toHaveClass('dark');
    });
  });

  describe('routing (FR-62, EC-22, AC-25, AC-26)', () => {
    it('opens Wordwright directly without passing through Home (AC-26)', async () => {
      spyOnRegistry();
      goTo('#/wordwright');
      render(<App />);

      expect(await screen.findByRole('grid', { name: 'Guess board' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('WordWright');
    });

    it.each(['#/foo', '#weaver'])(
      'shows Home for %s and does not add a history entry (EC-22)',
      (hash) => {
        spyOnRegistry();
        goTo(hash);
        const before = window.history.length;

        render(<App />);

        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('wordgames');
        expect(window.location.hash).toBe('#/');
        expect(window.history.length).toBe(before);
      },
    );

    it('opens WordWeaver from its card, then Back returns Home (AC-25)', async () => {
      spyOnRegistry();
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole('link', { name: 'Play WordWeaver' }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('WordWeaver');
      });
      expect(window.location.hash).toBe('#/weaver');
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
      });

      window.history.back();
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('wordgames');
      });

      window.history.forward();
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('WordWeaver');
      });
    });

    it('sets the page title for each view (FR-66)', async () => {
      spyOnRegistry();
      render(<App />);
      expect(document.title).toBe('wordgames');

      await navigate('#/wordwright');
      await waitFor(() => {
        expect(document.title).toBe('WordWright · wordgames');
      });

      await navigate('#/weaver');
      await waitFor(() => {
        expect(document.title).toBe('WordWeaver · wordgames');
      });
    });

    it('moves focus to the new <h1> on a view change (A11Y-15)', async () => {
      spyOnRegistry();
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole('link', { name: 'Play WordWright' }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
      });
    });

    it('has exactly one <h1> in every view (A11Y-14)', async () => {
      spyOnRegistry();
      render(<App />);
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);

      await navigate('#/wordwright');
      await screen.findByRole('grid');
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);

      await navigate('#/weaver');
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('WordWeaver');
      });
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    });

    it('closes an open dialog when Back changes the view, and focus goes to the <h1> (EC-38)', async () => {
      spyOnRegistry();
      const user = userEvent.setup();
      goTo('#/');
      render(<App />);

      await user.click(screen.getByRole('link', { name: 'Play WordWright' }));
      await screen.findByRole('grid');
      await user.click(screen.getByRole('button', { name: 'Settings' }));
      expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();

      window.history.back();

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
      });
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('wordgames');
    });

    it('does not reopen Settings when returning to a view it was opened on', async () => {
      spyOnRegistry();
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole('button', { name: 'Settings' }));
      await navigate('#/weaver');
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
      await navigate('#/');

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('game header (FR-64, A11Y-15)', () => {
    it('puts All games first in tab order, then the title, controls and Settings', async () => {
      spyOnRegistry();
      goTo('#/wordwright');
      render(<App />);
      await screen.findByRole('grid');

      const header = screen.getByRole('banner');
      const names = within(header)
        .getAllByRole('link')
        .concat(within(header).getAllByRole('button'), within(header).getAllByRole('radio'))
        .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
        .map((el) => el.getAttribute('aria-label') ?? el.textContent?.trim());

      expect(names[0]).toBe('All games');
      expect(names).toContain('How to play');
      expect(names.at(-1)).toBe('Settings');
      expect(names.indexOf('How to play')).toBeLessThan(names.indexOf('Statistics'));
      expect(names.indexOf('Statistics')).toBeLessThan(names.indexOf('Settings'));
    });
  });

  describe('leaving a game (FR-65, EC-24)', () => {
    it('restores the board, including a letter typed just before leaving', async () => {
      spyOnRegistry();
      const user = userEvent.setup();
      goTo('#/wordwright');
      render(<App />);
      await screen.findByRole('grid');

      // A complete guess, then a letter typed inside the debounce window.
      for (const letter of 'SLOTH') {
        await user.click(screen.getByRole('button', { name: new RegExp(`^${letter}(,|$)`) }));
      }
      await user.click(screen.getByRole('button', { name: 'Enter' }));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Enter' })).not.toBeDisabled();
      });
      await user.click(screen.getByRole('button', { name: /^C(,|$)/ }));

      await user.click(screen.getByRole('link', { name: 'All games' }));
      await screen.findByRole('link', { name: 'Play WordWright' });

      await user.click(screen.getByRole('link', { name: 'Play WordWright' }));
      const grid = await screen.findByRole('grid', { name: 'Guess board' });

      const rows = within(grid).getAllByRole('row');
      expect(within(rows[0] as HTMLElement).getAllByRole('gridcell')[0]).toHaveAccessibleName(
        /letter 1: S, /,
      );
      expect(within(rows[1] as HTMLElement).getAllByRole('gridcell')[0]).toHaveAccessibleName(
        /letter 1: C, entered/,
      );
    });
  });
});
