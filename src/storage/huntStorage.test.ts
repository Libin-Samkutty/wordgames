import { beforeEach, describe, expect, it } from 'vitest';

import { RECENT_ANSWER_WINDOW, RECENT_GAMES_LIMIT } from '@/engine/constants';
import {
  createHuntGame,
  huntReducer,
  type HuntAction,
  type HuntRecord,
  type HuntState,
} from '@/engine/hunt';

import {
  createHuntMetaRepository,
  createHuntSessionRepository,
  createHuntStatsRepository,
  huntCompletionPercentage,
  huntWordsFoundPercentage,
  recordHuntGame,
  rememberHuntSeed,
  resetHuntHistory,
  resetHuntStatistics,
} from './huntRepositories';
import {
  defaultHuntMeta,
  defaultHuntStats,
  validateHuntMeta,
  validateHuntSession,
  validateHuntStats,
} from './huntSchemas';
import { gameKeys } from './keys';
import { defaultStats } from './schemas';
import { createStatsRepository } from './statsRepository';

/** WordHunt storage (T-97: FR-158, FR-164, FR-165, AC-56). */

const keys = gameKeys('hunt');

const done = (id: string, over: Partial<HuntRecord> = {}): HuntRecord => ({
  id,
  playedAt: 1_000,
  seed: 'STAPLE',
  requiredCount: 10,
  foundCount: 10,
  bonusCount: 2,
  completed: true,
  solveMs: 90_000,
  ...over,
});
const gaveUp = (id: string, over: Partial<HuntRecord> = {}): HuntRecord =>
  done(id, { completed: false, foundCount: 6, bonusCount: 1, ...over });

const PUZZLE = { seed: 'STAPLE', tray: 'PLATES', required: ['LEAP', 'PALE', 'STALE'] };
const submit = (word: string, now = 5): HuntAction => ({ type: 'SUBMIT_WORD', word, now });
const add = (letter: string): HuntAction => ({ type: 'ADD_LETTER', letter, now: 5 });

function played(...actions: HuntAction[]): HuntState {
  return actions.reduce(huntReducer, createHuntGame('g', PUZZLE));
}

beforeEach(() => {
  localStorage.clear();
});

describe('recordHuntGame (FR-165)', () => {
  it('records a completed puzzle with its counts and solve time', () => {
    const stats = recordHuntGame(defaultHuntStats(), done('a'));

    expect(stats.overall).toMatchObject({
      gamesPlayed: 1,
      gamesCompleted: 1,
      currentStreak: 1,
      bestStreak: 1,
      totalRequired: 10,
      totalFound: 10,
      totalBonus: 2,
      timedSolves: 1,
      totalSolveMs: 90_000,
      fastestSolveMs: 90_000,
    });
  });

  it('a give up counts as played, adds its found words, ends the streak and keeps the best', () => {
    let stats = recordHuntGame(defaultHuntStats(), done('a'));
    stats = recordHuntGame(stats, done('b'));
    stats = recordHuntGame(stats, gaveUp('c'));

    expect(stats.overall).toMatchObject({
      gamesPlayed: 3,
      gamesCompleted: 2,
      currentStreak: 0,
      bestStreak: 2,
      totalRequired: 30,
      totalFound: 26,
      totalBonus: 5,
      timedSolves: 2,
    });
  });

  it('tracks the fastest completion', () => {
    let stats = recordHuntGame(defaultHuntStats(), done('a', { solveMs: 90_000 }));
    stats = recordHuntGame(stats, done('b', { solveMs: 45_000 }));

    expect(stats.overall.fastestSolveMs).toBe(45_000);
  });

  it('is idempotent by game id, returning the same reference', () => {
    const once = recordHuntGame(defaultHuntStats(), done('a'));

    expect(recordHuntGame(once, done('a'))).toBe(once);
  });

  it('keeps only the last 50 games, newest first', () => {
    let stats = defaultHuntStats();
    for (let index = 0; index < RECENT_GAMES_LIMIT + 5; index += 1) {
      stats = recordHuntGame(stats, done(`g${String(index)}`));
    }

    expect(stats.recentGames).toHaveLength(RECENT_GAMES_LIMIT);
    expect(stats.recentGames[0]?.id).toBe(`g${String(RECENT_GAMES_LIMIT + 4)}`);
    expect(stats.overall.gamesPlayed).toBe(RECENT_GAMES_LIMIT + 5);
  });
});

