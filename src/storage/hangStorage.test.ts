import { beforeEach, describe, expect, it } from 'vitest';

import { RECENT_ANSWER_WINDOW, RECENT_GAMES_LIMIT } from '@/engine/constants';
import {
  createHangGame,
  hangReducer,
  MAX_MISSES,
  type HangAction,
  type HangRecord,
  type HangState,
} from '@/engine/hang';

import {
  createHangMetaRepository,
  createHangPrefsRepository,
  createHangSessionRepository,
  createHangStatsRepository,
  hangAverageMisses,
  hangPerfectWins,
  hangWinPercentage,
  recordHangGame,
  rememberHangAnswer,
  resetHangHistory,
  resetHangStatistics,
} from './hangRepositories';
import {
  DEFAULT_HANG_PREFS,
  defaultHangMeta,
  defaultHangStats,
  isHangSessionUsable,
  validateHangMeta,
  validateHangPrefs,
  validateHangSession,
  validateHangStats,
} from './hangSchemas';
import { gameKeys } from './keys';
import { defaultStats } from './schemas';
import { createStatsRepository } from './statsRepository';

/** WordHang storage (T-101: FR-167, FR-168, FR-173, FR-174, AC-56). */

const keys = gameKeys('hang');

const win = (id: string, over: Partial<HangRecord> = {}): HangRecord => ({
  id,
  playedAt: 1_000,
  length: 5,
  secret: 'PLANT',
  misses: 2,
  won: true,
  solveMs: 40_000,
  ...over,
});
const loss = (id: string, over: Partial<HangRecord> = {}): HangRecord =>
  win(id, { won: false, misses: MAX_MISSES, ...over });
const four = (id: string, over: Partial<HangRecord> = {}): HangRecord =>
  win(id, { length: 4, secret: 'LAMB', ...over });

const guess = (letter: string, now = 5): HangAction => ({ type: 'GUESS_LETTER', letter, now });

