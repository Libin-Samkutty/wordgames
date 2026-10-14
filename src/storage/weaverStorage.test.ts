import { beforeEach, describe, expect, it } from 'vitest';

import { RECENT_GAMES_LIMIT } from '@/engine/constants';
import { RECENT_START_WINDOW } from '@/engine/weaver/constants';
import { createWeaverGame, weaverReducer, type WeaverAction } from '@/engine/weaver/reducer';
import type { WeaverRecord, WeaverState } from '@/engine/weaver/types';

import { gameKeys } from './keys';
import { defaultStats } from './schemas';
import { createStatsRepository, recordGame } from './statsRepository';
import {
  averageOverPar,
  createWeaverMetaRepository,
  createWeaverPrefsRepository,
  createWeaverSessionRepository,
  createWeaverStatsRepository,
  recordWeaverGame,
  rememberStart,
  resetWeaverHistory,
  resetWeaverStatistics,
  weaverAverageUndos,
  weaverGaveUp,
  weaverSolvePercentage,
} from './weaverRepositories';
import {
  DEFAULT_WEAVER_PREFS,
  defaultWeaverMeta,
  defaultWeaverStats,
  isWeaverSessionUsable,
  validateWeaverMeta,
  validateWeaverPrefs,
  validateWeaverSession,
  validateWeaverStats,
} from './weaverSchemas';

/**
 * WordWeaver storage (T-65: FR-68, FR-92, FR-93, EC-33, AC-38).
 */

const keys = gameKeys('weaver');

function record(overrides: Partial<WeaverRecord> = {}): WeaverRecord {
  return {
    id: 'g1',
    playedAt: 1_000,
    length: 4,
    start: 'COLD',
    end: 'WARM',
    par: 4,
    moves: 4,
    ladderLength: 4,
    solved: true,
    ...overrides,
  };
}

const solved = (id: string, moves = 4, length: 4 | 5 = 4): WeaverRecord =>
  record({ id, moves, length, ladderLength: moves });
const gaveUp = (id: string): WeaverRecord =>
  record({ id, solved: false, moves: 2, ladderLength: 2 });

