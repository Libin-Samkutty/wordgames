import { beforeEach, describe, expect, it } from 'vitest';

import { RECENT_GAMES_LIMIT } from '@/engine/constants';
import { DISTRIBUTION_BUCKETS } from '@/engine/dodge/constants';
import {
  createDodgeGame,
  dodgeReducer,
  dodgeSession,
  type DodgeAction,
  type DodgeRecord,
  type DodgeState,
} from '@/engine/dodge';

import {
  DEFAULT_DODGE_PREFS,
  defaultDodgeStats,
  validateDodgePrefs,
  validateDodgeSession,
  validateDodgeStats,
} from './dodgeSchemas';
import {
  createDodgePrefsRepository,
  createDodgeSessionRepository,
  createDodgeStatsRepository,
  dodgeAverageGuesses,
  dodgeWinPercentage,
  recordDodgeGame,
  resetDodgeHistory,
  resetDodgeStatistics,
} from './dodgeRepositories';
import { gameKeys } from './keys';
import { defaultStats } from './schemas';
import { createStatsRepository } from './statsRepository';

/** WordDodge storage (T-93: FR-148, FR-153, FR-155, AC-56). */

const keys = gameKeys('dodge');

const win = (id: string, over: Partial<DodgeRecord> = {}): DodgeRecord => ({
  id,
  playedAt: 1_000,
  length: 5,
  word: 'PLANT',
  guessesUsed: 6,
  won: true,
  solveMs: 40_000,
  opener: 'SLATE',
  ...over,
});
const loss = (id: string, over: Partial<DodgeRecord> = {}): DodgeRecord =>
  win(id, { won: false, ...over });
const four = (id: string, over: Partial<DodgeRecord> = {}): DodgeRecord =>
  win(id, { length: 4, word: 'LAMB', opener: 'SLAB', ...over });

const ANSWERS = ['PLANT', 'PLANE', 'PLANS', 'STORM', 'MUSIC'];
const submit = (word: string): DodgeAction => ({ type: 'SUBMIT_GUESS', word, now: 5 });
const reveal: DodgeAction = { type: 'REVEAL_COMPLETE', now: 9 };

function played(...actions: DodgeAction[]): DodgeState {
  return actions.reduce(dodgeReducer, createDodgeGame('g', 5, ANSWERS));
}

beforeEach(() => {
  localStorage.clear();
});

describe('recordDodgeGame (FR-155)', () => {
  it('records a win overall and for its length', () => {
    const stats = recordDodgeGame(defaultDodgeStats(), win('a'));

    expect(stats.overall).toMatchObject({
      gamesPlayed: 1,
      gamesWon: 1,
      currentStreak: 1,
      bestStreak: 1,
      totalWinGuesses: 6,
      fewestGuesses: 6,
      timedSolves: 1,
      totalSolveMs: 40_000,
      fastestSolveMs: 40_000,
    });
    expect(stats.perLength[5].gamesWon).toBe(1);
    expect(stats.perLength[4].gamesPlayed).toBe(0);
  });

  it('puts a win in its distribution row: five or fewer, one per guess, 12 or more', () => {
    let stats = recordDodgeGame(defaultDodgeStats(), win('a', { guessesUsed: 3 }));
    stats = recordDodgeGame(stats, win('b', { guessesUsed: 5 }));
    stats = recordDodgeGame(stats, win('c', { guessesUsed: 7 }));
    stats = recordDodgeGame(stats, win('d', { guessesUsed: 30 }));

    expect(stats.overall.distribution).toEqual([2, 0, 1, 0, 0, 0, 0, 1]);
    expect(stats.overall.distribution).toHaveLength(DISTRIBUTION_BUCKETS);
  });

  it('tracks the fewest guesses and the average over wins', () => {
    let stats = recordDodgeGame(defaultDodgeStats(), win('a', { guessesUsed: 8 }));
    stats = recordDodgeGame(stats, win('b', { guessesUsed: 5 }));
    stats = recordDodgeGame(stats, win('c', { guessesUsed: 11 }));

    expect(stats.overall.fewestGuesses).toBe(5);
    expect(dodgeAverageGuesses(stats.overall)).toBe(8);
  });

  it('a give up counts as played, ends the streak, keeps the best, and adds no win data', () => {
    let stats = recordDodgeGame(defaultDodgeStats(), win('a'));
    stats = recordDodgeGame(stats, win('b'));
    stats = recordDodgeGame(stats, loss('c'));

    expect(stats.overall).toMatchObject({
      gamesPlayed: 3,
      gamesWon: 2,
      currentStreak: 0,
      bestStreak: 2,
      totalWinGuesses: 12,
      timedSolves: 2,
    });
  });

  it('keeps separate streaks per length while the overall streak spans all of them', () => {
    let stats = recordDodgeGame(defaultDodgeStats(), win('a'));
    stats = recordDodgeGame(stats, four('b'));
    stats = recordDodgeGame(stats, four('c', { won: false }));

    expect(stats.overall.currentStreak).toBe(0);
    expect(stats.perLength[5].currentStreak).toBe(1);
    expect(stats.perLength[4]).toMatchObject({ gamesPlayed: 2, currentStreak: 0, bestStreak: 1 });
  });

  it('is idempotent by game id, returning the same reference', () => {
    const once = recordDodgeGame(defaultDodgeStats(), win('a'));

    expect(recordDodgeGame(once, win('a'))).toBe(once);
  });

  it('keeps only the last 50 games, newest first', () => {
    let stats = defaultDodgeStats();
    for (let index = 0; index < RECENT_GAMES_LIMIT + 5; index += 1) {
      stats = recordDodgeGame(stats, win(`g${String(index)}`));
    }

    expect(stats.recentGames).toHaveLength(RECENT_GAMES_LIMIT);
    expect(stats.recentGames[0]?.id).toBe(`g${String(RECENT_GAMES_LIMIT + 4)}`);
    expect(stats.overall.gamesPlayed).toBe(RECENT_GAMES_LIMIT + 5);
  });
});

