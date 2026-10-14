import { describe, expect, it } from 'vitest';

import { buildLadderGraph } from '../graph';
import { graph } from './fixtures';

/** Neighbour words of `word`, in the order the graph stores them. */
function neighboursOf(word: string): string[] {
  const node = graph.index.get(word) as number;
  return (graph.neighbours[node] as readonly number[]).map((n) => graph.words[n] as string);
}

describe('buildLadderGraph (FR-76)', () => {
  it('keeps the words in the order given and indexes them', () => {
    expect(graph.words[0]).toBe('BOLD');
    expect(graph.index.get('WARM')).toBe(graph.words.indexOf('WARM'));
    expect(graph.index.get('NOPE')).toBeUndefined();
  });

  it('joins words that differ in exactly one position', () => {
    expect(neighboursOf('COLD')).toEqual(['BOLD', 'CORD']);
    expect(neighboursOf('CARD')).toEqual(['CORD', 'WARD']);
    expect(neighboursOf('LAKE')).toEqual(['LAKS']);
  });

  it('does not join words that differ in two or more positions', () => {
    expect(neighboursOf('COLD')).not.toContain('WARM');
    expect(neighboursOf('CARD')).not.toContain('WORD');
  });

  it('never lists a word as its own neighbour', () => {
    for (const [node, list] of graph.neighbours.entries()) {
      expect(list).not.toContain(node);
    }
  });

  it('is symmetric: a is a neighbour of b exactly when b is a neighbour of a', () => {
    for (const [node, list] of graph.neighbours.entries()) {
      for (const other of list) expect(graph.neighbours[other]).toContain(node);
    }
  });

  it('lists each neighbour once', () => {
    for (const list of graph.neighbours) expect(new Set(list).size).toBe(list.length);
  });

  it('orders neighbours alphabetically, whatever order the words arrive in (FR-86)', () => {
    const shuffled = buildLadderGraph(['WORD', 'CORD', 'WARD', 'CARD', 'COLD']);
    const node = shuffled.index.get('CORD') as number;

    const words = (shuffled.neighbours[node] as readonly number[]).map(
      (n) => shuffled.words[n] as string,
    );

    expect(words).toEqual(['CARD', 'COLD', 'WORD']);
  });

  it('leaves a word with no neighbours isolated', () => {
    const isolated = buildLadderGraph(['COLD', 'ZZZZ']);

    expect(isolated.neighbours[isolated.index.get('ZZZZ') as number]).toEqual([]);
  });

  it('builds an empty graph from no words', () => {
    const empty = buildLadderGraph([]);

    expect(empty.words).toEqual([]);
    expect(empty.neighbours).toEqual([]);
  });

  it('works for 5-letter words, where a neighbour changes any of five positions', () => {
    const five = buildLadderGraph(['CRANE', 'CRATE', 'GRATE', 'SLOTH']);
    const crate = five.index.get('CRATE') as number;

    expect((five.neighbours[crate] as readonly number[]).map((n) => five.words[n])).toEqual([
      'CRANE',
      'GRATE',
    ]);
  });
});
