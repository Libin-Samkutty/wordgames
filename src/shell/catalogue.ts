import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

import type { GameId } from '@/storage';

/**
 * The static game catalogue (FR-97, ADR-028): one ordered, read-only list of
 * the games that are shipped. Home renders a card per entry, the route parser
 * looks a hash up in it, and the page title and `<h1>` come from `name`.
 *
 * It holds only what the shell needs to list, route to and title a game. It is
 * not a plugin system: nothing registers at runtime, and the games share no
 * engine, provider or storage interface (ADR-021, ADR-028).
 */
export interface CatalogueEntry {
  readonly id: GameId;
  /** Shown on the Home card, as the header `<h1>` and in the page title. */
  readonly name: string;
  /** One line, shown on the Home card. */
  readonly description: string;
  /** The URL hash that opens the game, for example `#/weaver` (FR-98). */
  readonly route: string;
  /** The game's view, loaded when its route opens (NFR-20). Mounts its own providers. */
  readonly View: LazyExoticComponent<ComponentType>;
  /**
   * The loader behind `View`. The shell calls it again for **Retry** after a
   * chunk fails to load, because a rejected `React.lazy` stays rejected (EC-50).
   */
  readonly load: () => Promise<ComponentType>;
}

/** A game's code could not be loaded, for example after a deploy while the tab was open (EC-50). */
export class GameLoadError extends Error {
  constructor(cause?: unknown) {
    super("Couldn't load this game.");
    this.name = 'GameLoadError';
    if (cause !== undefined) this.cause = cause;
  }
}

/**
 * Wraps a game's loader so a failure is a `GameLoadError`, which the shell
 * shows as an inline panel. Any other error, thrown while the game renders,
 * is a real crash and still reaches the app's error boundary.
 */
export function guardedLoad(load: () => Promise<ComponentType>): () => Promise<ComponentType> {
  return () =>
    load().catch((cause: unknown) => {
      throw new GameLoadError(cause);
    });
}

/** Builds an entry: the metadata plus a lazy view over the guarded loader. */
export function defineGame(
  entry: Omit<CatalogueEntry, 'View' | 'load'> & { load: () => Promise<ComponentType> },
): CatalogueEntry {
  const load = guardedLoad(entry.load);
  return {
    ...entry,
    load,
    View: lazy(() => load().then((component) => ({ default: component }))),
  };
}

/**
 * Every shipped game, in Home order. A game is added here in the release that
 * ships it, and until then its route is unknown and goes Home (FR-97, EC-22).
 */
export const GAMES: readonly CatalogueEntry[] = [
  defineGame({
    id: 'wordwright',
    name: 'WordWright',
    description: 'Guess the hidden word in six tries.',
    route: '#/wordwright',
    load: () => import('@/components/game/WordwrightView').then((m) => m.WordwrightView),
  }),
  defineGame({
    id: 'weaver',
    name: 'WordWeaver',
    description: 'Change one letter at a time to climb from one word to another.',
    route: '#/weaver',
    load: () => import('@/components/weaver/WeaverView').then((m) => m.WeaverView),
  }),
  defineGame({
    id: 'stack',
    name: 'WordStack',
    description: 'Solve two or four Wordle boards at once. Every guess plays on all of them.',
    route: '#/stack',
    load: () => import('@/components/stack/StackView').then((m) => m.StackView),
  }),
  defineGame({
    id: 'range',
    name: 'WordRange',
    description: 'Find the hidden word by narrowing the range between two words.',
    route: '#/range',
    load: () => import('@/components/range/RangeView').then((m) => m.RangeView),
  }),
  defineGame({
    id: 'code',
    name: 'WordCode',
    description: 'Crack the word from bull and cow counts. No tile colours, only numbers.',
    route: '#/code',
    load: () => import('@/components/code/CodeView').then((m) => m.CodeView),
  }),
  defineGame({
    id: 'shuffle',
    name: 'WordShuffle',
    description: 'Unscramble the letters into a real word. Any valid anagram wins.',
    route: '#/shuffle',
    load: () => import('@/components/shuffle/ShuffleView').then((m) => m.ShuffleView),
  }),
];
