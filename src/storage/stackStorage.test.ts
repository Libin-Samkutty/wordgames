import { beforeEach, describe, expect, it } from 'vitest';

import { RECENT_ANSWER_WINDOW, RECENT_GAMES_LIMIT } from '@/engine/constants';
import { createStackGame, stackReducer, type StackAction } from '@/engine/stack';
import type { StackRecord, StackState } from '@/engine/stack';

import { gameKeys } from './keys';
import {
  DEFAULT_STACK_PREFS,
  defaultStackMeta,
  defaultStackStats,
  distributionLength,
  isStackSessionUsable,
  validateStackMeta,
  validateStackPrefs,
  validateStackSession,
  validateStackStats,
} from './stackSchemas';
import {
  createStackMetaRepository,
  createStackPrefsRepository,
  createStackSessionRepository,
  createStackStatsRepository,
  recordStackGame,
  rememberStackAnswers,
  resetStackHistory,
  resetStackStatistics,
  stackWinPercentage,
} from './stackRepositories';
import { defaultStats } from './schemas';
import { createStatsRepository } from './statsRepository';
import { createWeaverStatsRepository } from './weaverRepositories';
import { defaultWeaverStats } from './weaverSchemas';

/**
 * WordStack storage (T-77: FR-102, FR-103, FR-111, FR-112, AC-56).
 */

const keys = gameKeys('stack');

function record(id: string, over: Partial<StackRecord> = {}): StackRecord {
  return {
    id,
    playedAt: 1_000,
    mode: 'duo',
    answers: ['PLANT', 'STORM'],
    guessesUsed: 5,
    boardsSolved: 2,
    won: true,
    ...over,
  };
}

const quadRecord = (id: string, over: Partial<StackRecord> = {}): StackRecord =>
  record(id, {
    mode: 'quad',
    answers: ['PLANT', 'STORM', 'CRANE', 'MOUND'],
    guessesUsed: 7,
    boardsSolved: 4,
    ...over,
  });

