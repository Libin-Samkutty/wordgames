/**
 * LocalStorage keys (ARCHITECTURE §7.1, §7.6; SPEC FR-68).
 *
 * One namespace for the suite, then one sub-namespace per game. Slices are
 * independent so a corrupt session can never take statistics down with it, and
 * one game's data can never touch another's.
 */

const SUITE_NAMESPACE = 'wordgames';

/** The project's original name. Its keys are read once by the legacy import (T-53). */
const LEGACY_NAMESPACE = 'wordwright';

/** Bumped only for breaking layout changes; field additions use migrations. */
export const STORAGE_VERSION = 'v1';

const prefix = `${SUITE_NAMESPACE}:${STORAGE_VERSION}`;
const legacyPrefix = `${LEGACY_NAMESPACE}:${STORAGE_VERSION}`;

/**
 * Games in the suite. An explicit union, widened when work on a game starts so
 * its storage keys and tests can exist before it has a route (ADR-028).
 */
export type GameId = 'wordwright' | 'weaver' | 'stack' | 'range' | 'code' | 'shuffle' | 'dodge';

/** Keys shared by the whole suite. */
export const STORAGE_KEYS = {
  /** Appearance settings: theme, colourblind, motion (FR-67). */
  settings: `${prefix}:settings`,
  /** Schema version and the legacy-import marker (FR-69). */
  meta: `${prefix}:meta`,
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

export interface GameKeys {
  readonly prefs: string;
  readonly stats: string;
  readonly session: string;
  readonly meta: string;
}

/** The four keys one game owns (FR-68). */
export function gameKeys(gameId: GameId): GameKeys {
  return {
    prefs: `${prefix}:${gameId}:prefs`,
    stats: `${prefix}:${gameId}:stats`,
    session: `${prefix}:${gameId}:session`,
    meta: `${prefix}:${gameId}:meta`,
  };
}

/**
 * The pre-rename Wordwright keys. They are only ever read, by the legacy
 * import and the inline theme script, and never written or deleted (NFR-17).
 */
export const LEGACY_STORAGE_KEYS = {
  settings: `${legacyPrefix}:settings`,
  stats: `${legacyPrefix}:stats`,
  session: `${legacyPrefix}:session`,
  meta: `${legacyPrefix}:meta`,
} as const;

/** True for any key the app has ever owned, in either namespace (FR-71). */
export function isOwnedKey(key: string): boolean {
  return key.startsWith(`${SUITE_NAMESPACE}:`) || key.startsWith(`${LEGACY_NAMESPACE}:`);
}

/** Current schema version for migrations (EC-13). */
export const CURRENT_SCHEMA_VERSION = 1;