describe('derived values', () => {
  it('computes the win percentage, 0 with no games', () => {
    expect(dodgeWinPercentage(defaultDodgeStats().overall)).toBe(0);

    let stats = recordDodgeGame(defaultDodgeStats(), win('a'));
    stats = recordDodgeGame(stats, loss('b'));
    stats = recordDodgeGame(stats, win('c'));
    expect(dodgeWinPercentage(stats.overall)).toBe(67);
  });

  it('average guesses is null with no wins, never NaN', () => {
    expect(dodgeAverageGuesses(defaultDodgeStats().overall)).toBeNull();
    expect(dodgeAverageGuesses(recordDodgeGame(defaultDodgeStats(), loss('a')).overall)).toBeNull();
  });
});

describe('resets (FR-47)', () => {
  const stats = recordDodgeGame(recordDodgeGame(defaultDodgeStats(), win('a')), loss('b'));

  it('Reset statistics clears the metrics and keeps the recent games', () => {
    const reset = resetDodgeStatistics(stats);

    expect(reset.overall.gamesPlayed).toBe(0);
    expect(reset.recentGames).toHaveLength(2);
    expect(reset.recordedGameIds).toEqual(stats.recordedGameIds);
  });

  it('Reset history clears the recent games and keeps the metrics', () => {
    const reset = resetDodgeHistory(stats);

    expect(reset.recentGames).toEqual([]);
    expect(reset.recordedGameIds).toEqual([]);
    expect(reset.overall).toEqual(stats.overall);
  });
});

