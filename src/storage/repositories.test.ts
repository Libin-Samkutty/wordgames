import { beforeEach, describe, expect, it } from 'vitest';

import { createGame } from '@/engine/createGame';

import { LEGACY_STORAGE_KEYS, STORAGE_KEYS, gameKeys, isOwnedKey } from './keys';
import { migrate } from './migrations';
import { createWordwrightPrefsRepository } from './prefsRepository';
import { resetAllData } from './resetData';
import { DEFAULT_SETTINGS, DEFAULT_WORDWRIGHT_PREFS, defaultMeta, defaultStats } from './schemas';
import { createMetaRepository, createSessionRepository } from './sessionRepository';
import { createSettingsRepository } from './settingsRepository';
import { createStatsRepository } from './statsRepository';

/**
 * Covers the concrete repository factories end to end against the shared
 * storage instance, complementing `createRepository.test.ts` which exercises
 * the generic machinery in isolation.
 */
/** Keys currently in LocalStorage, via the standard `length`/`key` API. */
function storedKeys(): string[] {
  return Array.from(
    { length: localStorage.length },
    (_unused, index) => localStorage.key(index) ?? '',
  );
}

describe('repository factories', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('settings round-trip through the shared key, with appearance fields only (FR-67)', () => {
    const repo = createSettingsRepository();

    expect(repo.read()).toEqual(DEFAULT_SETTINGS);

    repo.write({ theme: 'dark', colorblind: true, motion: 'reduced' });

    expect(repo.read()).toEqual({ theme: 'dark', colorblind: true, motion: 'reduced' });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.settings) ?? 'null')).toEqual({
      theme: 'dark',
      colorblind: true,
      motion: 'reduced',
    });
  });

  it('settings fall back to defaults on an invalid theme', () => {
    localStorage.setItem(
      STORAGE_KEYS.settings,
      JSON.stringify({ ...DEFAULT_SETTINGS, theme: 'neon' }),
    );

    expect(createSettingsRepository().read()).toEqual(DEFAULT_SETTINGS);
  });

  it('Wordwright prefs hold the default length under their own key (FR-67)', () => {
    const repo = createWordwrightPrefsRepository();

    expect(repo.read()).toEqual(DEFAULT_WORDWRIGHT_PREFS);

    repo.write({ defaultWordLength: 6 });

    expect(repo.read()).toEqual({ defaultWordLength: 6 });
    expect(localStorage.getItem(gameKeys('wordwright').prefs)).toBe('{"defaultWordLength":6}');
    expect(localStorage.getItem(STORAGE_KEYS.settings)).toBeNull();
  });

  it('stats round-trip and reject an incoherent record', () => {
    const repo = createStatsRepository('wordwright');
    expect(repo.read()).toEqual(defaultStats());

    const stats = defaultStats();
    repo.write(stats);
    expect(repo.read()).toEqual(stats);

    // More wins than games played is impossible; defaults are safer.
    localStorage.setItem(
      gameKeys('wordwright').stats,
      JSON.stringify({ ...stats, overall: { ...stats.overall, gamesPlayed: 1, gamesWon: 5 } }),
    );
    expect(createStatsRepository('wordwright').read()).toEqual(defaultStats());
  });

  it('the session repository stores and clears a game', () => {
    const repo = createSessionRepository('wordwright');
    const game = createGame({ id: 'g1', wordLength: 5, answer: 'CRANE' });

    expect(repo.read()).toBeNull();

    repo.write(game);
    expect(repo.read()).toEqual(game);

    repo.clear();
    expect(repo.read()).toBeNull();
  });

  it('meta round-trips the recent-answer buffer', () => {
    const repo = createMetaRepository('wordwright');

    expect(repo.read().recentAnswers[5]).toEqual([]);

    repo.write({ schemaVersion: 1, recentAnswers: { 4: ['WORD'], 5: ['CRANE'], 6: [] } });

    expect(repo.read().recentAnswers[5]).toEqual(['CRANE']);
    expect(repo.read().recentAnswers[4]).toEqual(['WORD']);
  });

  it('reports an issue through the callback when data is unreadable', () => {
    const issues: string[] = [];
    localStorage.setItem(STORAGE_KEYS.settings, '{oops');

    createSettingsRepository((issue) => issues.push(issue)).read();

    expect(issues).toEqual(['corrupt']);
  });
});

