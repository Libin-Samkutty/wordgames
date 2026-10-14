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
    expect(heatOf(distance)).toBe(heat);
  });

  it('is monotonic: a bigger distance is never hotter', () => {
    const order = ['burning', 'hot', 'warm', 'cold', 'freezing'];
    let previous = 0;

    for (let distance = 1; distance <= 2500; distance += 1) {
      const rank = order.indexOf(heatOf(distance));
      expect(rank).toBeGreaterThanOrEqual(previous);
      previous = rank;
    }
  });

  it('matches the documented band limits', () => {
    expect(HEAT_BANDS.map((band) => band.max)).toEqual([20, 100, 500, 2000]);
  });
});
