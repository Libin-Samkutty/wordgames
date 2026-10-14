import { CURRENT_SCHEMA_VERSION, LEGACY_STORAGE_KEYS, STORAGE_KEYS, gameKeys } from './keys';
import { safeStorage, type SafeStorage } from './safeStorage';

/**
 * One-time copy of the pre-rename `wordwright:v1:*` data into the suite
 * layout (FR-69, ADR-023, ARCHITECTURE §7.7).
 *
 * This is a boot step, not a migration: the migration chain is not wired into
 * any repository. It runs in `main.tsx` before the first render so the game
 * never sees a half-moved store.
 *
 * Guarantees:
 *   - Legacy keys are only ever read. Never changed, never deleted (NFR-17).
 *   - It never throws. On any failure the app carries on with defaults.
 *   - The marker, `wordgames:v1:meta`, is written last, so an interrupted
 *     import runs again on the next load.
 *   - A destination key that already exists is left alone. If an earlier
 *     attempt was interrupted and the player has played since, their new data
 *     wins over the legacy copy (EC-25).
 */

export type LegacyImportResult =
  /** Storage is unavailable, so there is nothing to copy into (EC-27). */
  | 'unavailable'
  /** The marker exists: already imported (EC-25). */
  | 'already-imported'
  /** No legacy data: a new player. */
  | 'nothing-to-import'
  | 'imported'
  /** A copy could not be verified. The marker was not written, so it retries. */
  | 'failed';

export const IMPORT_SOURCE = 'wordwright:v1';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function tryParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/**
 * Splits legacy settings into the shared appearance settings and Wordwright's
 * prefs (FR-67, FR-69, ADR-024).
 *
 * Anything that is not a plain JSON object is copied to the shared key
 * unchanged, so the normal repository read rejects it and resets that slice
 * with one toast (EC-26, EC-12).
 */
function splitSettings(raw: string): { shared: string; prefs: string | null } {
  const parsed = tryParse(raw);
  if (!isPlainObject(parsed)) return { shared: raw, prefs: null };

  const { theme, colorblind, motion, defaultWordLength } = parsed;

  return {
    shared: JSON.stringify({ theme, colorblind, motion }),
    prefs: defaultWordLength === undefined ? null : JSON.stringify({ defaultWordLength }),
  };
}

export function importLegacyData(
  storage: SafeStorage = safeStorage,
  now: () => number = Date.now,
): LegacyImportResult {
  try {
    if (!storage.isPersistent) return 'unavailable';
    if (storage.getItem(STORAGE_KEYS.meta) !== null) return 'already-imported';

    const legacy = {
      settings: storage.getItem(LEGACY_STORAGE_KEYS.settings),
      stats: storage.getItem(LEGACY_STORAGE_KEYS.stats),
      session: storage.getItem(LEGACY_STORAGE_KEYS.session),
      meta: storage.getItem(LEGACY_STORAGE_KEYS.meta),
    };

    if (Object.values(legacy).every((value) => value === null)) return 'nothing-to-import';

    const keys = gameKeys('wordwright');
    const copies: [destination: string, value: string | null][] = [];

    if (legacy.settings !== null) {
      const { shared, prefs } = splitSettings(legacy.settings);
      copies.push([STORAGE_KEYS.settings, shared], [keys.prefs, prefs]);
    }
    copies.push(
      [keys.stats, legacy.stats],
      [keys.session, legacy.session],
      [keys.meta, legacy.meta],
    );

    for (const [destination, value] of copies) {
      if (value === null) continue;
      if (storage.getItem(destination) !== null) continue;

      storage.setItem(destination, value);
      // safeStorage swallows write errors, so confirm the copy landed before
      // the marker says it did.
      if (storage.getItem(destination) !== value) return 'failed';
    }

    const marker = JSON.stringify({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      importedFrom: IMPORT_SOURCE,
      importedAt: now(),
    });
    storage.setItem(STORAGE_KEYS.meta, marker);

    return storage.getItem(STORAGE_KEYS.meta) === marker ? 'imported' : 'failed';
  } catch {
    return 'failed';
  }
}
