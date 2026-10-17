import { describe, expect, it } from 'vitest';

import { HEAT_BANDS } from '../constants';
import { heatOf, listDistance, listIndex } from '../heat';

/** List distance and heat (T-80: FR-120, ADR-030). */

const SORTED = ['ABOUT', 'BRAVE', 'CRANE', 'PLAIN', 'PLANT', 'STORM', 'WORLD'];

describe('listIndex', () => {
  it('finds each word, including the first and the last', () => {
    expect(SORTED.map((word) => listIndex(SORTED, word))).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('returns -1 for a word that is not in the list, wherever it would sort', () => {
    expect(listIndex(SORTED, 'AAAAA')).toBe(-1);
    expect(listIndex(SORTED, 'MANGO')).toBe(-1);
    expect(listIndex(SORTED, 'ZZZZZ')).toBe(-1);
  });

  it('returns -1 for an empty list', () => {
    expect(listIndex([], 'ABOUT')).toBe(-1);
  });
});

describe('listDistance', () => {
  it('is the difference of the two positions, whichever order they come in', () => {
    expect(listDistance(SORTED, 'PLAIN', 'PLANT')).toBe(1);
    expect(listDistance(SORTED, 'PLANT', 'PLAIN')).toBe(1);
    expect(listDistance(SORTED, 'ABOUT', 'WORLD')).toBe(6);
  });

  it('is 0 for the same word', () => {
    expect(listDistance(SORTED, 'CRANE', 'CRANE')).toBe(0);
  });

  it('is null when either word is not in the list', () => {
    expect(listDistance(SORTED, 'AAAAA', 'PLANT')).toBeNull();
    expect(listDistance(SORTED, 'PLANT', 'ZZZZZ')).toBeNull();
  });
});

describe('heatOf bands (FR-120)', () => {
  it.each([
    [1, 'burning'],
    [20, 'burning'],
    [21, 'hot'],
    [100, 'hot'],
    [101, 'warm'],
    [500, 'warm'],
    [501, 'cold'],
    [2000, 'cold'],
    [2001, 'freezing'],
    [13_000, 'freezing'],
  ])('a distance of %i is %s', (distance, heat) => {
    expect(heatOf(distance, 5)).toBe(heat);
  });

  it('is monotonic: a bigger distance is never hotter', () => {
    const order = ['burning', 'hot', 'warm', 'cold', 'freezing'];
    let previous = 0;

    for (let distance = 1; distance <= 2500; distance += 1) {
      const rank = order.indexOf(heatOf(distance, 5));
      expect(rank).toBeGreaterThanOrEqual(previous);
      previous = rank;
    }
  });

  it.each([
    [4, 9, 'burning'],
    [4, 10, 'hot'],
    [4, 894, 'cold'],
    [4, 895, 'freezing'],
    [6, 36, 'burning'],
    [6, 37, 'hot'],
    [6, 3585, 'cold'],
    [6, 3586, 'freezing'],
  ] as const)('at %i letters, a distance of %i is %s', (length, distance, heat) => {
    expect(heatOf(distance, length)).toBe(heat);
  });

  it('matches the documented band limits', () => {
    expect(HEAT_BANDS[4].map((band) => band.max)).toEqual([9, 45, 223, 894]);
    expect(HEAT_BANDS[5].map((band) => band.max)).toEqual([20, 100, 500, 2000]);
    expect(HEAT_BANDS[6].map((band) => band.max)).toEqual([36, 179, 896, 3585]);
  });

  it.each([
    [4, 6142],
    [6, 24_637],
  ] as const)('scales the 5-letter bands by list size for %i letters (ADR-037)', (length, size) => {
    const scaled = HEAT_BANDS[5].map((band) => Math.round((band.max * size) / 13_746));

    expect(HEAT_BANDS[length].map((band) => band.max)).toEqual(scaled);
  });
});
