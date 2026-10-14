import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentType } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '@/App';
import { gameKeys, type GameId } from '@/storage';

import { GAMES, GameLoadError, defineGame, type CatalogueEntry } from './catalogue';
import { parseHash, routeHash, routeTitle } from './routes';

/**
 * The static game catalogue (T-74: FR-97, FR-98, FR-99, NFR-20, AC-45, EC-22,
 * EC-50).
 */

function Placeholder({ text }: { text: string }): React.JSX.Element {
  return <main>{text}</main>;
}

/** A game whose view is a plain placeholder, with no providers or word lists. */
function fixture(id: GameId, name: string, route: string, load?: () => Promise<ComponentType>) {
  return defineGame({
    id,
    name,
    description: `${name} description.`,
    route,
    load: load ?? (() => Promise.resolve(() => <Placeholder text={`${name} view`} />)),
  });
}

/** Three games in a deliberate, non-alphabetical order. */
const THREE: readonly CatalogueEntry[] = [
  fixture('weaver', 'Beta', '#/beta'),
  fixture('wordwright', 'Alpha', '#/alpha'),
  fixture('weaver', 'Gamma', '#/gamma'),
].map((entry, index) => ({ ...entry, id: `fixture-${String(index)}` as GameId }));

function goTo(hash: string): void {
  window.history.replaceState(null, '', `/${hash}`);
}

