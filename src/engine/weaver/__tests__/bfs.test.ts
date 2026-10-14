import { describe, expect, it } from 'vitest';

import { distancesFrom, distanceTo, shortestLadder, UNREACHABLE } from '../bfs';
import { buildLadderGraph } from '../graph';
import { differsByOneLetter } from '../validate';
import { graph, PATH_A, PATH_B, PATH_C } from './fixtures';

describe('distancesFrom (FR-76)', () => {
  it('gives the distance in edges to every reachable word', () => {
    const distances = distancesFrom(graph, 'WARM');

    expect(distanceTo(graph, distances, 'WARM')).toBe(0);
    expect(distanceTo(graph, distances, 'WARD')).toBe(1);
    expect(distanceTo(graph, distances, 'CARD')).toBe(2);
    expect(distanceTo(graph, distances, 'CORD')).toBe(3);
    expect(distanceTo(graph, distances, 'COLD')).toBe(4);
    expect(distanceTo(graph, distances, 'BOLD')).toBe(5);
  });

  it('is symmetric', () => {
    const forward = distanceTo(graph, distancesFrom(graph, 'COLD'), 'WARM');
    const back = distanceTo(graph, distancesFrom(graph, 'WARM'), 'COLD');

    expect(forward).toBe(back);
  });

  it('marks words in another group unreachable', () => {
    const distances = distancesFrom(graph, 'COLD');

    expect(distances[graph.index.get('LAKE') as number]).toBe(UNREACHABLE);
    expect(distanceTo(graph, distances, 'LAKE')).toBeNull();
  });

  it('reaches nothing from a word that is not in the graph', () => {
    const distances = distancesFrom(graph, 'NOPE');

    expect([...distances].every((d) => d === UNREACHABLE)).toBe(true);
  });

  it('returns null for a target that is not in the graph', () => {
    expect(distanceTo(graph, distancesFrom(graph, 'COLD'), 'NOPE')).toBeNull();
  });
});

describe('shortestLadder (FR-86)', () => {
  it('returns a ladder from start to end, both included, of par + 1 words', () => {
    const ladder = shortestLadder(graph, 'COLD', 'WARM', ['COLD', 'WARM']);

    expect(ladder).toHaveLength(5);
    expect(ladder?.[0]).toBe('COLD');
    expect(ladder?.at(-1)).toBe('WARM');
  });

  it('changes exactly one letter at every step', () => {
    const ladder = shortestLadder(graph, 'COLD', 'WARM', ['COLD', 'WARM']) ?? [];

    for (let i = 1; i < ladder.length; i += 1) {
      expect(differsByOneLetter(ladder[i - 1] as string, ladder[i] as string)).toBe(true);
    }
  });

  it('uses only words in the graph', () => {
    const ladder = shortestLadder(graph, 'COLD', 'WARM', ['COLD', 'WARM']) ?? [];

    for (const word of ladder) expect(graph.index.has(word)).toBe(true);
  });

  it('is as short as the BFS distance', () => {
    const par = distanceTo(graph, distancesFrom(graph, 'COLD'), 'WARM');

    expect((shortestLadder(graph, 'COLD', 'WARM', []) ?? []).length - 1).toBe(par);
  });

  it('breaks ties alphabetically at every step when no path has more answers', () => {
    // All three shortest paths hold two answers, so the smaller neighbour wins at CORD.
    expect(shortestLadder(graph, 'COLD', 'WARM', ['COLD', 'WARM'])).toEqual([...PATH_A]);
    expect(shortestLadder(graph, 'COLD', 'WARM', [])).toEqual([...PATH_A]);
  });

  it('prefers the path with the most answer-list words', () => {
    const throughWorm = ['COLD', 'WORD', 'WORM', 'WARM'];
    const throughWord = ['COLD', 'WARD', 'WORD', 'WARM'];

    expect(shortestLadder(graph, 'COLD', 'WARM', throughWorm)).toEqual([...PATH_B]);
    expect(shortestLadder(graph, 'COLD', 'WARM', throughWord)).toEqual([...PATH_C]);
  });

  it('still breaks ties alphabetically among paths that share the best count', () => {
    // CARD and WORD are both answers: paths A and C-like paths tie, A is alphabetical.
    expect(shortestLadder(graph, 'COLD', 'WARM', ['CARD', 'WORD'])).toEqual([...PATH_A]);
  });

  it('returns the same ladder every time (determinism)', () => {
    const answers = ['COLD', 'WORD', 'WARM'];
    const first = shortestLadder(graph, 'COLD', 'WARM', answers);

    for (let i = 0; i < 5; i += 1) {
      expect(shortestLadder(graph, 'COLD', 'WARM', answers)).toEqual(first);
    }
  });

  it('gives the same ladder whatever order the answer list is in', () => {
    const forward = shortestLadder(graph, 'COLD', 'WARM', ['WORD', 'WORM']);
    const backward = shortestLadder(graph, 'COLD', 'WARM', ['WORM', 'WORD']);

    expect(forward).toEqual(backward);
  });

  it('gives the same ladder from a graph built in a different word order', () => {
    const reordered = buildLadderGraph([...graph.words].reverse());

    expect(shortestLadder(reordered, 'COLD', 'WARM', [])).toEqual([...PATH_A]);
  });

  it('works in the other direction', () => {
    const ladder = shortestLadder(graph, 'WARM', 'COLD', []);

    expect(ladder?.[0]).toBe('WARM');
    expect(ladder?.at(-1)).toBe('COLD');
    expect(ladder).toHaveLength(5);
  });

  it('returns a one-word ladder when start and end are the same', () => {
    expect(shortestLadder(graph, 'COLD', 'COLD', [])).toEqual(['COLD']);
  });

  it('returns a two-word ladder for neighbours', () => {
    expect(shortestLadder(graph, 'COLD', 'CORD', [])).toEqual(['COLD', 'CORD']);
  });

  it('returns null when the words are in different groups', () => {
    expect(shortestLadder(graph, 'COLD', 'LAKE', [])).toBeNull();
  });

  it('returns null when the start or the end is not in the graph', () => {
    expect(shortestLadder(graph, 'NOPE', 'WARM', [])).toBeNull();
    expect(shortestLadder(graph, 'COLD', 'NOPE', [])).toBeNull();
  });

  it('is not confused by words farther from the end than the start is', () => {
    // BOLD is 5 from WARM but COLD is 4; the walk must not wander into BOLD.
    const ladder = shortestLadder(graph, 'COLD', 'WARM', []) ?? [];

    expect(ladder).not.toContain('BOLD');
  });
});