describe('recordStackGame (FR-111)', () => {
  it('records a Duo win overall and in the Duo bucket, with the distribution', () => {
    const stats = recordStackGame(defaultStackStats(), record('a', { guessesUsed: 5 }));

    expect(stats.overall).toEqual({ gamesPlayed: 1, gamesWon: 1, currentStreak: 1, bestStreak: 1 });
    expect(stats.perMode.duo).toMatchObject({ gamesPlayed: 1, gamesWon: 1 });
    // Duo buckets are 2..7, so 5 guesses is index 3.
    expect(stats.perMode.duo.distribution).toEqual([0, 0, 0, 1, 0, 0]);
    expect(stats.perMode.quad).toEqual(defaultStackStats().perMode.quad);
    expect(stats.recentGames).toHaveLength(1);
  });

  it('uses buckets 2 to 7 for Duo: 2 guesses is the first, 7 the last', () => {
    let stats = recordStackGame(defaultStackStats(), record('a', { guessesUsed: 2 }));
    stats = recordStackGame(stats, record('b', { guessesUsed: 7 }));

    expect(stats.perMode.duo.distribution).toEqual([1, 0, 0, 0, 0, 1]);
  });

  it('uses buckets 4 to 9 for Quad: 4 guesses is the first, 9 the last', () => {
    let stats = recordStackGame(defaultStackStats(), quadRecord('a', { guessesUsed: 4 }));
    stats = recordStackGame(stats, quadRecord('b', { guessesUsed: 9 }));

    expect(stats.perMode.quad.distribution).toEqual([1, 0, 0, 0, 0, 1]);
    expect(distributionLength('duo')).toBe(6);
    expect(distributionLength('quad')).toBe(6);
  });

  it('records a loss as played, with the streak reset and best kept, and no distribution entry', () => {
    let stats = recordStackGame(defaultStackStats(), record('a'));
    stats = recordStackGame(stats, record('b'));
    stats = recordStackGame(stats, record('c', { won: false, guessesUsed: 7, boardsSolved: 1 }));

    expect(stats.overall).toMatchObject({
      gamesPlayed: 3,
      gamesWon: 2,
      currentStreak: 0,
      bestStreak: 2,
    });
    expect(stats.perMode.duo.distribution.reduce((a, b) => a + b, 0)).toBe(2);
  });

  it('keeps separate streaks per mode while the overall streak spans both', () => {
    let stats = recordStackGame(defaultStackStats(), record('a'));
    stats = recordStackGame(stats, quadRecord('b'));
    stats = recordStackGame(stats, quadRecord('c', { won: false }));

    expect(stats.perMode.duo.currentStreak).toBe(1);
    expect(stats.perMode.quad.currentStreak).toBe(0);
    expect(stats.overall.currentStreak).toBe(0);
    expect(stats.overall.bestStreak).toBe(2);
  });

  it('ignores a win outside the mode range rather than corrupting the distribution', () => {
    const stats = recordStackGame(defaultStackStats(), record('a', { guessesUsed: 1 }));

    expect(stats.perMode.duo.distribution).toEqual([0, 0, 0, 0, 0, 0]);
    expect(stats.perMode.duo.gamesWon).toBe(1);
  });

  it('is idempotent by game id, returning the same reference', () => {
    const once = recordStackGame(defaultStackStats(), record('a'));

    expect(recordStackGame(once, record('a'))).toBe(once);
  });

  it('keeps only the last 50 games, newest first', () => {
    let stats = defaultStackStats();
    for (let i = 0; i < RECENT_GAMES_LIMIT + 5; i += 1) {
      stats = recordStackGame(stats, record(`g${String(i)}`));
    }

    expect(stats.recentGames).toHaveLength(RECENT_GAMES_LIMIT);
    expect(stats.recentGames[0]?.id).toBe(`g${String(RECENT_GAMES_LIMIT + 4)}`);
    expect(stats.overall.gamesPlayed).toBe(RECENT_GAMES_LIMIT + 5);
    expect(stats.recordedGameIds.length).toBeLessThanOrEqual(RECENT_GAMES_LIMIT * 2);
  });

  it('computes the win percentage, 0 with no games', () => {
    expect(stackWinPercentage(defaultStackStats().overall)).toBe(0);
    let stats = recordStackGame(defaultStackStats(), record('a'));
    stats = recordStackGame(stats, record('b'));
    stats = recordStackGame(stats, record('c', { won: false }));

    expect(stackWinPercentage(stats.overall)).toBe(67);
  });
});

describe('resets (FR-47)', () => {
  function played() {
    return recordStackGame(
      recordStackGame(defaultStackStats(), record('a')),
      record('b', { won: false }),
    );
  }

  it('Reset statistics clears the metrics and keeps the recent games', () => {
    const reset = resetStackStatistics(played());

    expect(reset.overall).toEqual(defaultStackStats().overall);
    expect(reset.perMode).toEqual(defaultStackStats().perMode);
    expect(reset.recentGames).toHaveLength(2);
  });

  it('Reset history clears the recent games and keeps the metrics', () => {
    const reset = resetStackHistory(played());

    expect(reset.recentGames).toEqual([]);
    expect(reset.recordedGameIds).toEqual([]);
    expect(reset.overall.gamesPlayed).toBe(2);
  });
});

describe('the shared answer buffer (FR-103)', () => {
  it("puts a game's answers at the front and de-duplicates", () => {
    let meta = rememberStackAnswers(defaultStackMeta(), ['PLANT', 'STORM']);
    meta = rememberStackAnswers(meta, ['CRANE', 'PLANT']);

    expect(meta.recentAnswers).toEqual(['CRANE', 'PLANT', 'STORM']);
  });

  it('keeps one buffer for both modes, capped at the window', () => {
    let meta = defaultStackMeta();
    for (let i = 0; i < RECENT_ANSWER_WINDOW; i += 1) {
      meta = rememberStackAnswers(meta, [`A${String(i)}`, `B${String(i)}`]);
    }

    expect(meta.recentAnswers).toHaveLength(RECENT_ANSWER_WINDOW);
    expect(meta.recentAnswers[0]).toBe(`A${String(RECENT_ANSWER_WINDOW - 1)}`);
  });
});

