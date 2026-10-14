import { beforeEach, describe, expect, it } from 'vitest';

import { RECENT_ANSWER_WINDOW, RECENT_GAMES_LIMIT } from '@/engine/constants';
import { createShuffleGame, shuffleReducer, type ShuffleAction } from '@/engine/shuffle';
import type { ShuffleRecord, ShuffleState } from '@/engine/shuffle';

import { gameKeys } from './keys';
import { defaultStats } from './schemas';
import {
  createShuffleMetaRepository,
  createShufflePrefsRepository,
  createShuffleSessionRepository,
  createShuffleStatsRepository,
  recordShuffleGame,
  shuffleAltAnswerPercentage,
  shuffleHintDistribution,
  rememberShuffleAnswer,
  resetShuffleHistory,
  resetShuffleStatistics,
  shuffleAverageHints,
  shuffleGaveUp,
  shuffleSolvePercentage,
} from './shuffleRepositories';
import {
  DEFAULT_SHUFFLE_PREFS,
  defaultShuffleMeta,
  defaultShuffleStats,
  emptyShuffleBucket,
  isShuffleSessionUsable,
  validateShuffleMeta,
  validateShufflePrefs,
  validateShuffleSession,
  validateShuffleStats,
} from './shuffleSchemas';
import { createStatsRepository } from './statsRepository';

/** WordShuffle storage (T-89: FR-137, FR-146, FR-147, AC-56). */

const keys = gameKeys('shuffle');

const solve = (id: string, over: Partial<ShuffleRecord> = {}): ShuffleRecord => ({
  id,
  playedAt: 1_000,
  length: 5,
  target: 'PLANT',
  found: 'PLANT',
  hintsUsed: 0,
  solved: true,
  ...over,
});
const gaveUp = (id: string, over: Partial<ShuffleRecord> = {}): ShuffleRecord =>
  solve(id, { solved: false, found: null, ...over });
const four = (id: string, over: Partial<ShuffleRecord> = {}): ShuffleRecord =>
  solve(id, { length: 4, target: 'LAMB', found: 'LAMB', ...over });

function played(...actions: ShuffleAction[]): ShuffleState {
  return actions.reduce(shuffleReducer, createShuffleGame('g', 6, 'LISTEN', 'NTSELI'));
}
const add = (letters: string): ShuffleAction[] =>
  [...letters].map((letter) => ({ type: 'ADD_LETTER', letter, now: 5 }));
const HINT: ShuffleAction = { type: 'HINT', now: 5 };

beforeEach(() => {
  localStorage.clear();
});

