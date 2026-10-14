import { beforeEach, describe, expect, it } from 'vitest';

import { RECENT_ANSWER_WINDOW, RECENT_GAMES_LIMIT } from '@/engine/constants';
import { codeReducer, createCodeGame, type CodeAction } from '@/engine/code';
import type { CodeRecord, CodeState } from '@/engine/code';

import {
  codeWinPercentage,
  createCodeMetaRepository,
  createCodePrefsRepository,
  createCodeSessionRepository,
  createCodeStatsRepository,
  recordCodeGame,
  rememberCodeAnswer,
  resetCodeHistory,
  resetCodeStatistics,
} from './codeRepositories';
import {
  DEFAULT_CODE_PREFS,
  defaultCodeMeta,
  defaultCodeStats,
  isCodeSessionUsable,
  validateCodeMeta,
  validateCodePrefs,
  validateCodeSession,
  validateCodeStats,
} from './codeSchemas';
import { gameKeys } from './keys';
import { defaultStats } from './schemas';
import { createStatsRepository } from './statsRepository';

/** WordCode storage (T-85: FR-127, FR-134, FR-135, EC-45, AC-52, AC-56). */

const keys = gameKeys('code');

const record = (id: string, over: Partial<CodeRecord> = {}): CodeRecord => ({
  id,
  playedAt: 1_000,
  length: 5,
  secret: 'PLANT',
  guessesUsed: 6,
  won: true,
  ...over,
});

const four = (id: string, over: Partial<CodeRecord> = {}): CodeRecord =>
  record(id, { length: 4, secret: 'LAMB', ...over });

function played(...actions: CodeAction[]): CodeState {
  return actions.reduce(codeReducer, createCodeGame('g', 5, 'PLANT'));
}
const submit = (word: string): CodeAction => ({ type: 'SUBMIT_GUESS', word, now: 5 });
const note = (letter: string): CodeAction => ({ type: 'CYCLE_NOTE', letter });

beforeEach(() => {
  localStorage.clear();
});

describe('recordCodeGame (FR-134)', () => {
  it('records a win overall and for its length, with the distribution bucket', () => {
    const one = recordCodeGame(defaultCodeStats(), record('a', { guessesUsed: 1 }));
    const last = recordCodeGame(defaultCodeStats(), record('b', { guessesUsed: 10 }));

    expect(one.overall).toMatchObject({ gamesPlayed: 1, gamesWon: 1, currentStreak: 1 });
    expect(one.perLength[5]).toMatchObject({ gamesPlayed: 1, gamesWon: 1 });
    expect(one.perLength[4].gamesPlayed).toBe(0);
    expect(one.overall.distribution[0]).toBe(1);
    expect(one.perLength[5].distribution[0]).toBe(1);
    expect(last.overall.distribution[9]).toBe(1);
    expect(one.overall.distribution).toHaveLength(10);
  });

  it('records a loss as played, with the streak reset and best kept, and no bucket', () => {
    let stats = recordCodeGame(defaultCodeStats(), record('a'));
    stats = recordCodeGame(stats, record('b'));
    stats = recordCodeGame(stats, record('c', { won: false, guessesUsed: 10 }));

    expect(stats.overall).toMatchObject({
      gamesPlayed: 3,
      gamesWon: 2,
      currentStreak: 0,
      bestStreak: 2,
    });
    expect(stats.overall.distribution.reduce((a, b) => a + b, 0)).toBe(2);
  });

  it('keeps separate streaks per length while the overall streak spans all of them', () => {
    let stats = recordCodeGame(defaultCodeStats(), record('a'));
    stats = recordCodeGame(stats, four('b'));
    stats = recordCodeGame(stats, four('c', { won: false, guessesUsed: 10 }));

    expect(stats.overall.currentStreak).toBe(0);
    expect(stats.perLength[5].currentStreak).toBe(1);
    expect(stats.perLength[4]).toMatchObject({ gamesPlayed: 2, currentStreak: 0, bestStreak: 1 });
  });

  it('ignores a win outside 1 to 10 rather than corrupting the distribution', () => {
    const stats = recordCodeGame(defaultCodeStats(), record('a', { guessesUsed: 0 }));

    expect(stats.overall.gamesWon).toBe(1);
    expect(stats.overall.distribution.every((n) => n === 0)).toBe(true);
  });

  it('is idempotent by game id, returning the same reference', () => {
    const once = recordCodeGame(defaultCodeStats(), record('a'));

    expect(recordCodeGame(once, record('a'))).toBe(once);
  });

  it('keeps only the last 50 games, newest first', () => {
    let stats = defaultCodeStats();
    for (let i = 0; i < RECENT_GAMES_LIMIT + 5; i += 1) {
      stats = recordCodeGame(stats, record(`g${String(i)}`));
    }

    expect(stats.recentGames).toHaveLength(RECENT_GAMES_LIMIT);
    expect(stats.recentGames[0]?.id).toBe('g54');
    expect(stats.overall.gamesPlayed).toBe(55);
  });

  it('computes the win percentage, 0 with no games', () => {
    let stats = defaultCodeStats();
    expect(codeWinPercentage(stats.overall)).toBe(0);

    stats = recordCodeGame(stats, record('a'));
    stats = recordCodeGame(stats, record('b', { won: false }));
    stats = recordCodeGame(stats, record('c'));
    expect(codeWinPercentage(stats.overall)).toBe(67);
  });
});