function played(...letters: string[]): HangState {
  return letters.reduce(
    (state, letter) => hangReducer(state, guess(letter)),
    createHangGame('g', 5, 'PLANT'),
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('recordHangGame (FR-174)', () => {
  it('records a win overall and for its length', () => {
    const stats = recordHangGame(defaultHangStats(), win('a'));

    expect(stats.overall).toMatchObject({
      gamesPlayed: 1,
      gamesWon: 1,
      currentStreak: 1,
      bestStreak: 1,
      timedSolves: 1,
      totalSolveMs: 40_000,
      fastestSolveMs: 40_000,
    });
    expect(stats.perLength[5].gamesWon).toBe(1);
    expect(stats.perLength[4].gamesPlayed).toBe(0);
  });

  it('puts a win in the distribution row for its misses', () => {
    let stats = recordHangGame(defaultHangStats(), win('a', { misses: 0 }));
    stats = recordHangGame(stats, win('b', { misses: 2 }));
    stats = recordHangGame(stats, win('c', { misses: 2 }));
    stats = recordHangGame(stats, win('d', { misses: 5 }));

    expect(stats.overall.distribution).toEqual([1, 0, 2, 0, 0, 1]);
  });

  it('a loss counts as played, ends the streak, keeps the best, and adds no win data', () => {
    let stats = recordHangGame(defaultHangStats(), win('a'));
    stats = recordHangGame(stats, win('b'));
    stats = recordHangGame(stats, loss('c'));

    expect(stats.overall).toMatchObject({
      gamesPlayed: 3,
      gamesWon: 2,
      currentStreak: 0,
      bestStreak: 2,
      timedSolves: 2,
    });
    expect(stats.overall.distribution.reduce((sum, count) => sum + count, 0)).toBe(2);
  });

  it('keeps separate streaks per length while the overall streak spans all of them', () => {
    let stats = recordHangGame(defaultHangStats(), win('a'));
    stats = recordHangGame(stats, four('b'));
    stats = recordHangGame(stats, four('c', { won: false, misses: MAX_MISSES }));

    expect(stats.overall.currentStreak).toBe(0);
    expect(stats.perLength[5].currentStreak).toBe(1);
    expect(stats.perLength[4]).toMatchObject({ gamesPlayed: 2, currentStreak: 0, bestStreak: 1 });
  });

  it('is idempotent by game id, returning the same reference', () => {
    const once = recordHangGame(defaultHangStats(), win('a'));

    expect(recordHangGame(once, win('a'))).toBe(once);
  });

  it('keeps only the last 50 games, newest first', () => {
    let stats = defaultHangStats();
    for (let index = 0; index < RECENT_GAMES_LIMIT + 5; index += 1) {
      stats = recordHangGame(stats, win(`g${String(index)}`));
    }

    expect(stats.recentGames).toHaveLength(RECENT_GAMES_LIMIT);
    expect(stats.recentGames[0]?.id).toBe(`g${String(RECENT_GAMES_LIMIT + 4)}`);
    expect(stats.overall.gamesPlayed).toBe(RECENT_GAMES_LIMIT + 5);
  });
});

describe('derived values', () => {
  it('computes the win percentage, 0 with no games', () => {
    expect(hangWinPercentage(defaultHangStats().overall)).toBe(0);

    let stats = recordHangGame(defaultHangStats(), win('a'));
    stats = recordHangGame(stats, loss('b'));
    stats = recordHangGame(stats, win('c'));
    expect(hangWinPercentage(stats.overall)).toBe(67);
  });

  it('average misses is the mean over wins, null with no wins, never NaN', () => {
    expect(hangAverageMisses(defaultHangStats().overall)).toBeNull();
    expect(hangAverageMisses(recordHangGame(defaultHangStats(), loss('a')).overall)).toBeNull();

    let stats = recordHangGame(defaultHangStats(), win('a', { misses: 0 }));
    stats = recordHangGame(stats, win('b', { misses: 3 }));
    stats = recordHangGame(stats, win('c', { misses: 3 }));
    expect(hangAverageMisses(stats.overall)).toBe(2);
  });

  it('counts the wins with no wrong letter', () => {
    let stats = recordHangGame(defaultHangStats(), win('a', { misses: 0 }));
    stats = recordHangGame(stats, win('b', { misses: 0 }));
    stats = recordHangGame(stats, win('c', { misses: 1 }));

    expect(hangPerfectWins(stats.overall)).toBe(2);
    expect(hangPerfectWins(defaultHangStats().overall)).toBe(0);
  });
});

describe('resets (FR-47)', () => {
  const stats = recordHangGame(recordHangGame(defaultHangStats(), win('a')), loss('b'));

  it('Reset statistics clears the metrics and keeps the recent games', () => {
    const reset = resetHangStatistics(stats);

    expect(reset.overall.gamesPlayed).toBe(0);
    expect(reset.recentGames).toHaveLength(2);
    expect(reset.recordedGameIds).toEqual(stats.recordedGameIds);
  });

  it('Reset history clears the recent games and keeps the metrics', () => {
    const reset = resetHangHistory(stats);

    expect(reset.recentGames).toEqual([]);
    expect(reset.recordedGameIds).toEqual([]);
    expect(reset.overall).toEqual(stats.overall);
  });
});

describe('the answer buffer, per length (FR-168)', () => {
  it('puts the secret at the front of its own length and de-duplicates', () => {
    let meta = rememberHangAnswer(defaultHangMeta(), 5, 'PLANT');
    meta = rememberHangAnswer(meta, 5, 'STORM');
    meta = rememberHangAnswer(meta, 4, 'LAMB');
    meta = rememberHangAnswer(meta, 5, 'PLANT');

    expect(meta.recentAnswers[5]).toEqual(['PLANT', 'STORM']);
    expect(meta.recentAnswers[4]).toEqual(['LAMB']);
    expect(meta.recentAnswers[6]).toEqual([]);
  });

  it('is capped at the window', () => {
    let meta = defaultHangMeta();
    for (let index = 0; index < RECENT_ANSWER_WINDOW + 5; index += 1) {
      meta = rememberHangAnswer(meta, 6, `WORD${String(index)}`);
    }

    expect(meta.recentAnswers[6]).toHaveLength(RECENT_ANSWER_WINDOW);
    expect(meta.recentAnswers[6][0]).toBe(`WORD${String(RECENT_ANSWER_WINDOW + 4)}`);
  });
});

describe('validators reject hostile input (EC-12)', () => {
  it('prefs: accepts 4, 5 and 6 only, defaulting to 5 (FR-167)', () => {
    expect(DEFAULT_HANG_PREFS.defaultWordLength).toBe(5);
    expect(validateHangPrefs({ defaultWordLength: 6 })).toEqual({ defaultWordLength: 6 });
    expect(validateHangPrefs({ defaultWordLength: 7 })).toBeNull();
    expect(validateHangPrefs({ defaultWordLength: '5' })).toBeNull();
    expect(validateHangPrefs(null)).toBeNull();
    expect(validateHangPrefs([])).toBeNull();
  });

  it('stats: accepts the default shape and a recorded one', () => {
    expect(validateHangStats(defaultHangStats())).toEqual(defaultHangStats());

    const recorded = recordHangGame(defaultHangStats(), win('a'));
    expect(validateHangStats(JSON.parse(JSON.stringify(recorded)))).toEqual(recorded);
  });

  it('stats: rejects a bucket that does not add up', () => {
    const base = JSON.parse(JSON.stringify(defaultHangStats())) as Record<string, unknown> & {
      overall: Record<string, unknown>;
      perLength: Record<string, Record<string, unknown>>;
    };
    const bad = (change: (stats: typeof base) => void): unknown => {
      const copy = JSON.parse(JSON.stringify(base)) as typeof base;
      change(copy);
      return validateHangStats(copy);
    };

    expect(validateHangStats(null)).toBeNull();
    expect(validateHangStats([])).toBeNull();
    expect(bad((s) => (s.overall = 'x' as unknown as Record<string, unknown>))).toBeNull();
    expect(bad((s) => (s.overall.gamesPlayed = -1))).toBeNull();
    expect(bad((s) => (s.overall.gamesWon = 3))).toBeNull();
    expect(bad((s) => (s.overall.distribution = [0, 0]))).toBeNull();
    expect(bad((s) => (s.overall.distribution = Array<number>(MAX_MISSES).fill(-1)))).toBeNull();
    expect(bad((s) => (s.overall.timedSolves = 'x'))).toBeNull();
    expect(bad((s) => (s.perLength = 'x' as unknown as typeof s.perLength))).toBeNull();
    expect(bad((s) => delete s.perLength['6'])).toBeNull();
    expect(bad((s) => (s.recentGames = 'x'))).toBeNull();
  });

  it('stats: keeps good history rows beside bad ones, tolerates missing ids and caps at 50', () => {
    const stats = JSON.parse(JSON.stringify(defaultHangStats())) as Record<string, unknown>;
    stats.recentGames = [
      win('good'),
      { ...win('bad-secret'), secret: 'pl' },
      { ...win('bad-length'), length: 9 },
      { ...win('bad-misses'), misses: 7 },
      { ...win('bad-misses-type'), misses: 'x' },
      { ...win('bad-won'), won: 'yes' },
      { ...win('win-with-six'), misses: MAX_MISSES },
      { ...win('loss-with-two'), won: false },
      { ...win('bad-time'), solveMs: -1 },
      { ...win('bad-played'), playedAt: 'x' },
      { ...win(''), id: '' },
      'junk',
    ];
    delete stats.recordedGameIds;

    const loaded = validateHangStats(stats);

    expect(loaded?.recentGames.map((record) => record.id)).toEqual(['good']);
    expect(loaded?.recordedGameIds).toEqual([]);

    stats.recentGames = Array.from({ length: 60 }, (_unused, index) => win(`g${String(index)}`));
    expect(validateHangStats(stats)?.recentGames).toHaveLength(RECENT_GAMES_LIMIT);
  });

  it('meta: accepts the default, fills a missing length and rejects the rest', () => {
    expect(validateHangMeta(defaultHangMeta())).toEqual(defaultHangMeta());
    expect(validateHangMeta({ recentAnswers: { 5: ['PLANT'] } })).toEqual({
      recentAnswers: { 4: [], 5: ['PLANT'], 6: [] },
    });
    expect(validateHangMeta({ recentAnswers: { 4: [1] } })?.recentAnswers[4]).toEqual([]);
    expect(validateHangMeta({})).toBeNull();
    expect(validateHangMeta({ recentAnswers: 5 })).toBeNull();
    expect(validateHangMeta(null)).toBeNull();
  });
});

describe('session shape (FR-173)', () => {
  it('round-trips a game in progress, a won game and a lost game, at every length', () => {
    for (const state of [played('P', 'Z'), played(...'PLANT'), played(...'QZXJKB')]) {
      expect(validateHangSession(JSON.parse(JSON.stringify(state)))).toEqual(state);
    }
    for (const length of [4, 5, 6] as const) {
      const start = createHangGame('g', length, 'A'.repeat(length));
      expect(validateHangSession(start)).toEqual(start);
    }
  });

  it('rejects a bad shape', () => {
    const good = JSON.parse(JSON.stringify(played('P', 'Z'))) as Record<string, unknown>;
    const bad = (change: (session: Record<string, unknown>) => void): unknown => {
      const copy = JSON.parse(JSON.stringify(good)) as Record<string, unknown>;
      change(copy);
      return validateHangSession(copy);
    };

    expect(validateHangSession(null)).toBeNull();
    expect(validateHangSession([])).toBeNull();
    expect(bad((s) => (s.id = ''))).toBeNull();
    expect(bad((s) => (s.id = 5))).toBeNull();
    expect(bad((s) => (s.wordLength = 7))).toBeNull();
    expect(bad((s) => (s.secret = 'plant'))).toBeNull();
    expect(bad((s) => (s.secret = 'PLAN'))).toBeNull();
    expect(bad((s) => (s.tried = 5))).toBeNull();
    expect(bad((s) => (s.tried = 'pz'))).toBeNull();
    expect(bad((s) => (s.tried = 'PP'))).toBeNull();
    expect(bad((s) => (s.status = 'revealing'))).toBeNull();
    expect(bad((s) => (s.startedAt = 'x'))).toBeNull();
    expect(bad((s) => (s.finishedAt = 'x'))).toBeNull();
  });

  it('rejects a game whose status is not the one its letters give', () => {
    const inPlay = JSON.parse(JSON.stringify(played('P', 'Z'))) as Record<string, unknown>;
    const done = JSON.parse(JSON.stringify(played(...'PLANT'))) as Record<string, unknown>;
    const lost = JSON.parse(JSON.stringify(played(...'QZXJKB'))) as Record<string, unknown>;

    // Marked won or lost with letters that do not say so.
    expect(validateHangSession({ ...inPlay, status: 'won', finishedAt: 5 })).toBeNull();
    expect(validateHangSession({ ...inPlay, status: 'lost', finishedAt: 5 })).toBeNull();
    // Marked in play with letters that have ended it.
    expect(validateHangSession({ ...done, status: 'playing', finishedAt: null })).toBeNull();
    expect(validateHangSession({ ...lost, status: 'playing', finishedAt: null })).toBeNull();
    expect(validateHangSession({ ...done, status: 'lost' })).toBeNull();
    // A game in play with an end time, and a finished one without.
    expect(validateHangSession({ ...inPlay, finishedAt: 5 })).toBeNull();
    expect(validateHangSession({ ...done, finishedAt: null })).toBeNull();
  });
});

describe('isHangSessionUsable (FR-173)', () => {
  const session = played('P');

  it('accepts a game whose secret is still in the list', () => {
    expect(isHangSessionUsable(session, (word) => word === 'PLANT')).toBe(true);
  });

  it('discards nothing-saved, and a secret that has left the list', () => {
    expect(isHangSessionUsable(null, () => true)).toBe(false);
    expect(isHangSessionUsable(session, () => false)).toBe(false);
  });
});

describe('repositories (FR-99, AC-56)', () => {
  it('prefs, stats, session and meta each use their own key under wordgames:v1:hang:', () => {
    createHangPrefsRepository().write(DEFAULT_HANG_PREFS);
    createHangStatsRepository().write(defaultHangStats());
    createHangSessionRepository().write(played());
    createHangMetaRepository().write(defaultHangMeta());

    for (const key of [keys.prefs, keys.stats, keys.session, keys.meta]) {
      expect(localStorage.getItem(key)).not.toBeNull();
      expect(key.startsWith('wordgames:v1:hang:')).toBe(true);
    }
  });

  it('falls back to defaults when nothing is stored', () => {
    expect(createHangPrefsRepository().read()).toEqual(DEFAULT_HANG_PREFS);
    expect(createHangStatsRepository().read()).toEqual(defaultHangStats());
    expect(createHangSessionRepository().read()).toBeNull();
    expect(createHangMetaRepository().read()).toEqual(defaultHangMeta());
  });

  it('round-trips and clears a session', () => {
    const repo = createHangSessionRepository();
    const state = played('P', 'Z');

    repo.write(state);
    expect(repo.read()).toEqual(state);

    repo.clear();
    expect(repo.read()).toBeNull();
  });

  it('reports corrupt data through the callback and returns defaults (EC-12)', () => {
    const issues: string[] = [];
    localStorage.setItem(keys.stats, '{not json');
    localStorage.setItem(keys.prefs, '{"defaultWordLength":9}');
    localStorage.setItem(keys.session, '{"id":1}');
    localStorage.setItem(keys.meta, '[]');
    const onIssue = (_issue: unknown, key: string): void => {
      issues.push(key);
    };

    expect(createHangStatsRepository(onIssue).read()).toEqual(defaultHangStats());
    expect(createHangPrefsRepository(onIssue).read()).toEqual(DEFAULT_HANG_PREFS);
    expect(createHangSessionRepository(onIssue).read()).toBeNull();
    expect(createHangMetaRepository(onIssue).read()).toEqual(defaultHangMeta());
    expect(issues).toEqual([keys.stats, keys.prefs, keys.session, keys.meta]);
  });

  it('resetting WordHang statistics leaves Wordwright stats byte-identical (AC-56)', () => {
    createStatsRepository('wordwright').write(defaultStats());
    const before = localStorage.getItem(gameKeys('wordwright').stats);

    const hang = createHangStatsRepository();
    hang.write(recordHangGame(defaultHangStats(), win('a')));
    hang.write(resetHangStatistics(hang.read()));

    expect(localStorage.getItem(gameKeys('wordwright').stats)).toBe(before);
    expect(hang.read().overall.gamesPlayed).toBe(0);
  });
});