describe('validators reject hostile input (EC-12)', () => {
  it('prefs: accepts 4, 5 and 6 only, defaulting to 5 (FR-148)', () => {
    expect(DEFAULT_DODGE_PREFS.defaultWordLength).toBe(5);
    expect(validateDodgePrefs({ defaultWordLength: 4 })).toEqual({ defaultWordLength: 4 });
    expect(validateDodgePrefs({ defaultWordLength: 7 })).toBeNull();
    expect(validateDodgePrefs({ defaultWordLength: '5' })).toBeNull();
    expect(validateDodgePrefs(null)).toBeNull();
    expect(validateDodgePrefs([])).toBeNull();
  });

  it('stats: accepts the default shape and a recorded one', () => {
    expect(validateDodgeStats(defaultDodgeStats())).toEqual(defaultDodgeStats());

    const recorded = recordDodgeGame(defaultDodgeStats(), win('a'));
    expect(validateDodgeStats(JSON.parse(JSON.stringify(recorded)))).toEqual(recorded);
  });

  it('stats: rejects a bucket that does not add up', () => {
    const base = JSON.parse(JSON.stringify(defaultDodgeStats())) as Record<string, unknown> & {
      overall: Record<string, unknown>;
      perLength: Record<string, Record<string, unknown>>;
    };
    const bad = (change: (stats: typeof base) => void): unknown => {
      const copy = JSON.parse(JSON.stringify(base)) as typeof base;
      change(copy);
      return validateDodgeStats(copy);
    };

    expect(validateDodgeStats(null)).toBeNull();
    expect(validateDodgeStats([])).toBeNull();
    expect(bad((s) => (s.overall = 'x' as unknown as Record<string, unknown>))).toBeNull();
    expect(bad((s) => (s.overall.gamesPlayed = -1))).toBeNull();
    expect(bad((s) => (s.overall.gamesWon = 3))).toBeNull();
    expect(bad((s) => (s.overall.distribution = [0, 0]))).toBeNull();
    expect(
      bad((s) => (s.overall.distribution = Array<number>(DISTRIBUTION_BUCKETS).fill(-1))),
    ).toBeNull();
    expect(bad((s) => (s.overall.totalWinGuesses = 'x'))).toBeNull();
    expect(bad((s) => (s.overall.fewestGuesses = 0))).toBeNull();
    expect(bad((s) => (s.overall.fewestGuesses = 'x'))).toBeNull();
    expect(bad((s) => (s.overall.timedSolves = 'x'))).toBeNull();
    expect(bad((s) => (s.perLength = 'x' as unknown as typeof s.perLength))).toBeNull();
    expect(bad((s) => delete s.perLength['6'])).toBeNull();
    expect(bad((s) => (s.recentGames = 'x'))).toBeNull();
  });

  it('stats: keeps good history rows beside bad ones, tolerates missing ids and caps at 50', () => {
    const stats = JSON.parse(JSON.stringify(defaultDodgeStats())) as Record<string, unknown>;
    stats.recentGames = [
      win('good'),
      { ...win('bad-word'), word: 'pl' },
      { ...win('bad-length'), length: 9 },
      { ...win('bad-guesses'), guessesUsed: 0 },
      { ...win('bad-won'), won: 'yes' },
      { ...win('bad-time'), solveMs: -1 },
      { ...win('bad-played'), playedAt: 'x' },
      { ...win(''), id: '' },
      'junk',
      { ...win('keeps-row'), opener: 'zz' },
    ];
    delete stats.recordedGameIds;

    const loaded = validateDodgeStats(stats);

    expect(loaded?.recentGames.map((record) => record.id)).toEqual(['good', 'keeps-row']);
    // A malformed opener is dropped, not a reason to lose the row.
    expect(loaded?.recentGames[1]).not.toHaveProperty('opener');
    expect(loaded?.recordedGameIds).toEqual([]);

    stats.recentGames = Array.from({ length: 60 }, (_unused, index) => win(`g${String(index)}`));
    expect(validateDodgeStats(stats)?.recentGames).toHaveLength(RECENT_GAMES_LIMIT);
  });
});

describe('session shape (FR-153)', () => {
  const inPlay = (): DodgeState => played(submit('PLANK'), reveal);
  const won = (): DodgeState =>
    played(
      submit('PLANK'),
      reveal,
      submit('PLANT'),
      reveal,
      submit('PLANE'),
      reveal,
      submit('PLANS'),
      reveal,
    );

  it('round-trips a game in progress without its candidates', () => {
    const session = dodgeSession(inPlay());
    const loaded = validateDodgeSession(JSON.parse(JSON.stringify(session)));

    expect(loaded).toEqual(session);
    expect(loaded).not.toHaveProperty('candidates');
  });

  it('round-trips a won and a given-up game, and every length', () => {
    expect(validateDodgeSession(dodgeSession(won()))?.status).toBe('won');

    const gaveUp = dodgeReducer(inPlay(), { type: 'GIVE_UP', now: 12 });
    expect(validateDodgeSession(dodgeSession(gaveUp))?.status).toBe('gave-up');

    for (const length of [4, 5, 6] as const) {
      const start = dodgeSession(createDodgeGame('g', length, ['A'.repeat(length)]));
      expect(validateDodgeSession(start)).toEqual(start);
    }
  });

  it('keeps a half-typed row', () => {
    const typed = dodgeReducer(inPlay(), { type: 'ADD_LETTER', letter: 'S', now: 20 });

    expect(validateDodgeSession(dodgeSession(typed))?.currentInput).toBe('S');
  });

  it('rejects a bad shape or an inconsistent game', () => {
    const good = JSON.parse(JSON.stringify(dodgeSession(inPlay()))) as Record<string, unknown>;
    const bad = (change: (session: Record<string, unknown>) => void): unknown => {
      const copy = JSON.parse(JSON.stringify(good)) as Record<string, unknown>;
      change(copy);
      return validateDodgeSession(copy);
    };

    expect(validateDodgeSession(null)).toBeNull();
    expect(validateDodgeSession([])).toBeNull();
    expect(bad((s) => (s.id = ''))).toBeNull();
    expect(bad((s) => (s.id = 5))).toBeNull();
    expect(bad((s) => (s.wordLength = 7))).toBeNull();
    expect(bad((s) => (s.currentInput = 'PLANTS'))).toBeNull();
    expect(bad((s) => (s.currentInput = 'pl'))).toBeNull();
    expect(bad((s) => (s.currentInput = 5))).toBeNull();
    expect(bad((s) => (s.status = 'revealing'))).toBeNull();
    expect(bad((s) => (s.startedAt = 'x'))).toBeNull();
    expect(bad((s) => (s.finishedAt = 'x'))).toBeNull();
    expect(bad((s) => (s.guesses = 'x'))).toBeNull();
    expect(bad((s) => (s.guesses = Array<null>(1001).fill(null)))).toBeNull();
    expect(bad((s) => (s.guesses = ['x']))).toBeNull();
    expect(bad((s) => (s.guesses = [{ word: 'pl', evaluation: [] }]))).toBeNull();
    expect(bad((s) => (s.guesses = [{ word: 'PLANK', evaluation: ['correct'] }]))).toBeNull();
    expect(
      bad((s) => (s.guesses = [{ word: 'PLANK', evaluation: Array<string>(5).fill('purple') }])),
    ).toBeNull();
  });

  it('rejects a game whose status does not match its guesses or end time', () => {
    const session = dodgeSession(inPlay());
    const allGreen = { word: 'PLANT', evaluation: Array<string>(5).fill('correct') };

    // In play, but already ended or already all green.
    expect(validateDodgeSession({ ...session, finishedAt: 5 })).toBeNull();
    expect(validateDodgeSession({ ...session, guesses: [allGreen] })).toBeNull();
    // Over, but with no end time, a half-typed row or no guess.
    expect(validateDodgeSession({ ...session, status: 'gave-up', finishedAt: null })).toBeNull();
    expect(
      validateDodgeSession({ ...session, status: 'gave-up', finishedAt: 5, currentInput: 'S' }),
    ).toBeNull();
    expect(
      validateDodgeSession({ ...session, status: 'gave-up', finishedAt: 5, guesses: [] }),
    ).toBeNull();
    // A win must end on an all-green reply, and a give up must not.
    expect(validateDodgeSession({ ...session, status: 'won', finishedAt: 5 })).toBeNull();
    expect(
      validateDodgeSession({ ...session, status: 'gave-up', finishedAt: 5, guesses: [allGreen] }),
    ).toBeNull();
  });
});

