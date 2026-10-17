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
  DEFAULT_RANGE_PREFS,
  defaultRangeMeta,
  defaultRangeStats,
  isRangeSessionUsable,
  validateRangeMeta,
  validateRangePrefs,
  validateRangeSession,
  validateRangeStats,
  type RangeStatsState,
} from './rangeSchemas';
import { defaultStats } from './schemas';
import { createStatsRepository } from './statsRepository';

/** WordRange storage (T-81: FR-124, FR-125, AC-56; ADR-037). */

const keys = gameKeys('range');

const record = (id: string, over: Partial<RangeRecord> = {}): RangeRecord => ({
  id,
  playedAt: 1_000,
  secret: 'PLANT',
  guessesUsed: 6,
  won: true,
  wordLength: 5,
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

/** The stats with `over` merged into the overall bucket. */
const withOverall = (over: Record<string, unknown>): unknown => ({
  ...defaultRangeStats(),
  overall: { ...defaultRangeStats().overall, ...over },
});

/** A JSON round trip, so a test cannot lean on a shared reference. */
const viaJson = <T>(value: T): Record<string, unknown> =>
  JSON.parse(JSON.stringify(value)) as Record<string, unknown>;

/** What WordRange saved before lengths existed: one flat bucket of 5-letter games. */
function legacyStats(over: Record<string, unknown> = {}): Record<string, unknown> {
  const flat = defaultRangeStats().perLength[5];
  return { ...viaJson(flat), recentGames: [], recordedGameIds: [], ...over };
}

beforeEach(() => {
  localStorage.clear();
});

describe('recordRangeGame (FR-124)', () => {
  it('records a win with its distribution bucket (guess 1 is index 0, guess 14 is 13)', () => {
    const one = recordRangeGame(defaultRangeStats(), record('a', { guessesUsed: 1 }));
    const last = recordRangeGame(defaultRangeStats(), record('b', { guessesUsed: 14 }));

    expect(one.overall).toMatchObject({
      gamesPlayed: 1,
      gamesWon: 1,
      currentStreak: 1,
      bestStreak: 1,
    });
    expect(one.overall.distribution[0]).toBe(1);
    expect(last.overall.distribution[13]).toBe(1);
    expect(one.perLength[5].distribution).toHaveLength(14);
    expect(one.overall.distribution).toHaveLength(15);
  });

  it('records a loss as played, resets the streak, keeps the best, adds no bucket', () => {
    let stats = recordRangeGame(defaultRangeStats(), record('a'));
    stats = recordRangeGame(stats, record('b'));
    stats = recordRangeGame(stats, record('c', { won: false, guessesUsed: 14 }));

    expect(stats.overall).toMatchObject({
      gamesPlayed: 3,
      gamesWon: 2,
      currentStreak: 0,
      bestStreak: 2,
    });
    expect(stats.overall.distribution.reduce((a, b) => a + b, 0)).toBe(2);
  });

  it('ignores a win outside 1 to 14 rather than corrupting the distribution', () => {
    const stats = recordRangeGame(defaultRangeStats(), record('a', { guessesUsed: 0 }));

    expect(stats.overall.gamesWon).toBe(1);
    expect(stats.overall.distribution.every((n) => n === 0)).toBe(true);
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
    expect(stats.overall.gamesPlayed).toBe(55);
  });

  it('computes the win percentage, 0 with no games', () => {
    let stats = defaultRangeStats();
    expect(rangeWinPercentage(stats.overall)).toBe(0);

    stats = recordRangeGame(stats, record('a'));
    stats = recordRangeGame(stats, record('b', { won: false }));
    stats = recordRangeGame(stats, record('c'));
    expect(rangeWinPercentage(stats.overall)).toBe(67);
  });
});

describe('per-length buckets (ADR-037)', () => {
  it('counts a game overall and in its own length only', () => {
    const stats = recordRangeGame(
      defaultRangeStats(),
      record('a', { wordLength: 4, secret: 'PLAN', guessesUsed: 3 }),
    );

    expect(stats.overall.gamesPlayed).toBe(1);
    expect(stats.perLength[4].gamesPlayed).toBe(1);
    expect(stats.perLength[4].distribution[2]).toBe(1);
    expect(stats.perLength[5].gamesPlayed).toBe(0);
    expect(stats.perLength[6].gamesPlayed).toBe(0);
  });

  it('keeps a streak per length, so a loss at one length leaves another alone', () => {
    let stats = recordRangeGame(defaultRangeStats(), record('a'));
    stats = recordRangeGame(stats, record('b', { wordLength: 6, secret: 'PLANET', won: false }));

    expect(stats.perLength[5].currentStreak).toBe(1);
    expect(stats.perLength[6].currentStreak).toBe(0);
    expect(stats.overall.currentStreak).toBe(0);
  });

  it('sizes each distribution to its length: 13, 14 and 15 guesses', () => {
    const stats = defaultRangeStats();

    expect([4, 5, 6].map((n) => stats.perLength[n as 4 | 5 | 6].distribution.length)).toEqual([
      13, 14, 15,
    ]);
    expect(stats.overall.distribution).toHaveLength(15);
  });

  it('a 6-letter win on guess 15 lands in the last bucket', () => {
    const stats = recordRangeGame(
      defaultRangeStats(),
      record('a', { wordLength: 6, secret: 'PLANET', guessesUsed: 15 }),
    );

    expect(stats.perLength[6].distribution[14]).toBe(1);
    expect(stats.overall.distribution[14]).toBe(1);
  });
});

describe('resets (FR-47)', () => {
  const stats = recordRangeGame(recordRangeGame(defaultRangeStats(), record('a')), record('b'));

  it('Reset statistics clears the metrics and keeps the recent games', () => {
    const reset = resetRangeStatistics(stats);

    expect(reset.overall.gamesPlayed).toBe(0);
    expect(reset.perLength[5].gamesPlayed).toBe(0);
    expect(reset.overall.distribution.every((n) => n === 0)).toBe(true);
    expect(reset.recentGames).toHaveLength(2);
  });

  it('Reset history clears the recent games and keeps the metrics', () => {
    const reset = resetRangeHistory(stats);

    expect(reset.recentGames).toEqual([]);
    expect(reset.recordedGameIds).toEqual([]);
    expect(reset.overall.gamesPlayed).toBe(2);
  });
});

describe('the answer buffer, per length (FR-115)', () => {
  it('puts the secret at the front and de-duplicates', () => {
    const meta = rememberRangeAnswer(
      { recentAnswers: { 4: [], 5: ['STORM', 'PLANT'], 6: [] } },
      5,
      'PLANT',
    );

    expect(meta.recentAnswers[5]).toEqual(['PLANT', 'STORM']);
  });

  it('is capped at the window', () => {
    let meta = defaultRangeMeta();
    for (let i = 0; i < RECENT_ANSWER_WINDOW + 10; i += 1) {
      meta = rememberRangeAnswer(meta, 5, `W${String(i).padStart(4, '0')}`);
    }

    expect(meta.recentAnswers[5]).toHaveLength(RECENT_ANSWER_WINDOW);
  });

  it('keeps one buffer for each length', () => {
    let meta = rememberRangeAnswer(defaultRangeMeta(), 4, 'PLAN');
    meta = rememberRangeAnswer(meta, 6, 'PLANET');

    expect(meta.recentAnswers).toEqual({ 4: ['PLAN'], 5: [], 6: ['PLANET'] });
  });
});

describe('validators reject hostile input (EC-12)', () => {
  it('prefs: accepts a length, reads an empty or odd one as 5, rejects the rest', () => {
    expect(validateRangePrefs({ defaultWordLength: 6 })).toEqual({ defaultWordLength: 6 });
    expect(validateRangePrefs({})).toEqual(DEFAULT_RANGE_PREFS);
    expect(validateRangePrefs({ defaultWordLength: 9 })).toEqual(DEFAULT_RANGE_PREFS);
    for (const bad of [null, 'x', 3, [], undefined]) expect(validateRangePrefs(bad)).toBeNull();
  });

  it('stats: accepts the default shape', () => {
    expect(validateRangeStats(defaultRangeStats())).toEqual(defaultRangeStats());
  });

  it.each([
    ['a non-object', null],
    ['a negative count', withOverall({ gamesPlayed: -1 })],
    ['a fractional count', withOverall({ currentStreak: 1.5 })],
    ['more wins than games', withOverall({ gamesWon: 2, gamesPlayed: 1 })],
    ['a short distribution', withOverall({ distribution: [0, 0] })],
    ['a bad distribution entry', withOverall({ distribution: new Array(15).fill('x') })],
    [
      'the old 14-long distribution in the overall bucket',
      withOverall({ distribution: new Array(14).fill(0) }),
    ],
    ['no recent games array', { ...defaultRangeStats(), recentGames: 'x' }],
    ['no per-length buckets', { ...defaultRangeStats(), perLength: null }],
    [
      'a missing length bucket',
      { ...defaultRangeStats(), perLength: { 4: defaultRangeStats().perLength[4] } },
    ],
    [
      'a length bucket with the wrong distribution',
      {
        ...defaultRangeStats(),
        perLength: {
          ...defaultRangeStats().perLength,
          6: { ...defaultRangeStats().perLength[6], distribution: new Array(14).fill(0) },
        },
      },
    ],
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
    ['a secret of another length', { secret: 'PLANET' }],
    ['guesses above 14', { guessesUsed: 15 }],
    ['guesses above a 4-letter game’s 13', { wordLength: 4, secret: 'PLAN', guessesUsed: 14 }],
    ['a negative count', { guessesUsed: -1 }],
    ['a non-boolean win', { won: 1 }],
  ])('stats: drops a history row with %s', (_name, over) => {
    const parsed = validateRangeStats({
      ...defaultRangeStats(),
      recentGames: [{ ...record('x'), ...over }],
    });

    expect(parsed?.recentGames).toEqual([]);
  });

  it('stats: keeps a 6-letter history row with 15 guesses', () => {
    const row = record('six', { wordLength: 6, secret: 'PLANET', guessesUsed: 15 });
    const parsed = validateRangeStats(viaJson({ ...defaultRangeStats(), recentGames: [row] }));

    expect(parsed?.recentGames).toEqual([row]);
  });

  it('meta: accepts the default and reads a malformed length buffer as empty', () => {
    expect(validateRangeMeta(defaultRangeMeta())).toEqual(defaultRangeMeta());
    expect(validateRangeMeta({ recentAnswers: { 4: [1], 5: ['PLANT'] } })).toEqual({
      recentAnswers: { 4: [], 5: ['PLANT'], 6: [] },
    });
    expect(validateRangeMeta({ recentAnswers: 'x' })).toBeNull();
    expect(validateRangeMeta({ recentAnswers: [1] })).toBeNull();
    expect(validateRangeMeta(null)).toBeNull();
  });
});

describe('saved before lengths existed (ADR-037, ADR-035)', () => {
  it('stats: a flat bucket becomes the 5-letter and overall buckets', () => {
    const loaded = validateRangeStats(
      legacyStats({
        gamesPlayed: 9,
        gamesWon: 4,
        currentStreak: 2,
        bestStreak: 3,
        distribution: [0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      }),
    );

    expect(loaded?.perLength[5]).toMatchObject({ gamesPlayed: 9, gamesWon: 4, currentStreak: 2 });
    expect(loaded?.perLength[5].distribution).toHaveLength(14);
    expect(loaded?.overall).toMatchObject({ gamesPlayed: 9, gamesWon: 4, bestStreak: 3 });
    expect(loaded?.overall.distribution).toEqual([0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(loaded?.perLength[4].gamesPlayed).toBe(0);
    expect(loaded?.perLength[6].gamesPlayed).toBe(0);
  });

  it('stats: keeps the recent games and ids, reading rows as 5-letter games', () => {
    const row = viaJson(record('old'));
    delete row.wordLength;

    const loaded = validateRangeStats(
      legacyStats({ recentGames: [row], recordedGameIds: ['old'] }),
    );

    expect(loaded?.recentGames).toEqual([record('old')]);
    expect(loaded?.recordedGameIds).toEqual(['old']);
  });

  it('stats: rejects a flat bucket with the wrong distribution', () => {
    expect(validateRangeStats(legacyStats({ distribution: [0, 0] }))).toBeNull();
    expect(validateRangeStats(legacyStats({ gamesPlayed: -1 }))).toBeNull();
  });

  it('meta: one list of secrets becomes the 5-letter buffer', () => {
    expect(validateRangeMeta({ recentAnswers: ['PLANT', 'STORM'] })).toEqual({
      recentAnswers: { 4: [], 5: ['PLANT', 'STORM'], 6: [] },
    });
  });

  it('session: a game with no length is a 5-letter game', () => {
    const state = played(submit('BRAVE', 5000));
    const saved = viaJson(state);
    delete saved.wordLength;

    expect(validateRangeSession(saved)).toEqual(state);
  });

  it('prefs: an empty blob reads as the default length', () => {
    localStorage.setItem(keys.prefs, '{}');

    expect(createRangePrefsRepository().read()).toEqual(DEFAULT_RANGE_PREFS);
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

  it.each([
    [4, 'PLAN', 'BRAT'],
    [6, 'PLANET', 'BRAVER'],
  ] as const)('round-trips a %i-letter game, with its own sentinels', (length, secret, guess) => {
    const state = rangeReducer(createRangeGame('g', secret), submit(guess, 900));

    expect(state.wordLength).toBe(length);
    expect(validateRangeSession(JSON.parse(JSON.stringify(state)))).toEqual(state);
    expect(validateRangeSession(JSON.parse(JSON.stringify(createRangeGame('g', secret))))).toEqual(
      createRangeGame('g', secret),
    );
  });

  it('rejects a 5-letter sentinel on a 4-letter game', () => {
    const saved = { ...viaJson(createRangeGame('g', 'PLAN')), lower: 'AAAAA' };

    expect(validateRangeSession(saved)).toBeNull();
  });

  it('rejects a secret whose length is not the game’s', () => {
    expect(validateRangeSession({ ...viaJson(played()), wordLength: 4 })).toBeNull();
  });

  const good = (): Record<string, unknown> =>
    viaJson(played(submit('BRAVE', 5000), submit('STORM', 300)));

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
      'a guess of another length',
      () => ({ ...good(), guesses: [{ word: 'BRAVER', direction: 'after', heat: 'hot' }] }),
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
    createRangePrefsRepository().write({ defaultWordLength: 5 });
    createRangeStatsRepository().write(defaultRangeStats());
    createRangeSessionRepository().write(createRangeGame('g', 'PLANT'));
    createRangeMetaRepository().write(defaultRangeMeta());

    for (const key of [keys.prefs, keys.stats, keys.session, keys.meta])
      expect(localStorage.getItem(key)).not.toBeNull();
    expect(keys.stats).toBe('wordgames:v1:range:stats');
  });

  it('falls back to defaults when nothing is stored', () => {
    expect(createRangePrefsRepository().read()).toEqual(DEFAULT_RANGE_PREFS);
    expect(createRangeStatsRepository().read()).toEqual(defaultRangeStats());
    expect(createRangeSessionRepository().read()).toBeNull();
    expect(createRangeMetaRepository().read()).toEqual(defaultRangeMeta());
  });

  it('round-trips the chosen length', () => {
    const repo = createRangePrefsRepository();

    repo.write({ defaultWordLength: 6 });

    expect(repo.read()).toEqual({ defaultWordLength: 6 });
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

  it('loads a flat stats blob from storage and keeps it after the next game', () => {
    localStorage.setItem(keys.stats, JSON.stringify(legacyStats({ gamesPlayed: 3, gamesWon: 3 })));
    const repo = createRangeStatsRepository();

    const next = recordRangeGame(repo.read(), record('new'));

    expect(next.overall.gamesPlayed).toBe(4);
    expect(next.perLength[5].gamesPlayed).toBe(4);
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
    const old = legacyStats({ gamesPlayed: 9, gamesWon: 4 });
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

    const loaded = validateRangeStats(old);

    expect(loaded?.overall.gamesPlayed).toBe(9);
    expect(loaded?.overall.closestMiss).toBeNull();
    expect(loaded?.overall.timedSolves).toBe(0);
    expect(loaded?.overall.heatTrackedGames).toBe(0);
  });

  it('still loads an old record row that has no detail fields', () => {
    const stats: RangeStatsState = { ...defaultRangeStats(), recentGames: [record('old')] };

    expect(validateRangeStats(viaJson(stats))?.recentGames).toHaveLength(1);
  });

  it('rejects detail fields that are present but wrong', () => {
    expect(validateRangeStats(withOverall({ closestMiss: -3 }))).toBeNull();
  });

  it('adds time on wins only, and tracks the fastest', () => {
    let stats = recordRangeGame(defaultRangeStats(), record('a', { solveMs: 60_000 }));
    stats = recordRangeGame(stats, record('b', { solveMs: 20_000 }));
    stats = recordRangeGame(stats, record('c', { won: false, solveMs: 1_000 }));
    stats = recordRangeGame(stats, record('d'));

    expect(stats.overall).toMatchObject({
      timedSolves: 2,
      totalSolveMs: 80_000,
      fastestSolveMs: 20_000,
    });
  });

  it('keeps the smallest words-left across losses, ignoring wins and rows without it', () => {
    let stats = recordRangeGame(defaultRangeStats(), record('a', { won: false, wordsLeft: 40 }));
    stats = recordRangeGame(stats, record('b', { won: false, wordsLeft: 7 }));
    stats = recordRangeGame(stats, record('c', { won: false, wordsLeft: null }));
    stats = recordRangeGame(stats, record('d', { won: false }));
    stats = recordRangeGame(stats, record('e', { wordsLeft: 1 }));

    expect(stats.overall.closestMiss).toBe(7);
    expect(stats.perLength[5].closestMiss).toBe(7);
  });

  it('counts Burning games, on wins and losses', () => {
    let stats = recordRangeGame(defaultRangeStats(), record('a', { firstBurningGuess: 4 }));
    stats = recordRangeGame(stats, record('b', { won: false, firstBurningGuess: 8 }));
    stats = recordRangeGame(stats, record('c', { firstBurningGuess: null }));
    stats = recordRangeGame(stats, record('d'));

    expect(stats.overall).toMatchObject({
      heatTrackedGames: 3,
      burningGames: 2,
      totalFirstBurningAt: 12,
    });
    expect(rangeAverageFirstBurning(stats.overall)).toBe(6);
    expect(rangeBurningPercentage(stats.overall)).toBe(67);
  });

  it('has no Burning figures before any tracked game', () => {
    expect(rangeAverageFirstBurning(defaultRangeStats().overall)).toBeNull();
    expect(rangeBurningPercentage(defaultRangeStats().overall)).toBeNull();
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