describe('the real catalogue (FR-97, FR-98)', () => {
  it('lists the shipped games in release order: Wordwright, WordWeaver, WordStack, WordRange, WordCode, WordShuffle', () => {
    expect(GAMES.map((game) => game.name)).toEqual([
      'Wordwright',
      'WordWeaver',
      'WordStack',
      'WordRange',
      'WordCode',
      'WordShuffle',
    ]);
  });

  it('has unique ids and routes', () => {
    expect(new Set(GAMES.map((game) => game.id)).size).toBe(GAMES.length);
    expect(new Set(GAMES.map((game) => game.route)).size).toBe(GAMES.length);
  });

  it('gives every entry a name, description, hash route and view', () => {
    for (const game of GAMES) {
      expect(game.name).not.toBe('');
      expect(game.description).not.toBe('');
      expect(game.route).toMatch(/^#\/[a-z]+$/);
      expect(game.View).toBeDefined();
      expect(typeof game.load).toBe('function');
    }
  });

  it('uses the FR-98 routes for the games that have shipped', () => {
    expect(Object.fromEntries(GAMES.map((game) => [game.id, game.route]))).toMatchObject({
      wordwright: '#/wordwright',
      weaver: '#/weaver',
      stack: '#/stack',
      range: '#/range',
      code: '#/code',
      shuffle: '#/shuffle',
    });
  });

  it('does not list a game that has not shipped, so its route goes Home (FR-97, EC-22)', () => {
    for (const hash of ['#/hangman', '#/crossword']) {
      expect(parseHash(hash)).toBe('home');
    }
  });

  it('maps its routes to storage keys that match FR-68, so no stored data moves (FR-99)', () => {
    expect(gameKeys('wordwright')).toEqual({
      prefs: 'wordgames:v1:wordwright:prefs',
      stats: 'wordgames:v1:wordwright:stats',
      session: 'wordgames:v1:wordwright:session',
      meta: 'wordgames:v1:wordwright:meta',
    });
    expect(gameKeys('weaver')).toEqual({
      prefs: 'wordgames:v1:weaver:prefs',
      stats: 'wordgames:v1:weaver:stats',
      session: 'wordgames:v1:weaver:session',
      meta: 'wordgames:v1:weaver:meta',
    });
  });
});

describe('routing over a fixture catalogue (AC-45)', () => {
  it('parses each route to its entry and anything else to Home', () => {
    expect(parseHash('#/beta', THREE)).toBe('fixture-0');
    expect(parseHash('#/alpha', THREE)).toBe('fixture-1');
    expect(parseHash('#/gamma', THREE)).toBe('fixture-2');
    for (const hash of ['', '#/', '#/delta', '#beta', '#/beta/', '#/weaver']) {
      expect(parseHash(hash, THREE)).toBe('home');
    }
  });

  it('round-trips routes and titles through the catalogue', () => {
    for (const entry of THREE) {
      expect(routeHash(entry.id, THREE)).toBe(entry.route);
      expect(routeTitle(entry.id, THREE)).toBe(`${entry.name} · wordgames`);
    }
    expect(routeHash('home', THREE)).toBe('#/');
    expect(routeTitle('home', THREE)).toBe('wordgames');
  });
});

describe('the shell over a fixture catalogue', () => {
  beforeEach(() => {
    localStorage.clear();
    goTo('');
  });

  afterEach(() => {
    goTo('');
  });

  it('shows one card per entry on Home, in catalogue order (FR-97)', () => {
    render(<App games={THREE} />);

    const links = within(screen.getByRole('list')).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '#/beta',
      '#/alpha',
      '#/gamma',
    ]);
    expect(links.map((link) => link.getAttribute('aria-label'))).toEqual([
      'Play Beta',
      'Play Alpha',
      'Play Gamma',
    ]);
    expect(screen.getByRole('link', { name: 'Play Alpha' })).toHaveAccessibleDescription(
      'Alpha description.',
    );
  });

  it.each([
    ['#/beta', 'Beta'],
    ['#/alpha', 'Alpha'],
    ['#/gamma', 'Gamma'],
  ])('shows the right <h1>, title and view on %s', async (hash, name) => {
    goTo(hash);
    render(<App games={THREE} />);

    expect(await screen.findByText(`${name} view`)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(name);
    expect(document.title).toBe(`${name} · wordgames`);
    expect(screen.getByRole('link', { name: 'All games' })).toBeInTheDocument();
  });

  it('sends a route that is not in the catalogue Home, without a new history entry (EC-22)', () => {
    goTo('#/stack');
    const before = window.history.length;

    render(<App games={THREE} />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('wordgames');
    expect(window.location.hash).toBe('#/');
    expect(window.history.length).toBe(before);
  });

  it('sends a route that is not a game Home in the real app', () => {
    goTo('#/hangman');

    render(<App />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('wordgames');
    expect(screen.getAllByRole('listitem')).toHaveLength(GAMES.length);
  });

  it('shows a loading fallback while a game chunk downloads, with the header already there', async () => {
    let finish: (view: ComponentType) => void = () => undefined;
    const slow = fixture(
      'weaver',
      'Slow',
      '#/slow',
      () => new Promise<ComponentType>((resolve) => (finish = resolve)),
    );
    goTo('#/slow');

    render(<App games={[slow]} />);

    // The <h1> and title come from the catalogue, so they exist before the chunk does.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Slow');
    expect(document.title).toBe('Slow · wordgames');
    expect(screen.getByText('Loading…')).toBeInTheDocument();

    finish(() => <Placeholder text="Slow view" />);
    expect(await screen.findByText('Slow view')).toBeInTheDocument();
  });

  it('loads a game view only when its route opens (NFR-20)', async () => {
    const load = vi.fn(() => Promise.resolve(() => <Placeholder text="Lazy view" />));
    const lazyGame = fixture('weaver', 'Lazy', '#/lazy', load);

    render(<App games={[lazyGame]} />);

    expect(load).not.toHaveBeenCalled();
    const user = userEvent.setup();
    await user.click(screen.getByRole('link', { name: 'Play Lazy' }));
    expect(await screen.findByText('Lazy view')).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(1);
  });
});

describe('a game chunk that fails to load (EC-50)', () => {
  beforeEach(() => {
    localStorage.clear();
    // The panel is expected; keep React's error logging out of the test output.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    goTo('');
  });

  it('shows an inline panel with Retry and All games, not the crash screen', async () => {
    const broken = fixture('weaver', 'Broken', '#/broken', () =>
      Promise.reject(new Error('Failed to fetch dynamically imported module')),
    );
    goTo('#/broken');

    render(<App games={[broken]} />);

    expect(await screen.findByText("Couldn't load this game.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: 'All games' });
    expect(links.some((link) => link.getAttribute('href') === '#/')).toBe(true);
    // No error boundary: the header is still there and nothing says it crashed.
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Broken');
  });

  it('Retry loads the game once the chunk is available again', async () => {
    let attempts = 0;
    const flaky = fixture('weaver', 'Flaky', '#/flaky', () => {
      attempts += 1;
      return attempts === 1
        ? Promise.reject(new Error('offline'))
        : Promise.resolve(() => <Placeholder text="Flaky view" />);
    });
    goTo('#/flaky');
    const user = userEvent.setup();
    render(<App games={[flaky]} />);

    await user.click(await screen.findByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Flaky view')).toBeInTheDocument();
    expect(attempts).toBe(2);
    expect(screen.queryByText("Couldn't load this game.")).not.toBeInTheDocument();
  });

  it('keeps the panel if Retry fails again', async () => {
    const broken = fixture('weaver', 'Broken', '#/broken', () =>
      Promise.reject(new Error('still offline')),
    );
    goTo('#/broken');
    const user = userEvent.setup();
    render(<App games={[broken]} />);

    await user.click(await screen.findByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(screen.getByText("Couldn't load this game.")).toBeInTheDocument();
    });
  });

  it('All games leaves the panel for Home', async () => {
    const broken = fixture('weaver', 'Broken', '#/broken', () => Promise.reject(new Error('x')));
    goTo('#/broken');
    const user = userEvent.setup();
    render(<App games={[broken]} />);
    await screen.findByText("Couldn't load this game.");

    // Both the header and the panel have an All games link; use the panel's.
    const panel = screen
      .getByText("Couldn't load this game.")
      .closest('[role="alert"]') as HTMLElement;
    await user.click(within(panel).getByRole('link', { name: 'All games' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('wordgames');
    });
  });

  it('still sends a crash inside a loaded game to the app error boundary', async () => {
    function Crashes(): React.JSX.Element {
      throw new Error('boom');
    }
    const crashing = fixture('weaver', 'Crashing', '#/crash', () => Promise.resolve(Crashes));
    goTo('#/crash');

    render(<App games={[crashing]} />);

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load this game.")).not.toBeInTheDocument();
  });

  it('wraps a loader failure in a GameLoadError', async () => {
    const entry = fixture('weaver', 'X', '#/x', () => Promise.reject(new Error('nope')));

    await expect(entry.load()).rejects.toBeInstanceOf(GameLoadError);
    await expect(entry.load()).rejects.toMatchObject({ message: "Couldn't load this game." });
  });
});