describe('validators reject hostile input (EC-12)', () => {
  it('prefs: accepts duo and quad only, defaulting to Duo (FR-102)', () => {
    expect(DEFAULT_STACK_PREFS).toEqual({ mode: 'duo' });
    expect(validateStackPrefs({ mode: 'quad' })).toEqual({ mode: 'quad' });
    for (const bad of [null, [], 'x', {}, { mode: 'octo' }, { mode: 2 }]) {
      expect(validateStackPrefs(bad)).toBeNull();
    }
  });

  it('stats: accepts the default shape', () => {
    expect(validateStackStats(defaultStackStats())).toEqual(defaultStackStats());
  });

  const base = defaultStackStats();
  it.each([
    ['null', null],
    ['an array', []],
    ['a missing overall', { ...base, overall: undefined }],
    ['perMode not an object', { ...base, perMode: 'x' }],
    ['a missing quad bucket', { ...base, perMode: { duo: base.perMode.duo } }],
    ['a missing duo bucket', { ...base, perMode: { quad: base.perMode.quad } }],
    ['recentGames not an array', { ...base, recentGames: 'x' }],
    ['negative games played', { ...base, overall: { ...base.overall, gamesPlayed: -1 } }],
    [
      'more wins than games',
      { ...base, overall: { ...base.overall, gamesPlayed: 1, gamesWon: 2 } },
    ],
    [
      'a distribution of the wrong length',
      { ...base, perMode: { ...base.perMode, duo: { ...base.perMode.duo, distribution: [0, 0] } } },
    ],
    [
      'a negative distribution entry',
      {
        ...base,
        perMode: {
          ...base.perMode,
          duo: { ...base.perMode.duo, distribution: [-1, 0, 0, 0, 0, 0] },
        },
      },
    ],
    [
      'a distribution that is not an array',
      { ...base, perMode: { ...base.perMode, duo: { ...base.perMode.duo, distribution: 'x' } } },
    ],
  ])('stats: rejects %s', (_label, value) => {
    expect(validateStackStats(value)).toBeNull();
  });

  it.each([
    ['empty id', { id: '' }],
    ['non-finite playedAt', { playedAt: Number.NaN }],
    ['an unknown mode', { mode: 'octo' as never }],
    ['too few answers for the mode', { answers: ['PLANT'] }],
    ['a lowercase answer', { answers: ['plant', 'STORM'] }],
    ['guesses above the mode limit', { guessesUsed: 8 }],
    ['negative guesses', { guessesUsed: -1 }],
    ['more boards solved than exist', { boardsSolved: 3 }],
    ['non-boolean won', { won: 'yes' as never }],
  ])('stats: drops a history row with %s', (_label, bad) => {
    const stats = { ...base, recentGames: [record('x', bad)] };

    expect(validateStackStats(stats)?.recentGames).toEqual([]);
  });

  it('stats: keeps good history rows beside bad ones, tolerates missing ids and caps at 50', () => {
    const many = Array.from({ length: 60 }, (_unused, i) => record(`g${String(i)}`));
    const stats = { ...base, recentGames: [...many, { id: 'bad' }, null] };
    const parsed = validateStackStats({
      overall: base.overall,
      perMode: base.perMode,
      recentGames: stats.recentGames,
    });

    expect(parsed?.recentGames).toHaveLength(RECENT_GAMES_LIMIT);
    expect(parsed?.recordedGameIds).toEqual([]);
  });

  it('meta: accepts the default and rejects non-string buffers', () => {
    expect(validateStackMeta(defaultStackMeta())).toEqual(defaultStackMeta());
    for (const bad of [null, [], 'x', {}, { recentAnswers: 'x' }, { recentAnswers: [1] }]) {
      expect(validateStackMeta(bad)).toBeNull();
    }
  });
});

