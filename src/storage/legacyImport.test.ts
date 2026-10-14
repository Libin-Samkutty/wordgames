import { describe, expect, it } from 'vitest';

import { createGame } from '@/engine/createGame';

import { importLegacyData } from './legacyImport';
import { LEGACY_STORAGE_KEYS, STORAGE_KEYS, gameKeys } from './keys';
import { createSafeStorage, type SafeStorage } from './safeStorage';
import { createMetaRepository, createSessionRepository } from './sessionRepository';
import { createSettingsRepository } from './settingsRepository';
import { createStatsRepository } from './statsRepository';
import { createWordwrightPrefsRepository } from './prefsRepository';
import { defaultStats, emptyBucket } from './schemas';

/**
 * Legacy import (T-53: FR-69, FR-70, NFR-17, EC-25, EC-26, EC-27, AC-27).
 *
 * Every test runs against an isolated in-memory Storage so it controls
 * exactly which keys exist, and every test that imports asserts the legacy
 * keys are byte-for-byte unchanged afterwards (NFR-17).
 */

const keys = gameKeys('wordwright');

/** A real-looking v1 data set: dark theme, 12 games, a 2-guess game in progress. */
function legacySet(): Record<string, string> {
  const stats = defaultStats();
  const twelve = {
    ...emptyBucket(),
    gamesPlayed: 12,
    gamesWon: 9,
    currentStreak: 3,
    bestStreak: 5,
  };
  const game = {
    ...createGame({ id: 'g-legacy', wordLength: 5, answer: 'CRANE' }),
    status: 'playing' as const,
    guesses: [
      { word: 'SLOTH', evaluation: ['absent', 'absent', 'absent', 'absent', 'absent'] },
      { word: 'STAMP', evaluation: ['absent', 'absent', 'present', 'absent', 'absent'] },
    ],
  };

  return {
    [LEGACY_STORAGE_KEYS.settings]: JSON.stringify({
      theme: 'dark',
      colorblind: true,
      motion: 'reduced',
      defaultWordLength: 6,
    }),
    [LEGACY_STORAGE_KEYS.stats]: JSON.stringify({
      ...stats,
      overall: twelve,
      perLength: { ...stats.perLength, 5: twelve },
    }),
    [LEGACY_STORAGE_KEYS.session]: JSON.stringify(game),
    [LEGACY_STORAGE_KEYS.meta]: JSON.stringify({
      schemaVersion: 1,
      recentAnswers: { 4: [], 5: ['CRANE'], 6: [] },
    }),
  };
}

/** A Storage backed by a Map, wrapped so it probes as persistent. */
function makeStorage(initial: Record<string, string> = {}): {
  storage: SafeStorage;
  backend: Map<string, string>;
} {
  const backend = new Map(Object.entries(initial));
  const raw: Storage = {
    get length() {
      return backend.size;
    },
    key: (index) => [...backend.keys()][index] ?? null,
    getItem: (key) => backend.get(key) ?? null,
    setItem: (key, value) => {
      backend.set(key, value);
    },
    removeItem: (key) => {
      backend.delete(key);
    },
    clear: () => {
      backend.clear();
    },
  };

  return { storage: createSafeStorage(raw), backend };
}

function legacySnapshot(backend: Map<string, string>): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.values(LEGACY_STORAGE_KEYS).map((key) => [key, backend.get(key)]),
  );
}

const FIXED_NOW = 1_700_000_000_000;