describe('recordWeaverGame (FR-92)', () => {
  it('records a solve overall and for its length', () => {
    const stats = recordWeaverGame(defaultWeaverStats(), solved('a'));

    expect(stats.overall).toMatchObject({
      gamesPlayed: 1,
      gamesSolved: 1,
      parHits: 1,
      totalOverPar: 0,
      bestOverPar: 0,
      currentStreak: 1,
      bestStreak: 1,
    });
    expect(stats.perLength[4]).toEqual(stats.overall);
    expect(stats.perLength[5]).toEqual(defaultWeaverStats().perLength[5]);
    expect(stats.recentGames).toEqual([solved('a')]);
  });

  it('keeps the best solve against par: the lowest moves minus par, never raised by a worse one', () => {
    let stats = recordWeaverGame(defaultWeaverStats(), solved('a', 6));
    expect(stats.overall.bestOverPar).toBe(2);

    stats = recordWeaverGame(stats, solved('b', 3));
    expect(stats.overall.bestOverPar).toBe(-1);

    stats = recordWeaverGame(stats, solved('c', 5));
    stats = recordWeaverGame(stats, gaveUp('d'));
    expect(stats.overall.bestOverPar).toBe(-1);
    expect(stats.perLength[5].bestOverPar).toBeNull();
  });

  it('a give up never sets the best against par', () => {
    expect(recordWeaverGame(defaultWeaverStats(), gaveUp('a')).overall.bestOverPar).toBeNull();
  });

  it('reads stats saved without a best as having none, and rejects a bad one', () => {
    const legacy: Record<string, unknown> = { ...defaultWeaverStats().overall };
    delete legacy.bestOverPar;
    const stats = { ...defaultWeaverStats(), overall: legacy };

    expect(validateWeaverStats(stats)?.overall.bestOverPar).toBeNull();
    expect(validateWeaverStats({ ...stats, overall: { ...legacy, bestOverPar: 1.5 } })).toBeNull();
    expect(
      validateWeaverStats({ ...stats, overall: { ...legacy, bestOverPar: -2 } })?.overall
        .bestOverPar,
    ).toBe(-2);
  });

  it('counts a solve at par as a par hit (AC-30)', () => {
    const stats = recordWeaverGame(defaultWeaverStats(), solved('a', 4));

    expect(stats.overall.parHits).toBe(1);
    expect(stats.overall.totalOverPar).toBe(0);
  });

  it('does not count a solve over par as a par hit, and adds the excess', () => {
    const stats = recordWeaverGame(defaultWeaverStats(), solved('a', 7));

    expect(stats.overall.parHits).toBe(0);
    expect(stats.overall.totalOverPar).toBe(3);
  });

  it('counts a solve under par as a par hit and lets average over par go negative (AC-44)', () => {
    const stats = recordWeaverGame(defaultWeaverStats(), solved('a', 3));

    expect(stats.overall.parHits).toBe(1);
    expect(stats.overall.totalOverPar).toBe(-1);
    expect(averageOverPar(stats.overall)).toBe(-1);
  });

  it('records a give up as played, not solved, with the streak reset and best kept', () => {
    let stats = recordWeaverGame(defaultWeaverStats(), solved('a'));
    stats = recordWeaverGame(stats, solved('b'));
    stats = recordWeaverGame(stats, gaveUp('c'));

    expect(stats.overall).toMatchObject({
      gamesPlayed: 3,
      gamesSolved: 2,
      currentStreak: 0,
      bestStreak: 2,
    });
    expect(weaverGaveUp(stats.overall)).toBe(1);
  });

  it('a give up adds nothing to par hits or average over par', () => {
    const stats = recordWeaverGame(defaultWeaverStats(), gaveUp('a'));

    expect(stats.overall.parHits).toBe(0);
    expect(stats.overall.totalOverPar).toBe(0);
    expect(averageOverPar(stats.overall)).toBeNull();
  });

  it('builds a streak and keeps the best after it breaks', () => {
    let stats = defaultWeaverStats();
    for (const id of ['a', 'b', 'c']) stats = recordWeaverGame(stats, solved(id));
    stats = recordWeaverGame(stats, gaveUp('d'));
    stats = recordWeaverGame(stats, solved('e'));

    expect(stats.overall.currentStreak).toBe(1);
    expect(stats.overall.bestStreak).toBe(3);
  });

  it('keeps separate streaks per length while the overall streak spans both', () => {
    let stats = defaultWeaverStats();
    stats = recordWeaverGame(stats, solved('a', 4, 4));
    stats = recordWeaverGame(stats, solved('b', 4, 5));
    stats = recordWeaverGame(stats, gaveUp('c')); // a 4-letter give up

    expect(stats.perLength[4].currentStreak).toBe(0);
    expect(stats.perLength[5].currentStreak).toBe(1);
    expect(stats.overall.currentStreak).toBe(0);
    expect(stats.overall.bestStreak).toBe(2);
  });

  it('is idempotent by game id, returning the same reference (FR-92)', () => {
    const once = recordWeaverGame(defaultWeaverStats(), solved('a'));

    expect(recordWeaverGame(once, solved('a'))).toBe(once);
  });

  it('keeps only the last 50 games, newest first', () => {
    let stats = defaultWeaverStats();
    for (let i = 0; i < RECENT_GAMES_LIMIT + 5; i += 1) {
      stats = recordWeaverGame(stats, solved(`g${String(i)}`));
    }

    expect(stats.recentGames).toHaveLength(RECENT_GAMES_LIMIT);
    expect(stats.recentGames[0]?.id).toBe(`g${String(RECENT_GAMES_LIMIT + 4)}`);
    expect(stats.overall.gamesPlayed).toBe(RECENT_GAMES_LIMIT + 5);
    expect(stats.recordedGameIds.length).toBeLessThanOrEqual(RECENT_GAMES_LIMIT * 2);
  });

  it('records a finished game from the engine', () => {
    const play = (state: WeaverState, ...actions: WeaverAction[]): WeaverState =>
      actions.reduce(weaverReducer, state);
    let state = createWeaverGame('e1', { length: 4, start: 'COLD', end: 'WARM', par: 4 });
    for (const word of ['CORD', 'CARD', 'WARD', 'WARM']) {
      state = play(
        state,
        { type: 'SUBMIT_RUNG', word, now: 1 },
        { type: 'REVEAL_COMPLETE', now: 2 },
      );
    }
    // `weaverRecord` is the engine's own projection.
    const stats = recordWeaverGame(defaultWeaverStats(), {
      id: state.id,
      playedAt: state.finishedAt ?? 0,
      length: state.length,
      start: state.start,
      end: state.end,
      par: state.par,
      moves: state.moves,
      ladderLength: state.rungs.length,
      solved: true,
    });

    expect(stats.overall).toMatchObject({ gamesSolved: 1, parHits: 1 });
  });
});

