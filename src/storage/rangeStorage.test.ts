import { beforeEach, describe, expect, it } from 'vitest';

import { RECENT_ANSWER_WINDOW, RECENT_GAMES_LIMIT } from '@/engine/constants';
import { createRangeGame, rangeReducer, type RangeAction } from '@/engine/range';
import type { RangeRecord, RangeState } from '@/engine/range';

import { gameKeys } from './keys';
import {
  createRangeMetaRepository,
  createRangePrefsRepository,
  createRangeSessionRepository,
  createRangeStatsRepository,
  rangeAverageFirstBurning,
  rangeBurningPercentage,
  rangeWinPercentage,
  recordRangeGame,
  rememberRangeAnswer,
  resetRangeHistory,
  resetRangeStatistics,
} from './rangeRepositories';
import {
  defaultRangeMeta,
  defaultRangeStats,
  isRangeSessionUsable,
  validateRangeMeta,
  validateRangePrefs,
  validateRangeSession,
  validateRangeStats,
} from './rangeSchemas';
import { defaultStats } from './schemas';
import { createStatsRepository } from './statsRepository';

/** WordRange storage (T-81: FR-124, FR-125, AC-56). */

const keys = gameKeys('range');

const record = (id: string, over: Partial<RangeRecord> = {}): RangeRecord => ({
  id,
  playedAt: 1_000,
  secret: 'PLANT',
  guessesUsed: 6,
  won: true,
  ...over,
});

function played(...actions: RangeAction[]): RangeState {
  return actions.reduce(rangeReducer, createRangeGame('g', 'PLANT'));
}
const submit = (word: string, distance: number): RangeAction => ({
  type: 'SUBMIT_GUESS',
  word,
  distance,
  now: 5,
});

beforeEach(() => {
  localStorage.clear();
});

describe('recordRangeGame (FR-124)', () => {
  it('records a win with its distribution bucket (guess 1 is index 0, guess 14 is 13)', () => {
    const one = recordRangeGame(defaultRangeStats(), record('a', { guessesUsed: 1 }));
    const last = recordRangeGame(defaultRangeStats(), record('b', { guessesUsed: 14 }));

    expect(one).toMatchObject({ gamesPlayed: 1, gamesWon: 1, currentStreak: 1, bestStreak: 1 });
    expect(one.distribution[0]).toBe(1);
    expect(last.distribution[13]).toBe(1);
    expect(one.distribution).toHaveLength(14);
  });

  it('records a loss as played, resets the streak, keeps the best, adds no bucket', () => {
    let stats = recordRangeGame(defaultRangeStats(), record('a'));
    stats = recordRangeGame(stats, record('b'));
    stats = recordRangeGame(stats, record('c', { won: false, guessesUsed: 14 }));

    expect(stats).toMatchObject({ gamesPlayed: 3, gamesWon: 2, currentStreak: 0, bestStreak: 2 });
    expect(stats.distribution.reduce((a, b) => a + b, 0)).toBe(2);
  });

  it('ignores a win outside 1 to 14 rather than corrupting the distribution', () => {
    const stats = recordRangeGame(defaultRangeStats(), record('a', { guessesUsed: 0 }));

    expect(stats.gamesWon).toBe(1);
    expect(stats.distribution.every((n) => n === 0)).toBe(true);
  });

  it('is idempotent by game id, returning the same reference', () => {
    const once = recordRangeGame(defaultRangeStats(), record('a'));

    expect(recordRangeGame(once, record('a'))).toBe(once);
  });

  it('keeps only the last 50 games, newest first', () => {
    let stats = defaultRangeStats();
    for (let i = 0; i < RECENT_GAMES_LIMIT + 5; i += 1) {
      stats = recordRangeGame(stats, record(`g${String(i)}`));
    }

    expect(stats.recentGames).toHaveLength(RECENT_GAMES_LIMIT);
    expect(stats.recentGames[0]?.id).toBe('g54');
    expect(stats.gamesPlayed).toBe(55);
  });

  it('computes the win percentage, 0 with no games', () => {
    let stats = defaultRangeStats();
    expect(rangeWinPercentage(stats)).toBe(0);

    stats = recordRangeGame(stats, record('a'));
    stats = recordRangeGame(stats, record('b', { won: false }));
    stats = recordRangeGame(stats, record('c'));
    expect(rangeWinPercentage(stats)).toBe(67);
  });
});