describe('derived values', () => {
  it('computes the completion percentage, 0 with no puzzles', () => {
    expect(huntCompletionPercentage(defaultHuntStats().overall)).toBe(0);

    let stats = recordHuntGame(defaultHuntStats(), done('a'));
    stats = recordHuntGame(stats, gaveUp('b'));
    stats = recordHuntGame(stats, done('c'));
    expect(huntCompletionPercentage(stats.overall)).toBe(67);
  });

  it('computes the share of words found over all puzzles, null with none, never NaN', () => {
    expect(huntWordsFoundPercentage(defaultHuntStats().overall)).toBeNull();

    // 10 of 10 and 6 of 10 is 16 of 20.
    let stats = recordHuntGame(defaultHuntStats(), done('a'));
    stats = recordHuntGame(stats, gaveUp('b'));
    expect(huntWordsFoundPercentage(stats.overall)).toBe(80);
  });
});

describe('resets (FR-47)', () => {
  const stats = recordHuntGame(recordHuntGame(defaultHuntStats(), done('a')), gaveUp('b'));

  it('Reset statistics clears the metrics and keeps the recent games', () => {
    const reset = resetHuntStatistics(stats);

    expect(reset.overall.gamesPlayed).toBe(0);
    expect(reset.recentGames).toHaveLength(2);
    expect(reset.recordedGameIds).toEqual(stats.recordedGameIds);
  });

  it('Reset history clears the recent games and keeps the metrics', () => {
    const reset = resetHuntHistory(stats);

    expect(reset.recentGames).toEqual([]);
    expect(reset.recordedGameIds).toEqual([]);
    expect(reset.overall).toEqual(stats.overall);
  });
});

describe('the seed buffer (FR-158)', () => {
  it('puts the seed at the front and de-duplicates', () => {
    let meta = rememberHuntSeed(defaultHuntMeta(), 'STAPLE');
    meta = rememberHuntSeed(meta, 'CARPET');
    meta = rememberHuntSeed(meta, 'STAPLE');

    expect(meta.recentAnswers).toEqual(['STAPLE', 'CARPET']);
  });

  it('is capped at the window', () => {
    let meta = defaultHuntMeta();
    for (let index = 0; index < RECENT_ANSWER_WINDOW + 5; index += 1) {
      meta = rememberHuntSeed(meta, `SEED${String(index)}`);
    }

    expect(meta.recentAnswers).toHaveLength(RECENT_ANSWER_WINDOW);
    expect(meta.recentAnswers[0]).toBe(`SEED${String(RECENT_ANSWER_WINDOW + 4)}`);
  });
});