describe('derived statistics (FR-92)', () => {
  it('solve percentage rounds, and is 0 with no games, never NaN', () => {
    expect(weaverSolvePercentage(defaultWeaverStats().overall)).toBe(0);
    let stats = defaultWeaverStats();
    stats = recordWeaverGame(stats, solved('a'));
    stats = recordWeaverGame(stats, solved('b'));
    stats = recordWeaverGame(stats, gaveUp('c'));

    expect(weaverSolvePercentage(stats.overall)).toBe(67);
  });

  it('average over par is null with no solves and a plain mean otherwise', () => {
    expect(averageOverPar(defaultWeaverStats().overall)).toBeNull();
    let stats = recordWeaverGame(defaultWeaverStats(), solved('a', 6)); // +2
    stats = recordWeaverGame(stats, solved('b', 3)); // -1

    expect(averageOverPar(stats.overall)).toBe(0.5);
  });
});

describe('resets (FR-47, FR-67)', () => {
  function played() {
    let stats = defaultWeaverStats();
    stats = recordWeaverGame(stats, solved('a'));
    return recordWeaverGame(stats, gaveUp('b'));
  }

  it('Reset statistics clears the metrics and keeps the recent games', () => {
    const reset = resetWeaverStatistics(played());

    expect(reset.overall).toEqual(defaultWeaverStats().overall);
    expect(reset.perLength).toEqual(defaultWeaverStats().perLength);
    expect(reset.recentGames).toHaveLength(2);
  });

  it('Reset history clears the recent games and keeps the metrics', () => {
    const reset = resetWeaverHistory(played());

    expect(reset.recentGames).toEqual([]);
    expect(reset.recordedGameIds).toEqual([]);
    expect(reset.overall.gamesPlayed).toBe(2);
  });
});

describe('start buffer (FR-78)', () => {
  it('puts the newest start first and de-duplicates', () => {
    let meta = defaultWeaverMeta();
    meta = rememberStart(meta, 4, 'COLD');
    meta = rememberStart(meta, 4, 'WARM');
    meta = rememberStart(meta, 4, 'COLD');

    expect(meta.recentStarts[4]).toEqual(['COLD', 'WARM']);
    expect(meta.recentStarts[5]).toEqual([]);
  });

  it('keeps only the last 20 per length', () => {
    let meta = defaultWeaverMeta();
    for (let i = 0; i < RECENT_START_WINDOW + 5; i += 1) {
      meta = rememberStart(meta, 5, `W${String(i)}`);
    }

    expect(meta.recentStarts[5]).toHaveLength(RECENT_START_WINDOW);
    expect(meta.recentStarts[5][0]).toBe(`W${String(RECENT_START_WINDOW + 4)}`);
  });
});