describe('resets (FR-47)', () => {
  const stats = recordCodeGame(recordCodeGame(defaultCodeStats(), record('a')), four('b'));

  it('Reset statistics clears the metrics and keeps the recent games', () => {
    const reset = resetCodeStatistics(stats);

    expect(reset.overall.gamesPlayed).toBe(0);
    expect(reset.perLength[4].gamesPlayed).toBe(0);
    expect(reset.recentGames).toHaveLength(2);
  });

  it('Reset history clears the recent games and keeps the metrics', () => {
    const reset = resetCodeHistory(stats);

    expect(reset.recentGames).toEqual([]);
    expect(reset.recordedGameIds).toEqual([]);
    expect(reset.overall.gamesPlayed).toBe(2);
  });
});

describe('the answer buffer, per length (FR-127)', () => {
  it('puts the secret at the front of its own length and de-duplicates', () => {
    const meta = rememberCodeAnswer(
      { recentAnswers: { 4: ['LAMB'], 5: ['STORM', 'PLANT'], 6: [] } },
      5,
      'PLANT',
    );

    expect(meta.recentAnswers[5]).toEqual(['PLANT', 'STORM']);
    expect(meta.recentAnswers[4]).toEqual(['LAMB']);
  });

  it('is capped at the window', () => {
    let meta = defaultCodeMeta();
    for (let i = 0; i < RECENT_ANSWER_WINDOW + 10; i += 1) {
      meta = rememberCodeAnswer(meta, 4, `W${String(i).padStart(3, '0')}`);
    }

    expect(meta.recentAnswers[4]).toHaveLength(RECENT_ANSWER_WINDOW);
    expect(meta.recentAnswers[5]).toEqual([]);
  });
});