describe('importLegacyData', () => {
  it('copies a full legacy set to the new layout (FR-69, AC-27)', () => {
    const legacy = legacySet();
    const { storage, backend } = makeStorage(legacy);
    const before = legacySnapshot(backend);

    expect(importLegacyData(storage, () => FIXED_NOW)).toBe('imported');

    // Settings are split: appearance is shared, the length belongs to Wordwright.
    expect(JSON.parse(backend.get(STORAGE_KEYS.settings) ?? 'null')).toEqual({
      theme: 'dark',
      colorblind: true,
      motion: 'reduced',
    });
    expect(JSON.parse(backend.get(keys.prefs) ?? 'null')).toEqual({ defaultWordLength: 6 });

    // Everything else is copied byte for byte.
    expect(backend.get(keys.stats)).toBe(legacy[LEGACY_STORAGE_KEYS.stats]);
    expect(backend.get(keys.session)).toBe(legacy[LEGACY_STORAGE_KEYS.session]);
    expect(backend.get(keys.meta)).toBe(legacy[LEGACY_STORAGE_KEYS.meta]);

    expect(JSON.parse(backend.get(STORAGE_KEYS.meta) ?? 'null')).toEqual({
      schemaVersion: 1,
      importedFrom: 'wordwright:v1',
      importedAt: FIXED_NOW,
    });

    expect(legacySnapshot(backend)).toEqual(before);
  });

  it('produces data the normal repositories read back correctly (US-23)', () => {
    const { storage, backend } = makeStorage(legacySet());
    importLegacyData(storage);

    // The repositories read the real global store, so mirror the backend into it.
    for (const [key, value] of backend) localStorage.setItem(key, value);

    expect(createSettingsRepository().read()).toEqual({
      theme: 'dark',
      colorblind: true,
      motion: 'reduced',
    });
    expect(createWordwrightPrefsRepository().read()).toEqual({ defaultWordLength: 6 });
    expect(createStatsRepository('wordwright').read().overall.gamesPlayed).toBe(12);
    expect(createSessionRepository('wordwright').read()?.guesses).toHaveLength(2);
    expect(createMetaRepository('wordwright').read().recentAnswers[5]).toEqual(['CRANE']);
  });

  it('imports a partial set and leaves the missing slices absent', () => {
    const only = { [LEGACY_STORAGE_KEYS.stats]: legacySet()[LEGACY_STORAGE_KEYS.stats] as string };
    const { storage, backend } = makeStorage(only);

    expect(importLegacyData(storage)).toBe('imported');

    expect(backend.get(keys.stats)).toBe(only[LEGACY_STORAGE_KEYS.stats]);
    expect(backend.has(STORAGE_KEYS.settings)).toBe(false);
    expect(backend.has(keys.prefs)).toBe(false);
    expect(backend.has(keys.session)).toBe(false);
    expect(backend.has(keys.meta)).toBe(false);
    expect(backend.has(STORAGE_KEYS.meta)).toBe(true);
    expect(legacySnapshot(backend)).toEqual({
      [LEGACY_STORAGE_KEYS.settings]: undefined,
      [LEGACY_STORAGE_KEYS.stats]: only[LEGACY_STORAGE_KEYS.stats],
      [LEGACY_STORAGE_KEYS.session]: undefined,
      [LEGACY_STORAGE_KEYS.meta]: undefined,
    });
  });

  it('does not write a prefs key when legacy settings have no length', () => {
    const { storage, backend } = makeStorage({
      [LEGACY_STORAGE_KEYS.settings]: JSON.stringify({
        theme: 'light',
        colorblind: false,
        motion: 'system',
      }),
    });

    importLegacyData(storage);

    expect(backend.has(keys.prefs)).toBe(false);
    expect(backend.has(STORAGE_KEYS.settings)).toBe(true);
  });

  it('copies corrupt legacy JSON as-is and the normal read resets it (EC-26)', () => {
    const corrupt = {
      [LEGACY_STORAGE_KEYS.settings]: '{ not json',
      [LEGACY_STORAGE_KEYS.stats]: '"a string, not an object"',
      [LEGACY_STORAGE_KEYS.session]: '{ also broken',
    };
    const { storage, backend } = makeStorage(corrupt);
    const before = legacySnapshot(backend);

    expect(importLegacyData(storage)).toBe('imported');

    expect(backend.get(STORAGE_KEYS.settings)).toBe('{ not json');
    expect(backend.get(keys.stats)).toBe('"a string, not an object"');
    expect(backend.get(keys.session)).toBe('{ also broken');
    expect(backend.has(keys.prefs)).toBe(false);
    expect(legacySnapshot(backend)).toEqual(before);

    // The usual repository path then recovers each slice with a warning.
    for (const [key, value] of backend) localStorage.setItem(key, value);
    const issues: string[] = [];
    expect(createSettingsRepository((issue) => issues.push(issue)).read().theme).toBe('system');
    expect(createStatsRepository('wordwright', (issue) => issues.push(issue)).read()).toEqual(
      defaultStats(),
    );
    expect(issues).toEqual(['corrupt', 'corrupt']);
  });

  it('copies legacy settings that are valid JSON but not an object as-is', () => {
    const { storage, backend } = makeStorage({ [LEGACY_STORAGE_KEYS.settings]: '[]' });

    importLegacyData(storage);

    expect(backend.get(STORAGE_KEYS.settings)).toBe('[]');
    expect(backend.has(keys.prefs)).toBe(false);
  });

  it('skips when storage is unavailable and touches nothing (EC-27)', () => {
    const memory = createSafeStorage(undefined);
    memory.setItem(LEGACY_STORAGE_KEYS.stats, '{}');

    expect(importLegacyData(memory)).toBe('unavailable');

    expect(memory.keys()).toEqual([LEGACY_STORAGE_KEYS.stats]);
  });

  it('skips for a new player with no legacy data and writes no marker', () => {
    const { storage, backend } = makeStorage();

    expect(importLegacyData(storage)).toBe('nothing-to-import');

    expect(backend.size).toBe(0);
  });

  it('does not import again once the marker exists (EC-25)', () => {
    const { storage, backend } = makeStorage(legacySet());

    expect(importLegacyData(storage)).toBe('imported');
    const afterFirst = new Map(backend);

    // An old tab keeps writing the legacy keys; the new keys must win.
    backend.set(LEGACY_STORAGE_KEYS.stats, '{"changed":true}');
    const legacyAfterOldTab = legacySnapshot(backend);

    expect(importLegacyData(storage)).toBe('already-imported');

    for (const [key, value] of afterFirst) {
      if (key === LEGACY_STORAGE_KEYS.stats) continue;
      expect(backend.get(key)).toBe(value);
    }
    expect(backend.get(keys.stats)).toBe(afterFirst.get(keys.stats));
    expect(legacySnapshot(backend)).toEqual(legacyAfterOldTab);
  });

  it('treats a present but corrupt marker as already imported', () => {
    const { storage, backend } = makeStorage({ ...legacySet(), [STORAGE_KEYS.meta]: 'garbage' });

    expect(importLegacyData(storage)).toBe('already-imported');

    expect(backend.has(keys.stats)).toBe(false);
  });

  it('re-runs cleanly when an earlier import was interrupted before the marker', () => {
    const legacy = legacySet();
    const { storage, backend } = makeStorage(legacy);

    // First attempt: the app dies after copying stats but before the marker.
    backend.set(keys.stats, legacy[LEGACY_STORAGE_KEYS.stats] as string);
    expect(backend.has(STORAGE_KEYS.meta)).toBe(false);

    expect(importLegacyData(storage)).toBe('imported');

    expect(backend.get(keys.stats)).toBe(legacy[LEGACY_STORAGE_KEYS.stats]);
    expect(backend.get(keys.session)).toBe(legacy[LEGACY_STORAGE_KEYS.session]);
    expect(backend.has(STORAGE_KEYS.meta)).toBe(true);
    expect(importLegacyData(storage)).toBe('already-imported');
  });

  it('keeps newer data over the legacy copy when retrying an interrupted import', () => {
    const legacy = legacySet();
    const { storage, backend } = makeStorage(legacy);
    // No marker, but the player has already played on the new keys.
    backend.set(keys.stats, '{"newer":true}');

    importLegacyData(storage);

    expect(backend.get(keys.stats)).toBe('{"newer":true}');
  });

  it('writes the marker last, and not at all when a copy cannot be verified', () => {
    const legacy = legacySet();
    const { backend } = makeStorage(legacy);
    const written: string[] = [];

    // A backend whose writes to one key are silently dropped, as a full quota would.
    const raw: Storage = {
      get length() {
        return backend.size;
      },
      key: (index) => [...backend.keys()][index] ?? null,
      getItem: (key) => backend.get(key) ?? null,
      setItem: (key, value) => {
        written.push(key);
        if (key === keys.session) return;
        backend.set(key, value);
      },
      removeItem: (key) => {
        backend.delete(key);
      },
      clear: () => {
        backend.clear();
      },
    };

    expect(importLegacyData(createSafeStorage(raw))).toBe('failed');

    expect(backend.has(STORAGE_KEYS.meta)).toBe(false);
    expect(written).not.toContain(STORAGE_KEYS.meta);
  });

  it('writes the marker after every copied key on success', () => {
    const { backend } = makeStorage(legacySet());
    const order: string[] = [];
    const raw: Storage = {
      get length() {
        return backend.size;
      },
      key: (index) => [...backend.keys()][index] ?? null,
      getItem: (key) => backend.get(key) ?? null,
      setItem: (key, value) => {
        order.push(key);
        backend.set(key, value);
      },
      removeItem: () => undefined,
      clear: () => undefined,
    };

    importLegacyData(createSafeStorage(raw));

    expect(order.at(-1)).toBe(STORAGE_KEYS.meta);
    expect(order.filter((key) => key === STORAGE_KEYS.meta)).toHaveLength(1);
  });

  it('never throws, even when the storage itself does', () => {
    const hostile: SafeStorage = {
      getItem: () => {
        throw new Error('boom');
      },
      setItem: () => {
        throw new Error('boom');
      },
      removeItem: () => undefined,
      keys: () => [],
      isPersistent: true,
    };

    expect(importLegacyData(hostile)).toBe('failed');
  });

  it('never deletes or rewrites a legacy key', () => {
    const { backend } = makeStorage(legacySet());
    const removed: string[] = [];
    const written: string[] = [];
    const raw: Storage = {
      get length() {
        return backend.size;
      },
      key: (index) => [...backend.keys()][index] ?? null,
      getItem: (key) => backend.get(key) ?? null,
      setItem: (key, value) => {
        written.push(key);
        backend.set(key, value);
      },
      removeItem: (key) => {
        removed.push(key);
        backend.delete(key);
      },
      clear: () => undefined,
    };

    importLegacyData(createSafeStorage(raw));

    const legacyKeys: string[] = Object.values(LEGACY_STORAGE_KEYS);
    expect(removed.filter((key) => legacyKeys.includes(key))).toEqual([]);
    expect(written.filter((key) => legacyKeys.includes(key))).toEqual([]);
  });
});
