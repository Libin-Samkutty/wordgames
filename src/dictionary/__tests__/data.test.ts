import { describe, expect, it } from 'vitest';

import { WORD_LENGTHS } from '@/engine/constants';
import type { WordLength } from '@/engine/types';

import { referenceDistance } from '@/test/referenceBfs';

import { DICTIONARY_REGISTRY } from '../registry';
import type { RawLists } from '../types';
import { listProblems } from './listInvariants';

/**
 * Invariants for the generated word lists (FR-26, FR-27, FR-30).
 *
 * These run against the real data, unlike component tests which use fixtures.
 * A regeneration that produces malformed output fails here.
 */
describe.each(WORD_LENGTHS)('lists-%i', (length: WordLength) => {
  let lists: RawLists;

  beforeAll(async () => {
    lists = await DICTIONARY_REGISTRY[length]();
  });

  describe.each(['answers', 'guesses'] as const)('%s', (listName) => {
    it('contains only uppercase A-Z (FR-27)', () => {
      const invalid = lists[listName].filter((word) => !/^[A-Z]+$/.test(word));

      expect(invalid).toEqual([]);
    });

    it(`contains only ${length}-letter words (FR-27)`, () => {
      const wrongLength = lists[listName].filter((word) => word.length !== length);

      expect(wrongLength).toEqual([]);
    });

    it('has no duplicates (FR-27)', () => {
      const list = lists[listName];

      expect(new Set(list).size).toBe(list.length);
    });

    it('is sorted ascending (FR-27)', () => {
      const list = [...lists[listName]];

      expect(list).toEqual([...list].sort());
    });

    it('is not empty', () => {
      expect(lists[listName].length).toBeGreaterThan(0);
    });
  });

  it('has at least 300 answers (FR-30)', () => {
    expect(lists.answers.length).toBeGreaterThanOrEqual(300);
  });

  it('has at least 1500 guesses (FR-30)', () => {
    expect(lists.guesses.length).toBeGreaterThanOrEqual(1500);
  });

  it('keeps every answer guessable, so the solution is always accepted (FR-26)', () => {
    const guesses = new Set(lists.guesses);
    const orphaned = lists.answers.filter((word) => !guesses.has(word));

    expect(orphaned).toEqual([]);
  });

  it('draws answers from a smaller, curated pool than the guess list (ADR-004)', () => {
    expect(lists.answers.length).toBeLessThan(lists.guesses.length);
  });

  it('excludes plurals whose singular is also a word, which make unfair answers', () => {
    const guesses = new Set(lists.guesses);
    const plurals = lists.answers.filter(
      (word) => word.endsWith('S') && guesses.has(word.slice(0, -1)),
    );

    expect(plurals).toEqual([]);
  });

  it('excludes answers built from one or two distinct letters', () => {
    const monotonous = lists.answers.filter((word) => new Set(word).size <= 2);

    expect(monotonous).toEqual([]);
  });

  it('keeps offensive words out of the answer pool (FR-31)', () => {
    // Spot check: these are in ENABLE1 and so remain guessable, but must never
    // be shown to the player as a solution.
    const banned = ['DAMN', 'CRAP', 'HELL', 'SEXY', 'NAKED', 'MURDER', 'CANCER', 'CORPSE'];
    const answers = new Set(lists.answers);

    expect(banned.filter((word) => answers.has(word))).toEqual([]);
  });

  it('accepts ordinary words as guesses even when they are barred as answers', () => {
    // The permissive guess list is the point of ADR-004: rejecting a real word
    // the player typed is worse than accepting an unpleasant one.
    const guesses = new Set(lists.guesses);
    const sample = length === 4 ? 'DAMN' : length === 5 ? 'NASTY' : 'MURDER';

    expect(guesses.has(sample)).toBe(true);
  });
});

describe.each([4, 5] as const)('ladder list, %i letters (FR-75, T-58)', (length) => {
  let lists: RawLists;

  beforeAll(async () => {
    lists = await DICTIONARY_REGISTRY[length]();
  });

  it('exists', () => {
    expect(lists.ladder).toBeDefined();
  });

  it('holds every list invariant, including answers ⊆ ladder ⊆ guesses', () => {
    expect(listProblems(lists, length)).toEqual([]);
  });

  it('is larger than the answer list and smaller than the guess list', () => {
    expect(lists.ladder?.length).toBeGreaterThan(lists.answers.length);
    expect(lists.ladder?.length).toBeLessThan(lists.guesses.length);
  });

  it('keeps offensive words off ladders, which Give up shows to the player', () => {
    const banned = ['DAMN', 'CRAP', 'SEXY', 'NAKED', 'MURDER', 'CANCER', 'CORPSE', 'PORN'];
    const ladder = new Set(lists.ladder);

    expect(banned.filter((word) => ladder.has(word))).toEqual([]);
  });
});

describe('the 6-letter module has no ladder list (FR-74)', () => {
  it('exports only answers and guesses', async () => {
    const lists = await DICTIONARY_REGISTRY[6]();

    expect(lists.ladder).toBeUndefined();
  });
});

describe('the EAST → WEST example (FR-76)', () => {
  it('has par 3 over the ladder list, where the full guess list allows 2', async () => {
    const lists = await DICTIONARY_REGISTRY[4]();
    const ladder = lists.ladder ?? [];

    // Over the full guess list, `WAST` makes it 2. Over common words it is 3,
    // for example EAST, VAST, VEST, WEST or EAST, PAST, PEST, WEST.
    expect(ladder).not.toContain('WAST');
    expect(referenceDistance(lists.guesses, 'EAST', 'WEST')).toBe(2);
    expect(referenceDistance(ladder, 'EAST', 'WEST')).toBe(3);
  });

  it('matches the COLD → WARM fixture used by AC-30', async () => {
    const lists = await DICTIONARY_REGISTRY[4]();

    expect(referenceDistance(lists.ladder ?? [], 'COLD', 'WARM')).toBe(4);
  });
});

describe('the registry', () => {
  it('covers every supported word length (FR-29)', () => {
    expect(Object.keys(DICTIONARY_REGISTRY).map(Number).sort()).toEqual([...WORD_LENGTHS]);
  });
});
