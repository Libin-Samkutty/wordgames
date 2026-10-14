import { describe, expect, it } from 'vitest';

import { seededRandom, type RandomSource } from '../../random';
import { distancesFrom, distanceTo } from '../bfs';
import { MAX_START_ATTEMPTS, PAR_BAND, RECENT_START_WINDOW } from '../constants';
import { generatePuzzle } from '../generate';
import { buildLadderGraph } from '../graph';
import { graph } from './fixtures';

/**
 * Puzzle generation (T-60: FR-74, FR-77, FR-78, EC-32). Hand-built graphs
 * reach every branch of the fallback chain. The real-list test for AC-36 is in
 * `generate.real.test.ts`.
 */

/** Always picks the first remaining element, so a test controls the draw order. */
const first: RandomSource = { next: () => 0 };

/** 20 words with no neighbours at all: 'AAAA', 'BBBB', … 'TTTT'. */
const ISOLATED = Array.from({ length: 20 }, (_unused, i) => String.fromCharCode(65 + i).repeat(4));

describe('generatePuzzle', () => {
  it('returns a start and end from the answer list with par equal to their distance (FR-77)', () => {
    const result = generatePuzzle({
      length: 4,
      graph,
      answers: ['COLD', 'WARM'],
      recentStarts: [],
      random: seededRandom(1),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { start, end, par } = result.value;
    expect(new Set([start, end])).toEqual(new Set(['COLD', 'WARM']));
    expect(par).toBe(4);
    expect(distanceTo(graph, distancesFrom(graph, start), end)).toBe(par);
    expect(result.value.length).toBe(4);
  });

  it('never makes the start and the end the same word', () => {
    for (let seed = 0; seed < 30; seed += 1) {
      const result = generatePuzzle({
        length: 4,
        graph,
        answers: ['COLD', 'CORD', 'CARD', 'WARD', 'WARM', 'WORD', 'WORM', 'BOLD'],
        recentStarts: [],
        random: seededRandom(seed),
      });

      expect(result.ok && result.value.start !== result.value.end).toBe(true);
    }
  });

  it('keeps par inside the band for the length (FR-77)', () => {
    for (let seed = 0; seed < 30; seed += 1) {
      const result = generatePuzzle({
        length: 4,
        graph,
        answers: ['COLD', 'CORD', 'CARD', 'WARD', 'WARM', 'WORD', 'WORM', 'BOLD'],
        recentStarts: [],
        random: seededRandom(seed),
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.par).toBeGreaterThanOrEqual(PAR_BAND[4].min);
        expect(result.value.par).toBeLessThanOrEqual(PAR_BAND[4].max);
      }
    }
  });

  it('is deterministic for a given seed (ADR-009)', () => {
    const options = {
      length: 4 as const,
      graph,
      answers: ['COLD', 'CORD', 'CARD', 'WARD', 'WARM', 'WORD', 'WORM', 'BOLD'],
      recentStarts: [],
    };

    const a = generatePuzzle({ ...options, random: seededRandom(42) });
    const b = generatePuzzle({ ...options, random: seededRandom(42) });

    expect(a).toEqual(b);
  });

  it('never picks a start from the recent window while another start qualifies (FR-78)', () => {
    for (let seed = 0; seed < 40; seed += 1) {
      const result = generatePuzzle({
        length: 4,
        graph,
        answers: ['COLD', 'WARM'],
        recentStarts: ['COLD'],
        random: seededRandom(seed),
      });

      expect(result.ok && result.value.start).toBe('WARM');
    }
  });

  it('uses a recent start when every start is recent, rather than failing', () => {
    const result = generatePuzzle({
      length: 4,
      graph,
      answers: ['COLD', 'WARM'],
      recentStarts: ['COLD', 'WARM'],
      random: seededRandom(3),
    });

    expect(result.ok).toBe(true);
  });

  it('only counts the last 20 starts as recent (FR-78)', () => {
    const inWindow = ['COLD', ...ISOLATED.slice(0, RECENT_START_WINDOW - 1)];
    const outsideWindow = [...ISOLATED, 'COLD'];
    expect(inWindow).toHaveLength(RECENT_START_WINDOW);
    expect(outsideWindow).toHaveLength(RECENT_START_WINDOW + 1);

    const startsWith = (recentStarts: string[]): Set<string> => {
      const starts = new Set<string>();
      for (let seed = 0; seed < 40; seed += 1) {
        const result = generatePuzzle({
          length: 4,
          graph,
          answers: ['COLD', 'WARM'],
          recentStarts,
          random: seededRandom(seed),
        });
        if (result.ok) starts.add(result.value.start);
      }
      return starts;
    };

    // COLD is the most recent start: always skipped. As the 21st it is fresh again.
    expect(startsWith(inWindow)).toEqual(new Set(['WARM']));
    expect(startsWith(outsideWindow)).toEqual(new Set(['COLD', 'WARM']));
  });

  it('tries another start when the first has no in-band end (FR-78 step 4)', () => {
    // CARD and CORD have no answer 4 to 6 rungs away (WARM is 2 and 3), so a
    // draw that starts there must move on to COLD or WARM.
    const answers = ['CARD', 'CORD', 'COLD', 'WARM'];
    const seen = new Set<string>();

    for (let seed = 0; seed < 60; seed += 1) {
      const result = generatePuzzle({
        length: 4,
        graph,
        answers,
        recentStarts: [],
        random: seededRandom(seed),
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        seen.add(`${result.value.start}>${result.value.end}`);
        expect(result.value.par).toBe(4);
      }
    }

    // Only COLD ↔ WARM is in band, whichever start is drawn first.
    expect(seen).toEqual(new Set(['COLD>WARM', 'WARM>COLD']));
  });

  it('falls back to any reachable answer at distance 3 or more when none is in band (FR-78 step 5)', () => {
    // COLD → WARD is 3: outside 4–6 but reachable.
    const result = generatePuzzle({
      length: 4,
      graph,
      answers: ['COLD', 'WARD'],
      recentStarts: [],
      random: seededRandom(5),
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.par).toBe(3);
  });

  it('does not accept a fallback end closer than 3', () => {
    const result = generatePuzzle({
      length: 4,
      graph,
      answers: ['COLD', 'CARD'], // par 2
      recentStarts: [],
      random: seededRandom(5),
    });

    expect(result).toEqual({ ok: false, error: 'no-puzzle' });
  });

  it('returns no-puzzle when no answer is reachable from any start (EC-32)', () => {
    const result = generatePuzzle({
      length: 4,
      graph,
      answers: ['COLD', 'LAKE'],
      recentStarts: [],
      random: seededRandom(5),
    });

    expect(result).toEqual({ ok: false, error: 'no-puzzle' });
  });

  it('returns no-puzzle for an empty answer list', () => {
    const result = generatePuzzle({
      length: 4,
      graph,
      answers: [],
      recentStarts: [],
      random: seededRandom(5),
    });

    expect(result).toEqual({ ok: false, error: 'no-puzzle' });
  });

  it('ignores answers that are not in the graph', () => {
    const result = generatePuzzle({
      length: 4,
      graph,
      answers: ['COLD', 'WARM', 'ZZZZ'],
      recentStarts: [],
      random: seededRandom(9),
    });

    expect(result.ok && result.value.par).toBe(4);
  });

  it('tries at most 20 starts (FR-78)', () => {
    // `first` draws answers in order. Twenty isolated words come first, so the
    // 20 attempts are all spent before COLD, which could have been solved.
    const big = buildLadderGraph([...graph.words, ...ISOLATED]);

    const tooLate = generatePuzzle({
      length: 4,
      graph: big,
      answers: [...ISOLATED, 'COLD', 'WARM'],
      recentStarts: [],
      random: first,
    });
    const justInTime = generatePuzzle({
      length: 4,
      graph: big,
      answers: [...ISOLATED.slice(0, MAX_START_ATTEMPTS - 1), 'COLD', 'WARM'],
      recentStarts: [],
      random: first,
    });

    expect(tooLate).toEqual({ ok: false, error: 'no-puzzle' });
    expect(justInTime.ok && justInTime.value.start).toBe('COLD');
  });

  it('picks the end at random from the in-band answers', () => {
    const wide = buildLadderGraph(['COLD', 'CORD', 'CARD', 'WARD', 'WARM', 'WORD', 'WORM', 'BOLD']);
    const ends = new Set<string>();

    for (let seed = 0; seed < 80; seed += 1) {
      const result = generatePuzzle({
        length: 4,
        graph: wide,
        answers: ['BOLD', 'WARM', 'WORM', 'COLD'],
        recentStarts: [],
        random: seededRandom(seed),
      });
      if (result.ok && result.value.start === 'BOLD') ends.add(result.value.end);
    }

    // BOLD → WARM is 5 and BOLD → WORM is 4, both in band. COLD is 1 away.
    expect(ends).toEqual(new Set(['WARM', 'WORM']));
  });

  it('uses the 5-letter band for 5-letter puzzles', () => {
    expect(PAR_BAND[5]).toEqual({ min: 4, max: 7 });
    expect(PAR_BAND[4]).toEqual({ min: 4, max: 6 });
  });
});