describe('validators reject hostile input (EC-12)', () => {
  it('prefs: accepts 4, 5 and 6 only, defaulting to 5 (FR-127)', () => {
    expect(DEFAULT_CODE_PREFS).toEqual({ defaultWordLength: 5 });
    for (const length of [4, 5, 6]) {
      expect(validateCodePrefs({ defaultWordLength: length })).toEqual({
        defaultWordLength: length,
      });
    }
    for (const bad of [null, 'x', [], {}, { defaultWordLength: 7 }, { defaultWordLength: '5' }]) {
      expect(validateCodePrefs(bad)).toBeNull();
    }
  });

  it('stats: accepts the default shape', () => {
    expect(validateCodeStats(defaultCodeStats())).toEqual(defaultCodeStats());
  });

  const bucket = () => defaultCodeStats().overall;

  it.each([
    ['a non-object', () => null],
    ['a bad overall bucket', () => ({ ...defaultCodeStats(), overall: 'x' })],
    [
      'a negative count',
      () => ({ ...defaultCodeStats(), overall: { ...bucket(), gamesPlayed: -1 } }),
    ],
    [
      'more wins than games',
      () => ({ ...defaultCodeStats(), overall: { ...bucket(), gamesWon: 2, gamesPlayed: 1 } }),
    ],
    [
      'a short distribution',
      () => ({ ...defaultCodeStats(), overall: { ...bucket(), distribution: [0, 0] } }),
    ],
    [
      'a bad distribution entry',
      () => ({
        ...defaultCodeStats(),
        overall: { ...bucket(), distribution: new Array(10).fill('x') },
      }),
    ],
    ['no perLength', () => ({ ...defaultCodeStats(), perLength: 'x' })],
    [
      'a missing length bucket',
      () => ({ ...defaultCodeStats(), perLength: { 4: bucket(), 5: bucket() } }),
    ],
    ['no recent games array', () => ({ ...defaultCodeStats(), recentGames: 'x' })],
  ])('stats: rejects %s', (_name, make) => {
    expect(validateCodeStats(make())).toBeNull();
  });

  it('stats: keeps good history rows beside bad ones, tolerates missing ids and caps at 50', () => {
    const many = Array.from({ length: 60 }, (_, i) => record(`g${String(i)}`));
    const parsed = validateCodeStats({
      ...defaultCodeStats(),
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
    ['an unknown length', { length: 7 }],
    ['a secret of the wrong length', { length: 4, secret: 'PLANT' }],
    ['guesses above 10', { guessesUsed: 11 }],
    ['a negative count', { guessesUsed: -1 }],
    ['a non-boolean win', { won: 1 }],
  ])('stats: drops a history row with %s', (_name, over) => {
    const parsed = validateCodeStats({
      ...defaultCodeStats(),
      recentGames: [{ ...record('x'), ...over }],
    });

    expect(parsed?.recentGames).toEqual([]);
  });

  it('meta: accepts the default, fills a missing length and rejects the rest', () => {
    expect(validateCodeMeta(defaultCodeMeta())).toEqual(defaultCodeMeta());
    expect(validateCodeMeta({ recentAnswers: { 5: ['PLANT'] } })).toEqual({
      recentAnswers: { 4: [], 5: ['PLANT'], 6: [] },
    });
    expect(validateCodeMeta({ recentAnswers: { 4: 'x', 5: [1], 6: [] } })).toEqual(
      defaultCodeMeta(),
    );
    expect(validateCodeMeta({ recentAnswers: 'x' })).toBeNull();
    expect(validateCodeMeta(null)).toBeNull();
  });
});

describe('session shape (FR-135, EC-45, AC-52)', () => {
  it('round-trips a game in progress with typed letters and notes exactly (EC-45)', () => {
    const state = played(
      note('P'),
      note('Q'),
      note('Q'),
      submit('PANEL'),
      submit('SLATE'),
      { type: 'ADD_LETTER', letter: 'P', now: 6 },
      note('Z'),
    );

    const restored = validateCodeSession(JSON.parse(JSON.stringify(state)));

    expect(restored).toEqual(state);
    expect(restored?.notes).toEqual({ P: 'out', Q: 'in', Z: 'out' });
  });

  it('round-trips a won game and every length', () => {
    const won = played(submit('PANEL'), submit('PLANT'));

    expect(validateCodeSession(JSON.parse(JSON.stringify(won)))).toEqual(won);
    for (const length of [4, 6] as const) {
      const game = createCodeGame('g', length, 'A'.repeat(length));
      expect(validateCodeSession(JSON.parse(JSON.stringify(game)))).toEqual(game);
    }
  });

  const good = (): Record<string, unknown> =>
    JSON.parse(JSON.stringify(played(note('P'), submit('PANEL'), submit('SLATE')))) as Record<
      string,
      unknown
    >;
  const guess = (over: Record<string, unknown>) => ({ word: 'PANEL', bulls: 1, cows: 3, ...over });

  it.each([
    ['a non-object', () => 'x'],
    ['no id', () => ({ ...good(), id: '' })],
    ['an unknown length', () => ({ ...good(), wordLength: 7 })],
    ['a secret of the wrong length', () => ({ ...good(), secret: 'PLAN' })],
    ['a lowercase secret', () => ({ ...good(), secret: 'plant' })],
    ['too much input', () => ({ ...good(), currentInput: 'PLANTS' })],
    ['lowercase input', () => ({ ...good(), currentInput: 'pl' })],
    ['a non-string input', () => ({ ...good(), currentInput: 4 })],
    ['an unknown status', () => ({ ...good(), status: 'revealing' })],
    ['a bad start time', () => ({ ...good(), startedAt: 'x' })],
    ['a bad finish time', () => ({ ...good(), finishedAt: 'x' })],
    ['notes that are not an object', () => ({ ...good(), notes: 'x' })],
    ['notes with a bad letter', () => ({ ...good(), notes: { pp: 'out' } })],
    ['notes with a lowercase letter', () => ({ ...good(), notes: { p: 'out' } })],
    ['notes with an unknown mark', () => ({ ...good(), notes: { P: 'maybe' } })],
    ['missing notes', () => ({ ...good(), notes: undefined })],
    ['guesses that are not an array', () => ({ ...good(), guesses: 'x' })],
    ['more than 10 guesses', () => ({ ...good(), guesses: new Array(11).fill(guess({})) })],
    ['a bad guess', () => ({ ...good(), guesses: ['x'] })],
    ['a word of the wrong length', () => ({ ...good(), guesses: [guess({ word: 'PAN' })] })],
    ['a negative count', () => ({ ...good(), guesses: [guess({ bulls: -1 })] })],
    ['counts above the length', () => ({ ...good(), guesses: [guess({ bulls: 3, cows: 3 })] })],
    [
      'the secret with fewer bulls than letters',
      () => ({ ...good(), guesses: [guess({ word: 'PLANT' })] }),
    ],
    [
      'all bulls on a word that is not the secret',
      () => ({ ...good(), guesses: [guess({ bulls: 5, cows: 0 })] }),
    ],
  ])('rejects %s', (_name, make) => {
    expect(validateCodeSession(make())).toBeNull();
  });
});

describe('isCodeSessionUsable (FR-135)', () => {
  const session = played(submit('PANEL'));

  it('accepts a game whose secret is still in the list', () => {
    expect(isCodeSessionUsable(session, (word) => word === 'PLANT')).toBe(true);
  });

  it('discards nothing-saved, and a secret that has left the list', () => {
    expect(isCodeSessionUsable(null, () => true)).toBe(false);
    expect(isCodeSessionUsable(session, () => false)).toBe(false);
  });
});

describe('repositories (FR-99, AC-56)', () => {
  it('prefs, stats, session and meta each use their own key under wordgames:v1:code:', () => {
    createCodePrefsRepository().write(DEFAULT_CODE_PREFS);
    createCodeStatsRepository().write(defaultCodeStats());
    createCodeSessionRepository().write(createCodeGame('g', 5, 'PLANT'));
    createCodeMetaRepository().write(defaultCodeMeta());

    for (const key of [keys.prefs, keys.stats, keys.session, keys.meta]) {
      expect(localStorage.getItem(key)).not.toBeNull();
      expect(key.startsWith('wordgames:v1:code:')).toBe(true);
    }
  });

  it('falls back to defaults when nothing is stored', () => {
    expect(createCodePrefsRepository().read()).toEqual(DEFAULT_CODE_PREFS);
    expect(createCodeStatsRepository().read()).toEqual(defaultCodeStats());
    expect(createCodeSessionRepository().read()).toBeNull();
    expect(createCodeMetaRepository().read()).toEqual(defaultCodeMeta());
  });

  it('round-trips and clears a session with its notes', () => {
    const repo = createCodeSessionRepository();
    const state = played(note('P'), submit('PANEL'));

    repo.write(state);
    expect(repo.read()).toEqual(state);

    repo.clear();
    expect(repo.read()).toBeNull();
  });

  it('reports corrupt data through the callback and returns defaults (EC-12)', () => {
    const issues: string[] = [];
    localStorage.setItem(keys.stats, '{not json');

    const stats = createCodeStatsRepository((_issue, key) => issues.push(key)).read();

    expect(stats).toEqual(defaultCodeStats());
    expect(issues).toEqual([keys.stats]);
  });

  it('resetting WordCode statistics leaves Wordwright stats byte-identical (AC-56)', () => {
    createStatsRepository('wordwright').write(defaultStats());
    const before = localStorage.getItem(gameKeys('wordwright').stats);

    const code = createCodeStatsRepository();
    code.write(recordCodeGame(defaultCodeStats(), record('a')));
    code.write(resetCodeStatistics(code.read()));

    expect(localStorage.getItem(gameKeys('wordwright').stats)).toBe(before);
    expect(code.read().overall.gamesPlayed).toBe(0);
  });
});