describe('validators reject hostile input (EC-12)', () => {
  it('prefs: accepts 4 and 5 only', () => {
    expect(validateWeaverPrefs({ defaultWordLength: 4 })).toEqual({ defaultWordLength: 4 });
    expect(validateWeaverPrefs({ defaultWordLength: 5 })).toEqual({ defaultWordLength: 5 });
    for (const bad of [null, [], 'x', {}, { defaultWordLength: 6 }, { defaultWordLength: '4' }]) {
      expect(validateWeaverPrefs(bad)).toBeNull();
    }
  });

  it('stats: accepts the default shape', () => {
    expect(validateWeaverStats(defaultWeaverStats())).toEqual(defaultWeaverStats());
  });

  it.each([
    ['null', null],
    ['an array', []],
    ['a missing overall', { ...defaultWeaverStats(), overall: undefined }],
    ['a missing per-length bucket', { ...defaultWeaverStats(), perLength: { 4: {} } }],
    ['perLength not an object', { ...defaultWeaverStats(), perLength: 'x' }],
    ['recentGames not an array', { ...defaultWeaverStats(), recentGames: 'x' }],
    [
      'negative games played',
      { ...defaultWeaverStats(), overall: { ...defaultWeaverStats().overall, gamesPlayed: -1 } },
    ],
    [
      'more solved than played',
      {
        ...defaultWeaverStats(),
        overall: { ...defaultWeaverStats().overall, gamesPlayed: 1, gamesSolved: 2 },
      },
    ],
    [
      'more par hits than solves',
      {
        ...defaultWeaverStats(),
        overall: { ...defaultWeaverStats().overall, gamesPlayed: 2, gamesSolved: 1, parHits: 2 },
      },
    ],
    [
      'a fractional total over par',
      { ...defaultWeaverStats(), overall: { ...defaultWeaverStats().overall, totalOverPar: 0.5 } },
    ],
  ])('stats: rejects %s', (_label, value) => {
    expect(validateWeaverStats(value)).toBeNull();
  });

  it('stats: accepts a negative total over par', () => {
    const stats = {
      ...defaultWeaverStats(),
      overall: {
        ...defaultWeaverStats().overall,
        gamesPlayed: 1,
        gamesSolved: 1,
        parHits: 1,
        totalOverPar: -2,
      },
    };

    expect(validateWeaverStats(stats)?.overall.totalOverPar).toBe(-2);
  });

  it('stats: drops malformed history rows but keeps the rest', () => {
    const stats = {
      ...defaultWeaverStats(),
      recentGames: [
        solved('good'),
        { id: 'bad' },
        null,
        record({ id: 'bad2', length: 6 as never }),
      ],
      recordedGameIds: ['good'],
    };

    expect(validateWeaverStats(stats)?.recentGames.map((r) => r.id)).toEqual(['good']);
  });

  it.each([
    ['empty id', { id: '' }],
    ['non-finite playedAt', { playedAt: Number.NaN }],
    ['wrong start length', { start: 'COL' }],
    ['lowercase end', { end: 'warm' }],
    ['negative par', { par: -1 }],
    ['fractional moves', { moves: 1.5 }],
    ['negative ladder length', { ladderLength: -1 }],
    ['non-boolean solved', { solved: 'yes' as never }],
  ])('stats: drops a history row with %s', (_label, bad) => {
    const stats = { ...defaultWeaverStats(), recentGames: [record(bad)] };

    expect(validateWeaverStats(stats)?.recentGames).toEqual([]);
  });

  it('stats: tolerates a missing recordedGameIds', () => {
    const { overall, perLength, recentGames } = defaultWeaverStats();
    const without = { overall, perLength, recentGames };

    expect(validateWeaverStats(without)?.recordedGameIds).toEqual([]);
  });

  it('stats: caps the history at 50', () => {
    const many = Array.from({ length: 60 }, (_unused, i) => solved(`g${String(i)}`));
    const stats = { ...defaultWeaverStats(), recentGames: many };

    expect(validateWeaverStats(stats)?.recentGames).toHaveLength(RECENT_GAMES_LIMIT);
  });

  it('meta: accepts the default and repairs a bad length entry', () => {
    expect(validateWeaverMeta(defaultWeaverMeta())).toEqual(defaultWeaverMeta());
    expect(validateWeaverMeta({ recentStarts: { 4: ['COLD'], 5: 'x' } })).toEqual({
      recentStarts: { 4: ['COLD'], 5: [] },
    });
  });

  it.each([null, [], 'x', {}, { recentStarts: 'x' }])('meta: rejects %j', (bad) => {
    expect(validateWeaverMeta(bad)).toBeNull();
  });
});