describe('recordShuffleGame (FR-146)', () => {
  it('records a solve without hints overall and for its length', () => {
    const stats = recordShuffleGame(defaultShuffleStats(), solve('a'));

    expect(stats.overall).toMatchObject({
      gamesPlayed: 1,
      gamesSolved: 1,
      solvedWithoutHints: 1,
      totalHintsOnSolves: 0,
      currentStreak: 1,
      bestStreak: 1,
    });
    expect(stats.perLength[5].gamesSolved).toBe(1);
    expect(stats.perLength[4].gamesPlayed).toBe(0);
  });

  it('records a solve with hints: not without hints, and the hints add up', () => {
    let stats = recordShuffleGame(defaultShuffleStats(), solve('a', { hintsUsed: 2 }));
    stats = recordShuffleGame(stats, solve('b', { hintsUsed: 1 }));
    stats = recordShuffleGame(stats, solve('c'));

    expect(stats.overall).toMatchObject({
      gamesSolved: 3,
      solvedWithoutHints: 1,
      totalHintsOnSolves: 3,
    });
    expect(shuffleAverageHints(stats.overall)).toBe(1);
  });

  it('a give up counts as played, resets the streak, keeps the best, and adds no hints', () => {
    let stats = recordShuffleGame(defaultShuffleStats(), solve('a'));
    stats = recordShuffleGame(stats, solve('b'));
    stats = recordShuffleGame(stats, gaveUp('c', { hintsUsed: 2 }));

    expect(stats.overall).toMatchObject({
      gamesPlayed: 3,
      gamesSolved: 2,
      currentStreak: 0,
      bestStreak: 2,
      totalHintsOnSolves: 0,
    });
    expect(shuffleGaveUp(stats.overall)).toBe(1);
  });

  it('keeps separate streaks per length while the overall streak spans all of them', () => {
    let stats = recordShuffleGame(defaultShuffleStats(), solve('a'));
    stats = recordShuffleGame(stats, four('b'));
    stats = recordShuffleGame(stats, four('c', { solved: false, found: null }));

    expect(stats.overall.currentStreak).toBe(0);
    expect(stats.perLength[5].currentStreak).toBe(1);
    expect(stats.perLength[4]).toMatchObject({ gamesPlayed: 2, currentStreak: 0, bestStreak: 1 });
  });

  it('is idempotent by game id, returning the same reference', () => {
    const once = recordShuffleGame(defaultShuffleStats(), solve('a'));

    expect(recordShuffleGame(once, solve('a'))).toBe(once);
  });

  it('keeps only the last 50 games, newest first', () => {
    let stats = defaultShuffleStats();
    for (let i = 0; i < RECENT_GAMES_LIMIT + 5; i += 1) {
      stats = recordShuffleGame(stats, solve(`g${String(i)}`));
    }

    expect(stats.recentGames).toHaveLength(RECENT_GAMES_LIMIT);
    expect(stats.recentGames[0]?.id).toBe('g54');
    expect(stats.overall.gamesPlayed).toBe(55);
  });
});

describe('derived values', () => {
  it('computes the solve percentage, 0 with no puzzles', () => {
    let stats = defaultShuffleStats();
    expect(shuffleSolvePercentage(stats.overall)).toBe(0);

    stats = recordShuffleGame(stats, solve('a'));
    stats = recordShuffleGame(stats, gaveUp('b'));
    stats = recordShuffleGame(stats, solve('c'));
    expect(shuffleSolvePercentage(stats.overall)).toBe(67);
  });

  it('average hints per solve is null with no solves, never NaN', () => {
    expect(shuffleAverageHints(emptyShuffleBucket())).toBeNull();
    expect(
      shuffleAverageHints(recordShuffleGame(defaultShuffleStats(), gaveUp('a')).overall),
    ).toBeNull();
  });

  it('average hints per solve is hints over solves, not over puzzles played', () => {
    let stats = recordShuffleGame(defaultShuffleStats(), solve('a', { hintsUsed: 2 }));
    stats = recordShuffleGame(stats, gaveUp('b'));

    expect(shuffleAverageHints(stats.overall)).toBe(2);
  });
});

describe('resets (FR-47)', () => {
  const stats = recordShuffleGame(recordShuffleGame(defaultShuffleStats(), solve('a')), four('b'));

  it('Reset statistics clears the metrics and keeps the recent games', () => {
    const reset = resetShuffleStatistics(stats);

    expect(reset.overall.gamesPlayed).toBe(0);
    expect(reset.perLength[4].gamesPlayed).toBe(0);
    expect(reset.recentGames).toHaveLength(2);
  });

  it('Reset history clears the recent games and keeps the metrics', () => {
    const reset = resetShuffleHistory(stats);

    expect(reset.recentGames).toEqual([]);
    expect(reset.recordedGameIds).toEqual([]);
    expect(reset.overall.gamesPlayed).toBe(2);
  });
});

describe('the answer buffer, per length (FR-138)', () => {
  it('puts the target at the front of its own length and de-duplicates', () => {
    const meta = rememberShuffleAnswer(
      { recentAnswers: { 4: ['LAMB'], 5: ['STORM', 'PLANT'], 6: [] } },
      5,
      'PLANT',
    );

    expect(meta.recentAnswers[5]).toEqual(['PLANT', 'STORM']);
    expect(meta.recentAnswers[4]).toEqual(['LAMB']);
  });

  it('is capped at the window', () => {
    let meta = defaultShuffleMeta();
    for (let i = 0; i < RECENT_ANSWER_WINDOW + 10; i += 1) {
      meta = rememberShuffleAnswer(meta, 4, `W${String(i).padStart(3, '0')}`);
    }

    expect(meta.recentAnswers[4]).toHaveLength(RECENT_ANSWER_WINDOW);
    expect(meta.recentAnswers[5]).toEqual([]);
  });
});