describe('per-game isolation (FR-67, FR-68)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('each repository reads and writes only its own key', () => {
    expect(storedKeys()).toEqual([]);

    createSettingsRepository().write(DEFAULT_SETTINGS);
    expect(storedKeys()).toEqual([STORAGE_KEYS.settings]);
    localStorage.clear();

    createWordwrightPrefsRepository().write({ defaultWordLength: 4 });
    expect(storedKeys()).toEqual([gameKeys('wordwright').prefs]);
    localStorage.clear();

    createStatsRepository('wordwright').write(defaultStats());
    expect(storedKeys()).toEqual([gameKeys('wordwright').stats]);
    localStorage.clear();

    createSessionRepository('wordwright').write(
      createGame({ id: 'g1', wordLength: 5, answer: 'CRANE' }),
    );
    expect(storedKeys()).toEqual([gameKeys('wordwright').session]);
    localStorage.clear();

    createMetaRepository('wordwright').write(defaultMeta());
    expect(storedKeys()).toEqual([gameKeys('wordwright').meta]);
  });

  it('a different game id uses different keys', () => {
    createStatsRepository('weaver').write(defaultStats());

    expect(storedKeys()).toEqual([gameKeys('weaver').stats]);
    expect(localStorage.getItem(gameKeys('wordwright').stats)).toBeNull();
  });

  it("clearing one game's stats leaves every other key byte-identical", () => {
    createSettingsRepository().write({ theme: 'dark', colorblind: false, motion: 'full' });
    createWordwrightPrefsRepository().write({ defaultWordLength: 6 });
    createStatsRepository('wordwright').write(defaultStats());
    createStatsRepository('weaver').write(defaultStats());
    createSessionRepository('wordwright').write(
      createGame({ id: 'g1', wordLength: 5, answer: 'CRANE' }),
    );

    const snapshot = (): Record<string, string | null> =>
      Object.fromEntries(storedKeys().map((k) => [k, localStorage.getItem(k)]));
    const before = snapshot();

    createStatsRepository('weaver').clear();

    const after = snapshot();
    const removed = gameKeys('weaver').stats;
    expect(after[removed]).toBeUndefined();
    delete before[removed];
    expect(after).toEqual(before);
  });

  it('builds the FR-68 key names', () => {
    expect(gameKeys('wordwright')).toEqual({
      prefs: 'wordgames:v1:wordwright:prefs',
      stats: 'wordgames:v1:wordwright:stats',
      session: 'wordgames:v1:wordwright:session',
      meta: 'wordgames:v1:wordwright:meta',
    });
    expect(gameKeys('weaver').session).toBe('wordgames:v1:weaver:session');
    expect(STORAGE_KEYS).toEqual({
      settings: 'wordgames:v1:settings',
      meta: 'wordgames:v1:meta',
    });
  });
});

describe('storage keys', () => {
  it('namespaces every suite key under wordgames', () => {
    for (const key of [
      ...Object.values(STORAGE_KEYS),
      ...Object.values<string>({ ...gameKeys('weaver') }),
    ]) {
      expect(key.startsWith('wordgames:v1:')).toBe(true);
    }
  });

  it('keeps the legacy keys under wordwright for the import (FR-69)', () => {
    for (const key of Object.values(LEGACY_STORAGE_KEYS)) {
      expect(key.startsWith('wordwright:v1:')).toBe(true);
    }
  });

  it('recognises its own keys in both namespaces, including earlier versions (FR-71)', () => {
    expect(isOwnedKey(STORAGE_KEYS.settings)).toBe(true);
    expect(isOwnedKey(gameKeys('weaver').stats)).toBe(true);
    expect(isOwnedKey(LEGACY_STORAGE_KEYS.stats)).toBe(true);
    expect(isOwnedKey('wordwright:v0:legacy')).toBe(true);
    expect(isOwnedKey('someone-else:data')).toBe(false);
    expect(isOwnedKey('wordgames')).toBe(false);
  });
});

describe('resetAllData (FR-71, EC-21)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('removes every wordgames: and wordwright: key and nothing else', () => {
    localStorage.setItem(STORAGE_KEYS.settings, '{}');
    localStorage.setItem(gameKeys('wordwright').stats, '{}');
    localStorage.setItem(gameKeys('weaver').session, '{}');
    localStorage.setItem(LEGACY_STORAGE_KEYS.settings, '{}');
    localStorage.setItem(LEGACY_STORAGE_KEYS.stats, '{}');
    localStorage.setItem('wordgames:v1:future-game:prefs', '{}');
    localStorage.setItem('someone-else:data', 'keep');

    resetAllData();

    expect(storedKeys()).toEqual(['someone-else:data']);
  });
});

describe('migrate (EC-13)', () => {
  it('passes data through unchanged when already current', () => {
    const data = { schemaVersion: 1, value: 'x' };

    expect(migrate(data, 1)).toEqual({ data, ok: true });
  });

  it('refuses data written by a newer build rather than guessing', () => {
    expect(migrate({ anything: true }, 99)).toEqual({ data: null, ok: false });
  });

  it('tolerates an empty chain when stepping up from an older version', () => {
    const result = migrate({ legacy: true }, 0);

    expect(result.ok).toBe(true);
  });
});