describe('session shape (FR-112)', () => {
  function playing(): StackState {
    const act = (state: StackState, ...actions: StackAction[]): StackState =>
      actions.reduce(stackReducer, state);
    return act(
      createStackGame('s1', 'duo', ['PLANT', 'STORM']),
      { type: 'SUBMIT_GUESS', word: 'PANEL', now: 1 },
      { type: 'REVEAL_COMPLETE', now: 2 },
      { type: 'SUBMIT_GUESS', word: 'PLANT', now: 3 },
      { type: 'REVEAL_COMPLETE', now: 4 },
      { type: 'ADD_LETTER', letter: 'C', now: 5 },
    );
  }

  it('round-trips a Duo game in progress with a solved board and typed letters', () => {
    const state = playing();

    expect(validateStackSession(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });

  it('round-trips a Quad game', () => {
    const state = createStackGame('q', 'quad', ['PLANT', 'STORM', 'CRANE', 'MOUND']);

    expect(validateStackSession(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });

  it('keeps a revealing status for the provider to finish', () => {
    const state = { ...playing(), status: 'revealing' as const };

    expect(validateStackSession(JSON.parse(JSON.stringify(state)))?.status).toBe('revealing');
  });

  function mutate(over: Record<string, unknown>): unknown {
    return { ...JSON.parse(JSON.stringify(playing())), ...over };
  }

  it.each([
    ['null', null],
    ['an array', []],
    ['an empty id', mutate({ id: '' })],
    ['an unknown mode', mutate({ mode: 'octo' })],
    ['an over-long input', mutate({ currentInput: 'PLANTS' })],
    ['a lowercase input', mutate({ currentInput: 'c' })],
    ['a non-string input', mutate({ currentInput: 3 })],
    ['an unknown status', mutate({ status: 'paused' })],
    ['a bad startedAt', mutate({ startedAt: 'now' })],
    ['a bad finishedAt', mutate({ finishedAt: Number.POSITIVE_INFINITY })],
    ['words not an array', mutate({ words: 'x' })],
    ['a lowercase word', mutate({ words: ['panel', 'PLANT'] })],
    [
      'more words than the mode allows',
      mutate({ words: Array.from({ length: 8 }, () => 'PLANT') }),
    ],
    ['the wrong number of boards', mutate({ boards: [] })],
    ['boards not an array', mutate({ boards: 'x' })],
    ['a board that is not an object', mutate({ boards: [1, 2] })],
    [
      'a lowercase answer',
      mutate({
        boards: [
          { answer: 'plant', guesses: [] },
          { answer: 'STORM', guesses: [] },
        ],
      }),
    ],
    [
      'guesses not an array',
      mutate({
        boards: [
          { answer: 'PLANT', guesses: 'x' },
          { answer: 'STORM', guesses: [] },
        ],
      }),
    ],
    [
      'a guess that is not one of the words',
      mutate({
        boards: [
          {
            answer: 'PLANT',
            guesses: [
              { word: 'CRANE', evaluation: ['absent', 'absent', 'absent', 'absent', 'absent'] },
            ],
          },
          { answer: 'STORM', guesses: [] },
        ],
      }),
    ],
    [
      'a board with more guesses than the game has words',
      mutate({
        words: [],
        boards: [
          {
            answer: 'PLANT',
            guesses: [
              { word: 'PANEL', evaluation: ['absent', 'absent', 'absent', 'absent', 'absent'] },
            ],
          },
          { answer: 'STORM', guesses: [] },
        ],
      }),
    ],
    [
      'a guess with a yellow-less bad state',
      mutate({
        boards: [
          {
            answer: 'PLANT',
            guesses: [
              { word: 'PANEL', evaluation: ['absent', 'wrong', 'absent', 'absent', 'absent'] },
            ],
          },
          { answer: 'STORM', guesses: [] },
        ],
      }),
    ],
    [
      'a guess with a short evaluation',
      mutate({
        boards: [
          { answer: 'PLANT', guesses: [{ word: 'PANEL', evaluation: ['absent'] }] },
          { answer: 'STORM', guesses: [] },
        ],
      }),
    ],
    [
      'a guess that is not an object',
      mutate({
        boards: [
          { answer: 'PLANT', guesses: [5] },
          { answer: 'STORM', guesses: [] },
        ],
      }),
    ],
    [
      'an absurd number of guesses on a board',
      mutate({
        boards: [
          {
            answer: 'PLANT',
            guesses: Array.from({ length: 20 }, () => ({
              word: 'PANEL',
              evaluation: ['absent', 'absent', 'absent', 'absent', 'absent'],
            })),
          },
          { answer: 'STORM', guesses: [] },
        ],
      }),
    ],
  ])('rejects %s', (_label, value) => {
    expect(validateStackSession(value)).toBeNull();
  });
});

describe('isStackSessionUsable (FR-112)', () => {
  const answers = new Set(['PLANT', 'STORM', 'CRANE']);
  const known = (word: string): boolean => answers.has(word);

  it('accepts a game whose answers are all still in the list', () => {
    expect(isStackSessionUsable(createStackGame('s', 'duo', ['PLANT', 'STORM']), known)).toBe(true);
  });

  it('discards nothing-saved', () => {
    expect(isStackSessionUsable(null, known)).toBe(false);
  });

  it('discards a game with an answer that has left the list', () => {
    expect(isStackSessionUsable(createStackGame('s', 'duo', ['PLANT', 'GONER']), known)).toBe(
      false,
    );
  });

  it('discards a game where two boards share an answer', () => {
    expect(isStackSessionUsable(createStackGame('s', 'duo', ['PLANT', 'PLANT']), known)).toBe(
      false,
    );
  });
});

describe('repositories (FR-99, AC-56)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('prefs, stats, session and meta each use their own key under wordgames:v1:stack:', () => {
    createStackPrefsRepository().write({ mode: 'quad' });
    createStackStatsRepository().write(defaultStackStats());
    createStackSessionRepository().write(createStackGame('s', 'duo', ['PLANT', 'STORM']));
    createStackMetaRepository().write(defaultStackMeta());

    const stored = Array.from({ length: localStorage.length }, (_unused, i) =>
      localStorage.key(i),
    ).sort();
    expect(stored).toEqual([keys.meta, keys.prefs, keys.session, keys.stats].sort());
    expect(keys.stats).toBe('wordgames:v1:stack:stats');
  });

  it('falls back to defaults when nothing is stored', () => {
    expect(createStackPrefsRepository().read()).toEqual(DEFAULT_STACK_PREFS);
    expect(createStackStatsRepository().read()).toEqual(defaultStackStats());
    expect(createStackSessionRepository().read()).toBeNull();
    expect(createStackMetaRepository().read()).toEqual(defaultStackMeta());
  });

  it('round-trips and clears a session', () => {
    const repo = createStackSessionRepository();
    const game = createStackGame('s', 'quad', ['PLANT', 'STORM', 'CRANE', 'MOUND']);

    repo.write(game);
    expect(repo.read()).toEqual(game);

    repo.clear();
    expect(repo.read()).toBeNull();
  });

  it('reports corrupt data through the callback and returns defaults (EC-12)', () => {
    const issues: string[] = [];
    localStorage.setItem(keys.stats, '{ not json');
    localStorage.setItem(keys.session, '"a string"');

    expect(createStackStatsRepository((i) => issues.push(i)).read()).toEqual(defaultStackStats());
    expect(createStackSessionRepository((i) => issues.push(i)).read()).toBeNull();
    expect(issues).toEqual(['corrupt', 'corrupt']);
  });

  it('resetting WordStack statistics leaves Wordwright and WordWeaver stats byte-identical (AC-56)', () => {
    createStatsRepository('wordwright').write(defaultStats());
    createWeaverStatsRepository().write(defaultWeaverStats());
    createWeaverStatsRepository().write(defaultWeaverStats());
    const stack = createStackStatsRepository();
    stack.write(recordStackGame(defaultStackStats(), record('a')));

    const wordwright = localStorage.getItem(gameKeys('wordwright').stats);
    const weaver = localStorage.getItem(gameKeys('weaver').stats);
    expect(wordwright).not.toBeNull();
    expect(weaver).not.toBeNull();

    stack.write(resetStackStatistics(stack.read()));

    expect(localStorage.getItem(gameKeys('wordwright').stats)).toBe(wordwright);
    expect(localStorage.getItem(gameKeys('weaver').stats)).toBe(weaver);
    expect(stack.read().overall.gamesPlayed).toBe(0);
  });

  it('keeps its keys apart from the other games', () => {
    for (const key of [keys.prefs, keys.stats, keys.session, keys.meta]) {
      expect(key.startsWith('wordgames:v1:stack:')).toBe(true);
    }
  });
});