describe('session shape (FR-93)', () => {
  function saved(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    const base = createWeaverGame('s1', { length: 4, start: 'COLD', end: 'WARM', par: 4 });
    return {
      ...base,
      rungs: [
        { word: 'CORD', evaluation: ['absent', 'absent', 'correct', 'absent'] },
        { word: 'CARD', evaluation: ['absent', 'correct', 'correct', 'absent'] },
      ],
      moves: 3,
      currentInput: 'WA',
      ...overrides,
    };
  }

  it('round-trips a game in progress, including moves and typed letters (AC-40)', () => {
    const value = saved();

    expect(validateWeaverSession(value)).toEqual(value);
  });

  it('keeps a revealing status for the provider to finish (EC-23)', () => {
    expect(validateWeaverSession(saved({ status: 'revealing' }))?.status).toBe('revealing');
  });

  it('keeps a stored give-up ladder', () => {
    const ladder = ['COLD', 'CORD', 'CARD', 'WARD', 'WARM'];

    expect(
      validateWeaverSession(saved({ status: 'gave-up', optimalLadder: ladder, finishedAt: 9 }))
        ?.optimalLadder,
    ).toEqual(ladder);
  });

  it.each([
    ['null', null],
    ['an array', []],
    ['an empty id', saved({ id: '' })],
    ['a 6-letter length', saved({ length: 6 })],
    ['a lowercase start', saved({ start: 'cold' })],
    ['a start of the wrong length', saved({ start: 'COL' })],
    ['a negative par', saved({ par: -1 })],
    ['moves above the cap', saved({ moves: 501 })],
    ['moves below the rung count', saved({ moves: 1 })],
    ['fractional moves', saved({ moves: 2.5 })],
    ['an over-long input', saved({ currentInput: 'WARMS' })],
    ['a lowercase input', saved({ currentInput: 'wa' })],
    ['a non-string input', saved({ currentInput: 5 })],
    ['an unknown status', saved({ status: 'lost' })],
    ['a bad startedAt', saved({ startedAt: 'now' })],
    ['a bad finishedAt', saved({ finishedAt: Number.POSITIVE_INFINITY })],
    ['rungs not an array', saved({ rungs: 'x' })],
    ['a rung that is not an object', saved({ rungs: [1], moves: 1 })],
    [
      'a rung of the wrong length',
      saved({ rungs: [{ word: 'CARDS', evaluation: ['absent', 'absent', 'absent', 'absent'] }] }),
    ],
    [
      'a rung with a short evaluation',
      saved({ rungs: [{ word: 'CORD', evaluation: ['absent'] }] }),
    ],
    [
      'a rung with a yellow evaluation',
      saved({
        rungs: [{ word: 'CORD', evaluation: ['absent', 'present', 'absent', 'absent'] }],
        moves: 1,
      }),
    ],
    ['an optimalLadder that is not an array', saved({ optimalLadder: 'x' })],
    ['an optimalLadder word of the wrong length', saved({ optimalLadder: ['COLD', 'WARMS'] })],
  ])('rejects %s', (_label, value) => {
    expect(validateWeaverSession(value)).toBeNull();
  });
});

describe('isWeaverSessionUsable: each discard rule (FR-93, EC-33)', () => {
  const answers = new Set(['COLD', 'WARM', 'CARD']);
  const guesses = new Set(['COLD', 'WARM', 'CARD', 'CORD', 'WARD']);
  const isAnswer = (word: string): boolean => answers.has(word);
  const isGuess = (word: string): boolean => guesses.has(word);

  function game(words: string[], overrides: Partial<WeaverState> = {}): WeaverState {
    const base = createWeaverGame('s', { length: 4, start: 'COLD', end: 'WARM', par: 4 });
    return {
      ...base,
      rungs: words.map((word) => ({ word, evaluation: ['absent', 'absent', 'absent', 'absent'] })),
      moves: words.length,
      ...overrides,
    };
  }

  it('accepts a sound game', () => {
    expect(isWeaverSessionUsable(game(['CORD', 'CARD']), 4, isAnswer, isGuess)).toBe(true);
    expect(isWeaverSessionUsable(game([]), 4, isAnswer, isGuess)).toBe(true);
  });

  it('accepts a solved game that ends on the end word', () => {
    const done = game(['CORD', 'CARD', 'WARD', 'WARM'], { status: 'solved' });

    expect(isWeaverSessionUsable(done, 4, isAnswer, isGuess)).toBe(true);
  });

  it('discards nothing-saved', () => {
    expect(isWeaverSessionUsable(null, 4, isAnswer, isGuess)).toBe(false);
  });

  it('discards a game whose length is not the length in use', () => {
    expect(isWeaverSessionUsable(game(['CORD']), 5, isAnswer, isGuess)).toBe(false);
  });

  it('discards a game whose start is no longer an answer', () => {
    expect(
      isWeaverSessionUsable(game(['CORD']), 4, (w) => w !== 'COLD' && isAnswer(w), isGuess),
    ).toBe(false);
  });

  it('discards a game whose end is no longer an answer', () => {
    expect(
      isWeaverSessionUsable(game(['CORD']), 4, (w) => w !== 'WARM' && isAnswer(w), isGuess),
    ).toBe(false);
  });

  it('discards a game whose start and end are the same word', () => {
    expect(isWeaverSessionUsable(game([], { end: 'COLD' }), 4, isAnswer, isGuess)).toBe(false);
  });

  it('discards a game with a rung no longer in the guess list', () => {
    expect(
      isWeaverSessionUsable(game(['CORD', 'CARD']), 4, isAnswer, (w) => w !== 'CARD' && isGuess(w)),
    ).toBe(false);
  });

  it('discards a ladder that breaks the one-letter rule at the first rung', () => {
    expect(isWeaverSessionUsable(game(['WARD']), 4, isAnswer, isGuess)).toBe(false);
  });

  it('discards a ladder that breaks the one-letter rule later on', () => {
    expect(isWeaverSessionUsable(game(['CORD', 'WARM']), 4, isAnswer, isGuess)).toBe(false);
  });

  it('discards a ladder that repeats a word or the start', () => {
    expect(isWeaverSessionUsable(game(['CORD', 'CARD', 'CORD']), 4, isAnswer, isGuess)).toBe(false);
    expect(isWeaverSessionUsable(game(['CORD', 'COLD']), 4, isAnswer, isGuess)).toBe(false);
  });

  it('discards a game that claims to be solved without ending on the end word', () => {
    expect(
      isWeaverSessionUsable(game(['CORD', 'CARD'], { status: 'solved' }), 4, isAnswer, isGuess),
    ).toBe(false);
  });
});

