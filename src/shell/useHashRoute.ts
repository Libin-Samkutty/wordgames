import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

import { GAMES, type CatalogueEntry } from './catalogue';
import { parseHash, routeHash, routeTitle, type RouteView } from './routes';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => {
    window.removeEventListener('hashchange', onChange);
  };
}

function getServerSnapshot(): RouteView {
  return 'home';
}

/** Moves focus to the view's single `<h1>` (A11Y-15). */
function focusHeading(): void {
  document.querySelector<HTMLElement>('h1')?.focus();
}

/**
 * The current view, taken from the URL hash (FR-62, ADR-022).
 *
 * Built on `useSyncExternalStore` over `hashchange`, so Back and Forward need
 * no extra code. The hash is looked up in the game catalogue (ADR-028). It
 * also owns the side effects of being on a view:
 *   - an empty or unknown hash is corrected with `replaceState`, which adds no
 *     history entry (EC-22);
 *   - `document.title` follows the view (FR-66);
 *   - after a view *change* (not the first render), focus moves to the new
 *     `<h1>` so a keyboard or screen-reader user lands on the new page
 *     (A11Y-15). The `<h1>` carries `tabindex="-1"` so it can take focus.
 *
 * Closing open dialogs on a change is left to the caller, which owns them.
 */
export function useHashRoute(games: readonly CatalogueEntry[] = GAMES): RouteView {
  const getSnapshot = useCallback((): RouteView => parseHash(window.location.hash, games), [games]);
  const view = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const previousView = useRef<RouteView | null>(null);

  useEffect(() => {
    const canonical = routeHash(view, games);
    if (window.location.hash !== canonical) {
      const { pathname, search } = window.location;
      window.history.replaceState(window.history.state, '', `${pathname}${search}${canonical}`);
    }

    document.title = routeTitle(view, games);

    if (previousView.current !== null && previousView.current !== view) focusHeading();
    previousView.current = view;
  }, [view, games]);

  return view;
}