describe('validators reject hostile input (EC-12)', () => {
  it('stats: accepts the default shape and a recorded one', () => {
    expect(validateHuntStats(defaultHuntStats())).toEqual(defaultHuntStats());

    const recorded = recordHuntGame(defaultHuntStats(), done('a'));
    expect(validateHuntStats(JSON.parse(JSON.stringify(recorded)))).toEqual(recorded);
  });

  it('stats: rejects a bucket that does not add up', () => {
    const base = JSON.parse(JSON.stringify(defaultHuntStats())) as Record<string, unknown> & {
      overall: Record<string, unknown>;
    };
    const bad = (change: (stats: typeof base) => void): unknown => {
      const copy = JSON.parse(JSON.stringify(base)) as typeof base;
      change(copy);
      return validateHuntStats(copy);
    };

    expect(validateHuntStats(null)).toBeNull();
    expect(validateHuntStats([])).toBeNull();
    expect(bad((s) => (s.overall = 'x' as unknown as Record<string, unknown>))).toBeNull();
    expect(bad((s) => (s.overall.gamesPlayed = -1))).toBeNull();
    expect(bad((s) => (s.overall.gamesCompleted = 2))).toBeNull();
    expect(bad((s) => (s.overall.totalFound = 5))).toBeNull();
    expect(bad((s) => (s.overall.totalBonus = 'x'))).toBeNull();
    expect(bad((s) => (s.overall.timedSolves = 'x'))).toBeNull();
    expect(bad((s) => (s.recentGames = 'x'))).toBeNull();
  });

  it('stats: keeps good history rows beside bad ones, tolerates missing ids and caps at 50', () => {
    const stats = JSON.parse(JSON.stringify(defaultHuntStats())) as Record<string, unknown>;
    stats.recentGames = [
      done('good'),
      { ...done('bad-seed'), seed: 'PLANT' },
      { ...done('bad-required'), requiredCount: 0 },
      { ...done('bad-found'), foundCount: 11 },
      { ...done('bad-bonus'), bonusCount: -1 },
      { ...done('bad-completed'), completed: 'yes' },
      { ...done('mismatch'), completed: false },
      { ...done('bad-time'), solveMs: -1 },
      { ...done('bad-played'), playedAt: 'x' },
      { ...done(''), id: '' },
      'junk',
    ];
    delete stats.recordedGameIds;

    const loaded = validateHuntStats(stats);

    expect(loaded?.recentGames.map((record) => record.id)).toEqual(['good']);
    expect(loaded?.recordedGameIds).toEqual([]);

    stats.recentGames = Array.from({ length: 60 }, (_unused, index) => done(`g${String(index)}`));
    expect(validateHuntStats(stats)?.recentGames).toHaveLength(RECENT_GAMES_LIMIT);
  });

  it('meta: accepts the default and a list of seeds, and rejects the rest', () => {
    expect(validateHuntMeta(defaultHuntMeta())).toEqual(defaultHuntMeta());
    expect(validateHuntMeta({ recentAnswers: ['STAPLE'] })).toEqual({ recentAnswers: ['STAPLE'] });
    expect(validateHuntMeta({ recentAnswers: [1] })).toBeNull();
    expect(validateHuntMeta({})).toBeNull();
    expect(validateHuntMeta(null)).toBeNull();
  });
});