describe('resets (FR-47)', () => {
  const stats = recordRangeGame(recordRangeGame(defaultRangeStats(), record('a')), record('b'));

  it('Reset statistics clears the metrics and keeps the recent games', () => {
    const reset = resetRangeStatistics(stats);

    expect(reset.gamesPlayed).toBe(0);
    expect(reset.distribution.every((n) => n === 0)).toBe(true);
    expect(reset.recentGames).toHaveLength(2);
  });

  it('Reset history clears the recent games and keeps the metrics', () => {
    const reset = resetRangeHistory(stats);

    expect(reset.recentGames).toEqual([]);
    expect(reset.recordedGameIds).toEqual([]);
    expect(reset.gamesPlayed).toBe(2);
  });
});

describe('the answer buffer (FR-115)', () => {
  it('puts the secret at the front and de-duplicates', () => {
    const meta = rememberRangeAnswer({ recentAnswers: ['STORM', 'PLANT'] }, 'PLANT');

    expect(meta.recentAnswers).toEqual(['PLANT', 'STORM']);
  });

  it('is capped at the window', () => {
    let meta = defaultRangeMeta();
    for (let i = 0; i < RECENT_ANSWER_WINDOW + 10; i += 1) {
      meta = rememberRangeAnswer(meta, `W${String(i).padStart(4, '0')}`);
    }

    expect(meta.recentAnswers).toHaveLength(RECENT_ANSWER_WINDOW);
  });
});

describe('validators reject hostile input (EC-12)', () => {
  it('prefs: accepts an object, rejects the rest', () => {
    expect(validateRangePrefs({})).toEqual({});
    for (const bad of [null, 'x', 3, [], undefined]) expect(validateRangePrefs(bad)).toBeNull();
  });

  it('stats: accepts the default shape', () => {
    expect(validateRangeStats(defaultRangeStats())).toEqual(defaultRangeStats());
  });

  it.each([
    ['a non-object', null],
    ['a negative count', { ...defaultRangeStats(), gamesPlayed: -1 }],
    ['a fractional count', { ...defaultRangeStats(), currentStreak: 1.5 }],
    ['more wins than games', { ...defaultRangeStats(), gamesWon: 2, gamesPlayed: 1 }],
    ['a short distribution', { ...defaultRangeStats(), distribution: [0, 0] }],
    ['a bad distribution entry', { ...defaultRangeStats(), distribution: new Array(14).fill('x') }],
    ['no recent games array', { ...defaultRangeStats(), recentGames: 'x' }],
  ])('stats: rejects %s', (_name, value) => {
    expect(validateRangeStats(value)).toBeNull();
  });

  it('stats: keeps good history rows beside bad ones, tolerates missing ids and caps at 50', () => {
    const many = Array.from({ length: 60 }, (_, i) => record(`g${String(i)}`));
    const parsed = validateRangeStats({
      ...defaultRangeStats(),
      recentGames: [record('ok'), { id: '' }, 'junk', record('bad', { secret: 'nope' }), ...many],
      recordedGameIds: undefined,
    });

    expect(parsed?.recentGames[0]?.id).toBe('ok');
    expect(parsed?.recentGames).toHaveLength(50);
    expect(parsed?.recordedGameIds).toEqual([]);
  });

  it.each([
    ['no id', { id: '' }],
    ['a bad time', { playedAt: 'x' }],
    ['a non-word secret', { secret: 'plant' }],
    ['guesses above 14', { guessesUsed: 15 }],
    ['a negative count', { guessesUsed: -1 }],
    ['a non-boolean win', { won: 1 }],
  ])('stats: drops a history row with %s', (_name, over) => {
    const parsed = validateRangeStats({
      ...defaultRangeStats(),
      recentGames: [{ ...record('x'), ...over }],
    });

    expect(parsed?.recentGames).toEqual([]);
  });

  it('meta: accepts the default and rejects non-string buffers', () => {
    expect(validateRangeMeta(defaultRangeMeta())).toEqual(defaultRangeMeta());
    expect(validateRangeMeta({ recentAnswers: [1] })).toBeNull();
    expect(validateRangeMeta(null)).toBeNull();
  });
});

