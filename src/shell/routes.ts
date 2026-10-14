import type { GameId } from '@/storage';

import { GAMES, type CatalogueEntry } from './catalogue';

/**
 * The suite's views and their URL hashes (FR-62, ADR-022, ADR-028).
 *
 * A view is Home or a game in the catalogue. Every lookup takes the catalogue
 * as a parameter, defaulting to the real one, so tests can route over a small
 * fixture catalogue.
 */
export type RouteView = 'home' | GameId;

export const HOME_HASH = '#/';

export const SUITE_NAME = 'wordgames';

/** The catalogue entry for a view, or undefined for Home. */
export function entryFor(
  view: RouteView,
  games: readonly CatalogueEntry[] = GAMES,
): CatalogueEntry | undefined {
  return games.find((game) => game.id === view);
}

export function routeHash(view: RouteView, games: readonly CatalogueEntry[] = GAMES): string {
  return entryFor(view, games)?.route ?? HOME_HASH;
}

/** `wordgames` on Home, `WordWright · wordgames` in a game (FR-66). */
export function routeTitle(view: RouteView, games: readonly CatalogueEntry[] = GAMES): string {
  const entry = entryFor(view, games);
  return entry ? `${entry.name} · ${SUITE_NAME}` : SUITE_NAME;
}

/**
 * Maps a URL hash to a view. Anything that is not exactly the route of a
 * catalogue entry, including an empty hash, `#weaver` and `#/foo`, is Home
 * (FR-62, FR-97, EC-22). A game that has not shipped has no entry, so its
 * route goes Home too.
 */
export function parseHash(hash: string, games: readonly CatalogueEntry[] = GAMES): RouteView {
  return games.find((game) => game.route === hash)?.id ?? 'home';
}
