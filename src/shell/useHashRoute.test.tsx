import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { parseHash, routeHash, routeTitle } from './routes';
import { useHashRoute } from './useHashRoute';

/**
 * Hash routing (T-54: FR-62, FR-66, A11Y-15, EC-22, AC-25, AC-26).
 *
 * jsdom implements `hashchange`, `history.back()` and `replaceState`, so these
 * drive the real browser APIs rather than a stub.
 */

function Harness(): React.JSX.Element {
  const view = useHashRoute();

  return (
    <div>
      <h1 tabIndex={-1}>{view}</h1>
      <a href="#/weaver">to weaver</a>
    </div>
  );
}

function setHash(hash: string): void {
  act(() => {
    window.location.hash = hash;
  });
}

function resetUrl(): void {
  window.history.replaceState(null, '', '/');
}

describe('parseHash (FR-62, EC-22)', () => {
  it.each([
    ['#/', 'home'],
    ['#/wordwright', 'wordwright'],
    ['#/weaver', 'weaver'],
  ])('maps %s to %s', (hash, view) => {
    expect(parseHash(hash)).toBe(view);
  });

  it.each([
    [''],
    ['#'],
    ['#/foo'],
    ['#weaver'],
    ['#/weaver/'],
    ['#/Weaver'],
    ['#/weaver?x=1'],
    ['#/hangman'],
  ])('sends %j to Home', (hash) => {
    expect(parseHash(hash)).toBe('home');
  });

  it('round-trips every view through its hash', () => {
    for (const view of ['home', 'wordwright', 'weaver'] as const) {
      expect(parseHash(routeHash(view))).toBe(view);
    }
  });

  it('titles follow FR-66', () => {
    expect(routeTitle('home')).toBe('WordGames');
    expect(routeTitle('wordwright')).toBe('WordWright · WordGames');
    expect(routeTitle('weaver')).toBe('WordWeaver · WordGames');
  });
});

describe('useHashRoute', () => {
  beforeEach(() => {
    resetUrl();
    document.title = '';
  });

  afterEach(() => {
    resetUrl();
  });

  it('opens a game directly from its hash (AC-26)', () => {
    window.history.replaceState(null, '', '/#/wordwright');

    render(<Harness />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('wordwright');
  });

  it('shows Home for an empty hash and corrects the URL without adding history (EC-22)', () => {
    const before = window.history.length;

    render(<Harness />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('home');
    expect(window.location.hash).toBe('#/');
    expect(window.history.length).toBe(before);
  });

  it.each(['#/foo', '#weaver'])(
    'shows Home for %s and corrects the URL without adding history (EC-22)',
    (hash) => {
      window.history.replaceState(null, '', `/${hash}`);
      const before = window.history.length;

      render(<Harness />);

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('home');
      expect(window.location.hash).toBe('#/');
      expect(window.history.length).toBe(before);
    },
  );

  it('keeps the path and query when it corrects the hash', () => {
    window.history.replaceState(null, '', '/wordgames/?x=1#/nope');

    render(<Harness />);

    expect(window.location.pathname).toBe('/wordgames/');
    expect(window.location.search).toBe('?x=1');
    expect(window.location.hash).toBe('#/');
  });

  it('updates when the hash changes', async () => {
    render(<Harness />);

    setHash('#/weaver');

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('weaver');
    });
  });

  it('follows Back and Forward (AC-25)', async () => {
    render(<Harness />);
    setHash('#/weaver');
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('weaver');
    });

    act(() => {
      window.history.back();
    });
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('home');
    });

    act(() => {
      window.history.forward();
    });
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('weaver');
    });
  });

  it('sets document.title for each view (FR-66)', async () => {
    render(<Harness />);
    expect(document.title).toBe('WordGames');

    setHash('#/wordwright');
    await waitFor(() => {
      expect(document.title).toBe('WordWright · WordGames');
    });

    setHash('#/weaver');
    await waitFor(() => {
      expect(document.title).toBe('WordWeaver · WordGames');
    });
  });

  it('moves focus to the <h1> after a view change (A11Y-15)', async () => {
    render(<Harness />);
    const link = screen.getByRole('link', { name: 'to weaver' });
    link.focus();
    expect(document.activeElement).toBe(link);

    setHash('#/weaver');

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 }));
    });
  });

  it('does not steal focus on the first render', () => {
    window.history.replaceState(null, '', '/#/weaver');

    render(<Harness />);

    expect(document.activeElement).toBe(document.body);
  });

  it('removes its hashchange listener on unmount', () => {
    const { unmount } = render(<Harness />);
    unmount();

    // Would throw "state update on an unmounted component" noise or re-render
    // a stale tree if the listener leaked.
    expect(() => {
      setHash('#/weaver');
    }).not.toThrow();
  });
});