describe('session shape (FR-125)', () => {
  it('round-trips a game in progress with typed letters', () => {
    const state = rangeReducer(played(submit('BRAVE', 5000), submit('STORM', 300)), {
      type: 'ADD_LETTER',
      letter: 'P',
      now: 6,
    });

    expect(validateRangeSession(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });

  it('round-trips a won game, whose last guess has no direction or heat', () => {
    const state = played(submit('BRAVE', 5000), submit('PLANT', 0));

    expect(validateRangeSession(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });

  const good = (): Record<string, unknown> =>
    JSON.parse(JSON.stringify(played(submit('BRAVE', 5000), submit('STORM', 300)))) as Record<
      string,
      unknown
    >;

  it.each([
    ['a non-object', () => 'x'],
    ['no id', () => ({ ...good(), id: '' })],
    ['a bad secret', () => ({ ...good(), secret: 'plant' })],
    ['too much input', () => ({ ...good(), currentInput: 'PLANTS' })],
    ['lowercase input', () => ({ ...good(), currentInput: 'pl' })],
    ['a non-string input', () => ({ ...good(), currentInput: 4 })],
    ['an unknown status', () => ({ ...good(), status: 'revealing' })],
    ['a bad start time', () => ({ ...good(), startedAt: 'x' })],
    ['a bad finish time', () => ({ ...good(), finishedAt: 'x' })],
    ['a bad lower bound', () => ({ ...good(), lower: 'brave' })],
    ['a bad upper bound', () => ({ ...good(), upper: 7 })],
    ['a secret outside its own range', () => ({ ...good(), lower: 'TRUCK' })],
    ['guesses that are not an array', () => ({ ...good(), guesses: 'x' })],
    ['more than 14 guesses', () => ({ ...good(), guesses: new Array(15).fill(good().guesses) })],
    ['a bad guess', () => ({ ...good(), guesses: ['x'] })],
    [
      'a bad word',
      () => ({ ...good(), guesses: [{ word: 'x', direction: 'after', heat: 'hot' }] }),
    ],
    [
      'an unknown direction',
      () => ({ ...good(), guesses: [{ word: 'BRAVE', direction: 'up', heat: 'hot' }] }),
    ],
    [
      'an unknown heat',
      () => ({ ...good(), guesses: [{ word: 'BRAVE', direction: 'after', heat: 'lukewarm' }] }),
    ],
    [
      'a direction without a heat',
      () => ({ ...good(), guesses: [{ word: 'BRAVE', direction: 'after', heat: null }] }),
    ],
    [
      'a repeated word',
      () => ({
        ...good(),
        guesses: [
          { word: 'BRAVE', direction: 'after', heat: 'hot' },
          { word: 'BRAVE', direction: 'after', heat: 'hot' },
        ],
      }),
    ],
  ])('rejects %s', (_name, make) => {
    expect(validateRangeSession(make())).toBeNull();
  });

  it('accepts the sentinel bounds', () => {
    const fresh = createRangeGame('g', 'PLANT');

    expect(validateRangeSession(JSON.parse(JSON.stringify(fresh)))).toEqual(fresh);
  });
});

describe('isRangeSessionUsable (FR-125)', () => {
  const session = played(submit('BRAVE', 5000));

  it('accepts a game whose secret is still in the list', () => {
    expect(isRangeSessionUsable(session, (word) => word === 'PLANT')).toBe(true);
  });

  it('discards nothing-saved, and a secret that has left the list', () => {
    expect(isRangeSessionUsable(null, () => true)).toBe(false);
    expect(isRangeSessionUsable(session, () => false)).toBe(false);
  });
});

describe('repositories (FR-99, AC-56)', () => {
  it('prefs, stats, session and meta each use their own key under wordgames:v1:range:', () => {
    createRangePrefsRepository().write({});
    createRangeStatsRepository().write(defaultRangeStats());
    createRangeSessionRepository().write(createRangeGame('g', 'PLANT'));
    createRangeMetaRepository().write(defaultRangeMeta());

    for (const key of [keys.prefs, keys.stats, keys.session, keys.meta])
      expect(localStorage.getItem(key)).not.toBeNull();
    expect(keys.stats).toBe('wordgames:v1:range:stats');
  });

  it('falls back to defaults when nothing is stored', () => {
    expect(createRangePrefsRepository().read()).toEqual({});
    expect(createRangeStatsRepository().read()).toEqual(defaultRangeStats());
    expect(createRangeSessionRepository().read()).toBeNull();
    expect(createRangeMetaRepository().read()).toEqual(defaultRangeMeta());
  });

  it('round-trips and clears a session', () => {
    const repo = createRangeSessionRepository();
    const state = played(submit('BRAVE', 5000));

    repo.write(state);
    expect(repo.read()).toEqual(state);

    repo.clear();
    expect(repo.read()).toBeNull();
  });

  it('reports corrupt data through the callback and returns defaults (EC-12)', () => {
    const issues: string[] = [];
    localStorage.setItem(keys.stats, '{not json');

    const stats = createRangeStatsRepository((_issue, key) => issues.push(key)).read();

    expect(stats).toEqual(defaultRangeStats());
    expect(issues).toEqual([keys.stats]);
  });

  it('resetting WordRange statistics leaves Wordwright stats byte-identical (AC-56)', () => {
    const wordwright = createStatsRepository('wordwright');
    wordwright.write(defaultStats());
    const before = localStorage.getItem('wordgames:v1:wordwright:stats');

    const range = createRangeStatsRepository();
    range.write(recordRangeGame(defaultRangeStats(), record('a')));
    range.write(resetRangeStatistics(range.read()));

    expect(localStorage.getItem('wordgames:v1:wordwright:stats')).toBe(before);
  });
});

describe('detail stats added after release', () => {
  it('loads a stats blob saved before the new fields existed, without a reset', () => {
    const old = JSON.parse(JSON.stringify(defaultRangeStats())) as Record<string, unknown>;
    for (const field of [
      'heatTrackedGames',
      'burningGames',
      'totalFirstBurningAt',
      'closestMiss',
      'timedSolves',
      'totalSolveMs',
      'fastestSolveMs',
    ]) {
      delete old[field];
    }
    old.gamesPlayed = 9;
    old.gamesWon = 4;

    const loaded = validateRangeStats(old);

    expect(loaded?.gamesPlayed).toBe(9);
    expect(loaded?.closestMiss).toBeNull();
    expect(loaded?.timedSolves).toBe(0);
    expect(loaded?.heatTrackedGames).toBe(0);
  });

  it('still loads an old record row that has no detail fields', () => {
    const stats = { ...defaultRangeStats(), recentGames: [record('old')] };

    expect(validateRangeStats(JSON.parse(JSON.stringify(stats)))?.recentGames).toHaveLength(1);
  });

  it('rejects detail fields that are present but wrong', () => {
    const bad = {
      ...(JSON.parse(JSON.stringify(defaultRangeStats())) as Record<string, unknown>),
      closestMiss: -3,
    };

    expect(validateRangeStats(bad)).toBeNull();
  });

  it('adds time on wins only, and tracks the fastest', () => {
    let stats = recordRangeGame(defaultRangeStats(), record('a', { solveMs: 60_000 }));
    stats = recordRangeGame(stats, record('b', { solveMs: 20_000 }));
    stats = recordRangeGame(stats, record('c', { won: false, solveMs: 1_000 }));
    stats = recordRangeGame(stats, record('d'));

    expect(stats).toMatchObject({ timedSolves: 2, totalSolveMs: 80_000, fastestSolveMs: 20_000 });
  });

  it('keeps the smallest words-left across losses, ignoring wins and rows without it', () => {
    let stats = recordRangeGame(defaultRangeStats(), record('a', { won: false, wordsLeft: 40 }));
    stats = recordRangeGame(stats, record('b', { won: false, wordsLeft: 7 }));
    stats = recordRangeGame(stats, record('c', { won: false, wordsLeft: null }));
    stats = recordRangeGame(stats, record('d', { won: false }));
    stats = recordRangeGame(stats, record('e', { wordsLeft: 1 }));

    expect(stats.closestMiss).toBe(7);
  });

  it('counts Burning games, on wins and losses', () => {
    let stats = recordRangeGame(defaultRangeStats(), record('a', { firstBurningGuess: 4 }));
    stats = recordRangeGame(stats, record('b', { won: false, firstBurningGuess: 8 }));
    stats = recordRangeGame(stats, record('c', { firstBurningGuess: null }));
    stats = recordRangeGame(stats, record('d'));

    expect(stats).toMatchObject({
      heatTrackedGames: 3,
      burningGames: 2,
      totalFirstBurningAt: 12,
    });
    expect(rangeAverageFirstBurning(stats)).toBe(6);
    expect(rangeBurningPercentage(stats)).toBe(67);
  });

  it('keeps the new fields on a stored record', () => {
    const row = record('a', {
      solveMs: 4321,
      firstBurningGuess: 3,
      wordsLeft: null,
      opener: 'BRAVE',
    });
    const stats = { ...defaultRangeStats(), recentGames: [row] };

    expect(validateRangeStats(JSON.parse(JSON.stringify(stats)))?.recentGames[0]).toEqual(row);
  });
});