describe('validators reject hostile input (EC-12)', () => {
  it('prefs: accepts 4, 5 and 6 only, defaulting to 5 (FR-137)', () => {
    expect(DEFAULT_SHUFFLE_PREFS).toEqual({ defaultWordLength: 5 });
    for (const length of [4, 5, 6]) {
      expect(validateShufflePrefs({ defaultWordLength: length })).toEqual({
        defaultWordLength: length,
      });
    }
    for (const bad of [null, 'x', [], {}, { defaultWordLength: 7 }, { defaultWordLength: '5' }]) {
      expect(validateShufflePrefs(bad)).toBeNull();
    }
  });

  it('stats: accepts the default shape', () => {
    expect(validateShuffleStats(defaultShuffleStats())).toEqual(defaultShuffleStats());
  });

  const bucket = () => emptyShuffleBucket();
  const withOverall = (over: Record<string, unknown>) => ({
    ...defaultShuffleStats(),
    overall: { ...bucket(), ...over },
  });

  it.each([
    ['a non-object', () => null],
    ['a bad overall bucket', () => ({ ...defaultShuffleStats(), overall: 'x' })],
    ['a negative count', () => withOverall({ gamesPlayed: -1 })],
    ['a fractional count', () => withOverall({ currentStreak: 1.5 })],
    ['more solves than puzzles', () => withOverall({ gamesSolved: 2, gamesPlayed: 1 })],
    [
      'more solves without hints than solves',
      () => withOverall({ gamesPlayed: 2, gamesSolved: 1, solvedWithoutHints: 2 }),
    ],
    [
      'a hinted solve with no hints counted',
      () => withOverall({ gamesPlayed: 1, gamesSolved: 1, solvedWithoutHints: 0 }),
    ],
    [
      'more hints than the limit allows',
      () =>
        withOverall({
          gamesPlayed: 1,
          gamesSolved: 1,
          solvedWithoutHints: 0,
          totalHintsOnSolves: 3,
        }),
    ],
    ['no perLength', () => ({ ...defaultShuffleStats(), perLength: 'x' })],
    [
      'a missing length bucket',
      () => ({ ...defaultShuffleStats(), perLength: { 4: bucket(), 5: bucket() } }),
    ],
    ['no recent games array', () => ({ ...defaultShuffleStats(), recentGames: 'x' })],
  ])('stats: rejects %s', (_name, make) => {
    expect(validateShuffleStats(make())).toBeNull();
  });

  it('stats: keeps good history rows beside bad ones, tolerates missing ids and caps at 50', () => {
    const many = Array.from({ length: 60 }, (_, i) => solve(`g${String(i)}`));
    const parsed = validateShuffleStats({
      ...defaultShuffleStats(),
      recentGames: [solve('ok'), { id: '' }, 'junk', solve('bad', { target: 'nope' }), ...many],
      recordedGameIds: undefined,
    });

    expect(parsed?.recentGames[0]?.id).toBe('ok');
    expect(parsed?.recentGames).toHaveLength(50);
    expect(parsed?.recordedGameIds).toEqual([]);
  });

  it.each([
    ['no id', { id: '' }],
    ['a bad time', { playedAt: 'x' }],
    ['an unknown length', { length: 7 }],
    ['a target of the wrong length', { length: 4, target: 'PLANT' }],
    ['more hints than the limit', { hintsUsed: 3 }],
    ['a negative hint count', { hintsUsed: -1 }],
    ['a non-boolean solved', { solved: 1 }],
    ['a solve with no word found', { found: null }],
    ['a give up that names a word', { solved: false, found: 'PLANT' }],
    ['a found word of the wrong length', { found: 'PLAN' }],
  ])('stats: drops a history row with %s', (_name, over) => {
    const parsed = validateShuffleStats({
      ...defaultShuffleStats(),
      recentGames: [{ ...solve('x'), ...over }],
    });

    expect(parsed?.recentGames).toEqual([]);
  });

  it('meta: accepts the default, fills a missing length and rejects the rest', () => {
    expect(validateShuffleMeta(defaultShuffleMeta())).toEqual(defaultShuffleMeta());
    expect(validateShuffleMeta({ recentAnswers: { 5: ['PLANT'] } })).toEqual({
      recentAnswers: { 4: [], 5: ['PLANT'], 6: [] },
    });
    expect(validateShuffleMeta({ recentAnswers: { 4: 'x', 5: [1], 6: [] } })).toEqual(
      defaultShuffleMeta(),
    );
    expect(validateShuffleMeta({ recentAnswers: 'x' })).toBeNull();
    expect(validateShuffleMeta(null)).toBeNull();
  });
});