describe('session shape (FR-164)', () => {
  const won = (): HuntState =>
    played(submit('PEAL'), submit('LEAP'), submit('PALE'), submit('STALE'));

  it('round-trips a puzzle in progress with found words, bonus words and typed letters', () => {
    const state = played(submit('LEAP'), submit('PEAL'), add('S'), add('T'));

    expect(validateHuntSession(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });

  it('round-trips a won and a given-up puzzle', () => {
    expect(validateHuntSession(won())?.status).toBe('won');

    const gaveUpState = huntReducer(played(submit('LEAP')), { type: 'GIVE_UP', now: 9 });
    expect(validateHuntSession(gaveUpState)?.status).toBe('gave-up');
  });

  it('rejects a bad shape or an inconsistent puzzle', () => {
    const good = JSON.parse(JSON.stringify(played(submit('LEAP'), submit('PEAL')))) as Record<
      string,
      unknown
    >;
    const bad = (change: (session: Record<string, unknown>) => void): unknown => {
      const copy = JSON.parse(JSON.stringify(good)) as Record<string, unknown>;
      change(copy);
      return validateHuntSession(copy);
    };

    expect(validateHuntSession(null)).toBeNull();
    expect(validateHuntSession([])).toBeNull();
    expect(bad((s) => (s.id = ''))).toBeNull();
    expect(bad((s) => (s.id = 5))).toBeNull();
    expect(bad((s) => (s.seed = 'STAP'))).toBeNull();
    expect(bad((s) => (s.tray = 'PLATEZ'))).toBeNull();
    expect(bad((s) => (s.tray = 'PLATE'))).toBeNull();
    expect(bad((s) => (s.currentInput = 'PLATESS'))).toBeNull();
    expect(bad((s) => (s.currentInput = 'pl'))).toBeNull();
    expect(bad((s) => (s.currentInput = 5))).toBeNull();
    expect(bad((s) => (s.currentInput = 'PP'))).toBeNull();
    expect(bad((s) => (s.status = 'revealing'))).toBeNull();
    expect(bad((s) => (s.startedAt = 'x'))).toBeNull();
    expect(bad((s) => (s.finishedAt = 'x'))).toBeNull();
    expect(bad((s) => (s.required = 'x'))).toBeNull();
    expect(bad((s) => (s.required = []))).toBeNull();
    expect(bad((s) => (s.required = Array<string>(401).fill('LEAP')))).toBeNull();
    expect(bad((s) => (s.required = ['LEAP', 'LEAP']))).toBeNull();
    expect(bad((s) => (s.required = ['LEA']))).toBeNull();
    expect(bad((s) => (s.required = ['LEAPSTE']))).toBeNull();
    expect(bad((s) => (s.required = ['LEAK']))).toBeNull();
    expect(bad((s) => (s.required = [5]))).toBeNull();
    expect(bad((s) => (s.found = 'x'))).toBeNull();
    expect(bad((s) => (s.found = ['STAPLE']))).toBeNull();
    expect(bad((s) => (s.bonus = ['LEAP']))).toBeNull();
    expect(bad((s) => (s.bonus = 'x'))).toBeNull();
  });

  it('rejects a puzzle whose status does not match its words or end time', () => {
    const session = JSON.parse(JSON.stringify(played(submit('LEAP')))) as Record<string, unknown>;
    const complete = { ...session, found: ['LEAP', 'PALE', 'STALE'] };

    // In play, but already ended or already complete.
    expect(validateHuntSession({ ...session, finishedAt: 5 })).toBeNull();
    expect(validateHuntSession(complete)).toBeNull();
    // Over, but with no end time or a half-typed row.
    expect(validateHuntSession({ ...session, status: 'gave-up', finishedAt: null })).toBeNull();
    expect(
      validateHuntSession({ ...session, status: 'gave-up', finishedAt: 5, currentInput: 'S' }),
    ).toBeNull();
    // A win needs every required word, and a give up must not have them all.
    expect(validateHuntSession({ ...session, status: 'won', finishedAt: 5 })).toBeNull();
    expect(validateHuntSession({ ...complete, status: 'gave-up', finishedAt: 5 })).toBeNull();
  });
});

describe('repositories (FR-99, AC-56)', () => {
  it('stats, session and meta each use their own key under wordgames:v1:hunt:', () => {
    createHuntStatsRepository().write(defaultHuntStats());
    createHuntSessionRepository().write(played());
    createHuntMetaRepository().write(defaultHuntMeta());

    for (const key of [keys.stats, keys.session, keys.meta]) {
      expect(localStorage.getItem(key)).not.toBeNull();
      expect(key.startsWith('wordgames:v1:hunt:')).toBe(true);
    }
    expect(localStorage.getItem(keys.prefs)).toBeNull();
  });

  it('falls back to defaults when nothing is stored', () => {
    expect(createHuntStatsRepository().read()).toEqual(defaultHuntStats());
    expect(createHuntSessionRepository().read()).toBeNull();
    expect(createHuntMetaRepository().read()).toEqual(defaultHuntMeta());
  });

  it('round-trips and clears a session', () => {
    const repo = createHuntSessionRepository();
    const state = played(submit('LEAP'), add('P'));

    repo.write(state);
    expect(repo.read()).toEqual(state);

    repo.clear();
    expect(repo.read()).toBeNull();
  });

  it('reports corrupt data through the callback and returns defaults (EC-12)', () => {
    const issues: string[] = [];
    localStorage.setItem(keys.stats, '{not json');
    localStorage.setItem(keys.meta, '{"recentAnswers":5}');
    localStorage.setItem(keys.session, '{"id":1}');
    const onIssue = (_issue: unknown, key: string): void => {
      issues.push(key);
    };

    expect(createHuntStatsRepository(onIssue).read()).toEqual(defaultHuntStats());
    expect(createHuntMetaRepository(onIssue).read()).toEqual(defaultHuntMeta());
    expect(createHuntSessionRepository(onIssue).read()).toBeNull();
    expect(issues).toEqual([keys.stats, keys.meta, keys.session]);
  });

  it('resetting WordHunt statistics leaves Wordwright stats byte-identical (AC-56)', () => {
    createStatsRepository('wordwright').write(defaultStats());
    const before = localStorage.getItem(gameKeys('wordwright').stats);

    const hunt = createHuntStatsRepository();
    hunt.write(recordHuntGame(defaultHuntStats(), done('a')));
    hunt.write(resetHuntStatistics(hunt.read()));

    expect(localStorage.getItem(gameKeys('wordwright').stats)).toBe(before);
    expect(hunt.read().overall.gamesPlayed).toBe(0);
  });
});