describe('repositories (FR-68)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('prefs, stats, session and meta each use their own key', () => {
    createWeaverPrefsRepository().write({ defaultWordLength: 5 });
    createWeaverStatsRepository().write(defaultWeaverStats());
    createWeaverSessionRepository().write(
      createWeaverGame('s', { length: 4, start: 'COLD', end: 'WARM', par: 4 }),
    );
    createWeaverMetaRepository().write(defaultWeaverMeta());

    const stored = Array.from({ length: localStorage.length }, (_unused, i) =>
      localStorage.key(i),
    ).sort();
    expect(stored).toEqual([keys.meta, keys.prefs, keys.session, keys.stats].sort());
  });

  it('falls back to defaults when nothing is stored', () => {
    expect(createWeaverPrefsRepository().read()).toEqual(DEFAULT_WEAVER_PREFS);
    expect(createWeaverStatsRepository().read()).toEqual(defaultWeaverStats());
    expect(createWeaverSessionRepository().read()).toBeNull();
    expect(createWeaverMetaRepository().read()).toEqual(defaultWeaverMeta());
  });

  it('defaults WordWeaver to 4 letters (FR-74)', () => {
    expect(DEFAULT_WEAVER_PREFS.defaultWordLength).toBe(4);
  });

  it('round-trips a session and clears it', () => {
    const repo = createWeaverSessionRepository();
    const game = createWeaverGame('s', { length: 5, start: 'CRANE', end: 'SLOTH', par: 6 });

    repo.write(game);
    expect(repo.read()).toEqual(game);

    repo.clear();
    expect(repo.read()).toBeNull();
  });

  it('reports corrupt data through the callback and returns defaults (EC-12)', () => {
    const issues: string[] = [];
    localStorage.setItem(keys.stats, '{ not json');
    localStorage.setItem(keys.session, '"a string"');

    expect(createWeaverStatsRepository((i) => issues.push(i)).read()).toEqual(defaultWeaverStats());
    expect(createWeaverSessionRepository((i) => issues.push(i)).read()).toBeNull();
    expect(issues).toEqual(['corrupt', 'corrupt']);
  });

  it('resetting WordWeaver statistics leaves 10 recorded Wordwright games unchanged (AC-38)', () => {
    const wordwright = createStatsRepository('wordwright');
    let stats = defaultStats();
    for (let i = 0; i < 10; i += 1) {
      stats = recordGame(stats, {
        id: `w${String(i)}`,
        playedAt: i,
        wordLength: 5,
        answer: 'CRANE',
        guessesUsed: 3,
        won: true,
        solveMs: 30_000,
        score: 500,
      });
    }
    wordwright.write(stats);

    const weaver = createWeaverStatsRepository();
    weaver.write(recordWeaverGame(defaultWeaverStats(), solved('a')));

    const before = localStorage.getItem(gameKeys('wordwright').stats);
    weaver.write(resetWeaverStatistics(weaver.read()));

    expect(localStorage.getItem(gameKeys('wordwright').stats)).toBe(before);
    expect(createStatsRepository('wordwright').read().overall.gamesPlayed).toBe(10);
    expect(weaver.read().overall.gamesPlayed).toBe(0);
  });
});