describe('session shape (FR-147)', () => {
  it('round-trips a puzzle in progress with hints, typed letters and the tray order exactly', () => {
    const state = played(HINT, ...add('TS'), {
      type: 'RESHUFFLE',
      tray: ['E', 'N', 'I'],
    });

    const restored = validateShuffleSession(JSON.parse(JSON.stringify(state)));

    expect(restored).toEqual(state);
    expect(restored?.hinted).toEqual([0]);
    expect(restored?.tray).toEqual(['E', 'N', 'I']);
  });

  it('round-trips a solved and a given-up puzzle, and every length', () => {
    const solved = played(...add('SILENT'), {
      type: 'SUBMIT_ANSWER',
      word: 'SILENT',
      anagrams: ['LISTEN', 'SILENT'],
      now: 9,
    });
    const gave = played({ type: 'GIVE_UP', anagrams: ['LISTEN'], now: 9 });

    expect(validateShuffleSession(JSON.parse(JSON.stringify(solved)))).toEqual(solved);
    expect(validateShuffleSession(JSON.parse(JSON.stringify(gave)))).toEqual(gave);
    for (const length of [4, 5] as const) {
      const game = createShuffleGame('g', length, 'A'.repeat(length), 'A'.repeat(length));
      expect(validateShuffleSession(JSON.parse(JSON.stringify(game)))).toEqual(game);
    }
  });

  const good = (): Record<string, unknown> =>
    JSON.parse(JSON.stringify(played(HINT, ...add('TS')))) as Record<string, unknown>;

  it.each([
    ['a non-object', () => 'x'],
    ['no id', () => ({ ...good(), id: '' })],
    ['an unknown length', () => ({ ...good(), wordLength: 7 })],
    ['a target of the wrong length', () => ({ ...good(), target: 'LIST' })],
    ['a lowercase scramble', () => ({ ...good(), scramble: 'ntseli' })],
    ['a scramble that is not an anagram of the target', () => ({ ...good(), scramble: 'NTSELX' })],
    ['an unknown status', () => ({ ...good(), status: 'revealing' })],
    ['a bad start time', () => ({ ...good(), startedAt: 'x' })],
    ['a bad finish time', () => ({ ...good(), finishedAt: 'x' })],
    ['a tray that is not an array', () => ({ ...good(), tray: 'x' })],
    ['a tray with a non-letter', () => ({ ...good(), tray: ['E', 'N', 'I', '1'] })],
    ['a row of the wrong length', () => ({ ...good(), slots: ['L', 'T'] })],
    ['a row with a non-letter', () => ({ ...good(), slots: ['L', 'T', 'S', 5, null, null] })],
    ['a tray that gains a letter', () => ({ ...good(), tray: ['E', 'N', 'I', 'Z'] })],
    ['a tray that loses a letter', () => ({ ...good(), tray: ['E', 'N'] })],
    ['hints that are not an array', () => ({ ...good(), hinted: 'x' })],
    ['more hints than the limit', () => ({ ...good(), hinted: [0, 1, 2] })],
    ['a hint outside the row', () => ({ ...good(), hinted: [9] })],
    ['a fractional hint position', () => ({ ...good(), hinted: [0.5] })],
    ['a repeated hint position', () => ({ ...good(), hinted: [0, 0] })],
    ['hint positions out of order', () => ({ ...good(), hinted: [1, 0] })],
    ['a hinted slot that holds the wrong letter', () => ({ ...good(), hinted: [1] })],
    ['anagrams that are not strings', () => ({ ...good(), anagrams: [1] })],
    ['a found word while playing', () => ({ ...good(), found: 'LISTEN' })],
    ['a solve with no word found', () => ({ ...good(), status: 'solved', found: null })],
  ])('rejects %s', (_name, make) => {
    expect(validateShuffleSession(make())).toBeNull();
  });
});

