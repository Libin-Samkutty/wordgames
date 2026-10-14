import { describe, expect, it } from 'vitest';

import { DICTIONARY_REGISTRY } from '@/dictionary/registry';
import { referenceDistanceOverSet } from '@/test/referenceBfs';

import { seededRandom } from '../../random';
import { distancesFrom, distanceTo, shortestLadder } from '../bfs';
import { PAR_BAND, WEAVER_LENGTHS } from '../constants';
import { generatePuzzle } from '../generate';
import { buildLadderGraph } from '../graph';
import { differsByOneLetter } from '../validate';

/**
 * AC-36 and FR-77 against the real lists (T-60). The one place the engine
 * tests use the shipped data, by design: it is the only way to know the band
 * and the ladder-list sizes actually produce puzzles.
 *
 * Par is checked against `referenceDistanceOverSet`, written independently of
 * the engine's graph, so a bug in the engine's BFS cannot agree with itself.
 */

const PUZZLES_PER_LENGTH = 200;

describe.each(WEAVER_LENGTHS)('real %i-letter lists (AC-36)', (length) => {
  it(`generates ${String(PUZZLES_PER_LENGTH)} valid puzzles`, async () => {
    const lists = await DICTIONARY_REGISTRY[length]();
    const ladder = lists.ladder ?? [];
    const graph = buildLadderGraph(ladder);
    const answers = new Set(lists.answers);
    const ladderSet = new Set(ladder);
    const band = PAR_BAND[length];
    const random = seededRandom(20_261_014 + length);

    const recentStarts: string[] = [];
    const puzzles = [];

    for (let i = 0; i < PUZZLES_PER_LENGTH; i += 1) {
      const result = generatePuzzle({
        length,
        graph,
        answers: lists.answers,
        recentStarts,
        random,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      puzzles.push(result.value);
      // The provider keeps this buffer, most recent first (FR-78).
      recentStarts.unshift(result.value.start);
    }

    for (const puzzle of puzzles) {
      expect(puzzle.length).toBe(length);
      expect(puzzle.start).not.toBe(puzzle.end);
      expect(answers.has(puzzle.start)).toBe(true);
      expect(answers.has(puzzle.end)).toBe(true);
      expect(puzzle.par).toBeGreaterThanOrEqual(band.min);
      expect(puzzle.par).toBeLessThanOrEqual(band.max);
      expect(puzzle.par).toBe(referenceDistanceOverSet(ladderSet, puzzle.start, puzzle.end));
    }
  });

  it('never repeats a start inside the recent window while others are available', async () => {
    const lists = await DICTIONARY_REGISTRY[length]();
    const graph = buildLadderGraph(lists.ladder ?? []);
    const random = seededRandom(7 + length);
    const recentStarts: string[] = [];

    for (let i = 0; i < 60; i += 1) {
      const result = generatePuzzle({
        length,
        graph,
        answers: lists.answers,
        recentStarts,
        random,
      });
      if (!result.ok) throw new Error('generation failed');

      expect(recentStarts.slice(0, 20)).not.toContain(result.value.start);
      recentStarts.unshift(result.value.start);
    }
  });

  it('shows a Give up ladder of par steps over ladder words, each one letter apart (AC-35)', async () => {
    const lists = await DICTIONARY_REGISTRY[length]();
    const ladder = lists.ladder ?? [];
    const graph = buildLadderGraph(ladder);
    const ladderSet = new Set(ladder);
    const random = seededRandom(99 + length);

    for (let i = 0; i < 25; i += 1) {
      const result = generatePuzzle({
        length,
        graph,
        answers: lists.answers,
        recentStarts: [],
        random,
      });
      if (!result.ok) throw new Error('generation failed');
      const { start, end, par } = result.value;

      const steps = shortestLadder(graph, start, end, lists.answers) ?? [];

      expect(steps).toHaveLength(par + 1);
      expect(steps[0]).toBe(start);
      expect(steps.at(-1)).toBe(end);
      for (const word of steps) expect(ladderSet.has(word)).toBe(true);
      for (let step = 1; step < steps.length; step += 1) {
        expect(differsByOneLetter(steps[step - 1] as string, steps[step] as string)).toBe(true);
      }
      expect(distanceTo(graph, distancesFrom(graph, start), end)).toBe(par);
    }
  });

  it('builds the graph and a first puzzle quickly on this machine (NFR-13 reference)', async () => {
    const lists = await DICTIONARY_REGISTRY[length]();

    const begin = performance.now();
    const graph = buildLadderGraph(lists.ladder ?? []);
    const result = generatePuzzle({
      length,
      graph,
      answers: lists.answers,
      recentStarts: [],
      random: seededRandom(1),
    });
    const elapsed = performance.now() - begin;

    expect(result.ok).toBe(true);
    // Desktop Node is far faster than the 400 ms mobile-throttled budget; this
    // only catches an accidental order-of-magnitude regression.
    expect(elapsed).toBeLessThan(400);
  });
});