describe('repositories (FR-99, AC-56)', () => {
  it('prefs, stats and session each use their own key under wordgames:v1:dodge:', () => {
    createDodgePrefsRepository().write(DEFAULT_DODGE_PREFS);
    createDodgeStatsRepository().write(defaultDodgeStats());
    createDodgeSessionRepository().write(dodgeSession(played()));

    for (const key of [keys.prefs, keys.stats, keys.session]) {
      expect(localStorage.getItem(key)).not.toBeNull();
      expect(key.startsWith('wordgames:v1:dodge:')).toBe(true);
    }
  });

  it('falls back to defaults when nothing is stored', () => {
    expect(createDodgePrefsRepository().read()).toEqual(DEFAULT_DODGE_PREFS);
    expect(createDodgeStatsRepository().read()).toEqual(defaultDodgeStats());
    expect(createDodgeSessionRepository().read()).toBeNull();
  });

  it('round-trips and clears a session', () => {
    const repo = createDodgeSessionRepository();
    const session = dodgeSession(played(submit('PLANK'), reveal));

    repo.write(session);
    expect(repo.read()).toEqual(session);

    repo.clear();
    expect(repo.read()).toBeNull();
  });

  it('reports corrupt data through the callback and returns defaults (EC-12)', () => {
    const issues: string[] = [];
    localStorage.setItem(keys.stats, '{not json');
    localStorage.setItem(keys.prefs, '{"defaultWordLength":9}');
    localStorage.setItem(keys.session, '{"id":1}');

    const onIssue = (_issue: unknown, key: string): void => {
      issues.push(key);
    };

    expect(createDodgeStatsRepository(onIssue).read()).toEqual(defaultDodgeStats());
    expect(createDodgePrefsRepository(onIssue).read()).toEqual(DEFAULT_DODGE_PREFS);
    expect(createDodgeSessionRepository(onIssue).read()).toBeNull();
    expect(issues).toEqual([keys.stats, keys.prefs, keys.session]);
  });

  it('resetting WordDodge statistics leaves Wordwright stats byte-identical (AC-56)', () => {
    createStatsRepository('wordwright').write(defaultStats());
    const before = localStorage.getItem(gameKeys('wordwright').stats);

    const dodge = createDodgeStatsRepository();
    dodge.write(recordDodgeGame(defaultDodgeStats(), win('a')));
    dodge.write(resetDodgeStatistics(dodge.read()));

    expect(localStorage.getItem(gameKeys('wordwright').stats)).toBe(before);
    expect(dodge.read().overall.gamesPlayed).toBe(0);
  });
});