describe('isShuffleSessionUsable (FR-147)', () => {
  const session = played(HINT);

  it('accepts a puzzle whose target is still in the list', () => {
    expect(isShuffleSessionUsable(session, (word) => word === 'LISTEN')).toBe(true);
  });

  it('discards nothing-saved, and a target that has left the list', () => {
    expect(isShuffleSessionUsable(null, () => true)).toBe(false);
    expect(isShuffleSessionUsable(session, () => false)).toBe(false);
  });
});

describe('repositories (FR-99, AC-56)', () => {
  it('prefs, stats, session and meta each use their own key under wordgames:v1:shuffle:', () => {
    createShufflePrefsRepository().write(DEFAULT_SHUFFLE_PREFS);
    createShuffleStatsRepository().write(defaultShuffleStats());
    createShuffleSessionRepository().write(played());
    createShuffleMetaRepository().write(defaultShuffleMeta());

    for (const key of [keys.prefs, keys.stats, keys.session, keys.meta]) {
      expect(localStorage.getItem(key)).not.toBeNull();
      expect(key.startsWith('wordgames:v1:shuffle:')).toBe(true);
    }
  });

  it('falls back to defaults when nothing is stored', () => {
    expect(createShufflePrefsRepository().read()).toEqual(DEFAULT_SHUFFLE_PREFS);
    expect(createShuffleStatsRepository().read()).toEqual(defaultShuffleStats());
    expect(createShuffleSessionRepository().read()).toBeNull();
    expect(createShuffleMetaRepository().read()).toEqual(defaultShuffleMeta());
  });

  it('round-trips and clears a session with its hints', () => {
    const repo = createShuffleSessionRepository();
    const state = played(HINT, ...add('S'));

    repo.write(state);
    expect(repo.read()).toEqual(state);

    repo.clear();
    expect(repo.read()).toBeNull();
  });

  it('reports corrupt data through the callback and returns defaults (EC-12)', () => {
    const issues: string[] = [];
    localStorage.setItem(keys.stats, '{not json');

    const stats = createShuffleStatsRepository((_issue, key) => issues.push(key)).read();

    expect(stats).toEqual(defaultShuffleStats());
    expect(issues).toEqual([keys.stats]);
  });

  it('resetting WordShuffle statistics leaves Wordwright stats byte-identical (AC-56)', () => {
    createStatsRepository('wordwright').write(defaultStats());
    const before = localStorage.getItem(gameKeys('wordwright').stats);

    const shuffle = createShuffleStatsRepository();
    shuffle.write(recordShuffleGame(defaultShuffleStats(), solve('a')));
    shuffle.write(resetShuffleStatistics(shuffle.read()));

    expect(localStorage.getItem(gameKeys('wordwright').stats)).toBe(before);
    expect(shuffle.read().overall.gamesPlayed).toBe(0);
  });
});