describe('detail stats added after release', () => {
  const NEW_FIELDS = [
    'overParDistribution',
    'totalUndos',
    'hardestParSolved',
    'timedSolves',
    'totalSolveMs',
    'fastestSolveMs',
  ];

  it('loads a stats blob saved before the new fields existed, without a reset', () => {
    const old = JSON.parse(JSON.stringify(defaultWeaverStats())) as {
      overall: Record<string, unknown>;
      perLength: Record<string, Record<string, unknown>>;
    };
    for (const bucket of Object.values({ overall: old.overall, ...old.perLength })) {
      for (const field of NEW_FIELDS) delete bucket[field];
    }
    old.overall.gamesPlayed = 5;
    old.overall.gamesSolved = 4;

    const loaded = validateWeaverStats(old);

    expect(loaded?.overall.gamesSolved).toBe(4);
    expect(loaded?.overall.overParDistribution).toEqual([0, 0, 0, 0, 0]);
    expect(loaded?.overall.hardestParSolved).toBeNull();
    expect(loaded?.perLength[5].timedSolves).toBe(0);
  });

  it('still loads an old record row that has no time', () => {
    const stats = { ...defaultWeaverStats(), recentGames: [record()] };

    expect(validateWeaverStats(JSON.parse(JSON.stringify(stats)))?.recentGames).toHaveLength(1);
  });

  it('rejects a chart that counts more solves than there are', () => {
    const bad = JSON.parse(JSON.stringify(defaultWeaverStats())) as {
      overall: Record<string, unknown>;
    };
    bad.overall.overParDistribution = [1, 0, 0, 0, 0];

    expect(validateWeaverStats(bad)).toBeNull();
  });

  it('sorts solves by moves over par, with four or more in the last bucket', () => {
    let stats = recordWeaverGame(defaultWeaverStats(), solved('a', 4));
    stats = recordWeaverGame(stats, solved('b', 5));
    stats = recordWeaverGame(stats, solved('c', 5));
    stats = recordWeaverGame(stats, solved('d', 8));
    stats = recordWeaverGame(stats, solved('e', 20));
    stats = recordWeaverGame(stats, gaveUp('f'));

    expect(stats.overall.overParDistribution).toEqual([1, 2, 0, 0, 2]);
  });

  it('adds undos from moves beyond the ladder, and averages over the counted solves', () => {
    let stats = recordWeaverGame(
      defaultWeaverStats(),
      record({ id: 'a', moves: 6, ladderLength: 4 }),
    );
    stats = recordWeaverGame(stats, record({ id: 'b', moves: 4, ladderLength: 4 }));

    expect(stats.overall.totalUndos).toBe(2);
    expect(weaverAverageUndos(stats.overall)).toBe(1);
    expect(weaverAverageUndos(defaultWeaverStats().overall)).toBeNull();
  });

  it('keeps the hardest par solved, ignoring give ups', () => {
    let stats = recordWeaverGame(defaultWeaverStats(), record({ id: 'a', par: 5, moves: 5 }));
    stats = recordWeaverGame(stats, record({ id: 'b', par: 4, moves: 4 }));
    stats = recordWeaverGame(stats, record({ id: 'c', par: 7, solved: false }));

    expect(stats.overall.hardestParSolved).toBe(5);
  });

  it('adds time on solves only, and tracks the fastest', () => {
    let stats = recordWeaverGame(defaultWeaverStats(), record({ id: 'a', solveMs: 40_000 }));
    stats = recordWeaverGame(stats, record({ id: 'b', solveMs: 15_000 }));
    stats = recordWeaverGame(stats, record({ id: 'c', solved: false, solveMs: 2_000 }));
    stats = recordWeaverGame(stats, record({ id: 'd' }));

    expect(stats.overall).toMatchObject({
      timedSolves: 2,
      totalSolveMs: 55_000,
      fastestSolveMs: 15_000,
    });
  });

  it('keeps the solve time on a stored record', () => {
    const row = record({ solveMs: 8_765 });
    const stats = { ...defaultWeaverStats(), recentGames: [row] };

    expect(validateWeaverStats(JSON.parse(JSON.stringify(stats)))?.recentGames[0]).toEqual(row);
  });
});