describe('detail stats added after release', () => {
  const NEW_FIELDS = [
    'timeDistribution',
    'multiAnswerSolves',
    'altAnswerSolves',
    'timedSolves',
    'totalSolveMs',
    'fastestSolveMs',
  ];

  it('loads a stats blob saved before the new fields existed, without a reset', () => {
    const old = JSON.parse(JSON.stringify(defaultShuffleStats())) as {
      overall: Record<string, unknown>;
      perLength: Record<string, Record<string, unknown>>;
    };
    for (const bucket of Object.values({ overall: old.overall, ...old.perLength })) {
      for (const field of NEW_FIELDS) delete bucket[field];
    }
    old.overall.gamesPlayed = 4;
    old.overall.gamesSolved = 3;
    old.overall.solvedWithoutHints = 3;

    const loaded = validateShuffleStats(old);

    expect(loaded?.overall.gamesSolved).toBe(3);
    expect(loaded?.overall.timedSolves).toBe(0);
    expect(loaded?.overall.timeDistribution).toEqual([0, 0, 0, 0, 0]);
    expect(loaded?.perLength[5].altAnswerSolves).toBe(0);
  });

  it('still loads an old record row that has no detail fields', () => {
    const stats = { ...defaultShuffleStats(), recentGames: [solve('old')] };

    expect(validateShuffleStats(JSON.parse(JSON.stringify(stats)))?.recentGames).toHaveLength(1);
  });

  it('rejects a time chart that does not match the timed solves', () => {
    const bad = JSON.parse(JSON.stringify(defaultShuffleStats())) as {
      overall: Record<string, unknown>;
    };
    bad.overall.timeDistribution = [1, 0, 0, 0, 0];

    expect(validateShuffleStats(bad)).toBeNull();
  });

  it('sorts timed solves into their time bucket and tracks the fastest', () => {
    let stats = recordShuffleGame(defaultShuffleStats(), solve('a', { solveMs: 4_000 }));
    stats = recordShuffleGame(stats, solve('b', { solveMs: 25_000 }));
    stats = recordShuffleGame(stats, solve('c', { solveMs: 65_000 }));
    stats = recordShuffleGame(stats, solve('d', { solveMs: 500_000 }));
    stats = recordShuffleGame(stats, gaveUp('e', { solveMs: 1_000 }));
    stats = recordShuffleGame(stats, solve('f'));

    expect(stats.overall.timeDistribution).toEqual([1, 1, 0, 1, 1]);
    expect(stats.overall).toMatchObject({
      timedSolves: 4,
      totalSolveMs: 594_000,
      fastestSolveMs: 4_000,
    });
    expect(stats.perLength[5].timeDistribution).toEqual([1, 1, 0, 1, 1]);
  });

  it('counts another anagram only in puzzles that had several answers', () => {
    let stats = recordShuffleGame(
      defaultShuffleStats(),
      solve('a', { found: 'SLANT', anagramCount: 2 }),
    );
    stats = recordShuffleGame(stats, solve('b', { anagramCount: 3 }));
    stats = recordShuffleGame(stats, solve('c', { anagramCount: 1 }));
    stats = recordShuffleGame(stats, solve('d'));

    expect(stats.overall).toMatchObject({ multiAnswerSolves: 2, altAnswerSolves: 1 });
    expect(shuffleAltAnswerPercentage(stats.overall)).toBe(50);
  });

  it('derives solves by hints from counts saved before the chart existed', () => {
    let stats = recordShuffleGame(defaultShuffleStats(), solve('a'));
    stats = recordShuffleGame(stats, solve('b', { hintsUsed: 1 }));
    stats = recordShuffleGame(stats, solve('c', { hintsUsed: 2 }));
    stats = recordShuffleGame(stats, solve('d', { hintsUsed: 2 }));
    stats = recordShuffleGame(stats, gaveUp('e', { hintsUsed: 2 }));

    expect(shuffleHintDistribution(stats.overall)).toEqual([1, 1, 2]);
  });

  it('keeps the new fields on a stored record', () => {
    const row = solve('a', { solveMs: 777, anagramCount: 2 });
    const stats = { ...defaultShuffleStats(), recentGames: [row] };

    expect(validateShuffleStats(JSON.parse(JSON.stringify(stats)))?.recentGames[0]).toEqual(row);
  });
});
