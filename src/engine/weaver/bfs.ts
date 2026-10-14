import type { LadderGraph } from './graph';

/** Marks a node with no path from the start. */
export const UNREACHABLE = -1;

/**
 * Breadth-first search from `start`: the distance in edges to every node, or
 * `UNREACHABLE` (FR-76). Par is the distance to the end word.
 *
 * Indexed by node, like `LadderGraph.words`. A `start` that is not in the
 * graph reaches nothing.
 */
export function distancesFrom(graph: LadderGraph, start: string): Int32Array {
  const distances = new Int32Array(graph.words.length).fill(UNREACHABLE);
  const origin = graph.index.get(start);
  if (origin === undefined) return distances;

  distances[origin] = 0;
  const queue = [origin];
  for (let head = 0; head < queue.length; head += 1) {
    const node = queue[head] as number;
    const next = (distances[node] as number) + 1;

    for (const neighbour of graph.neighbours[node] as readonly number[]) {
      if (distances[neighbour] === UNREACHABLE) {
        distances[neighbour] = next;
        queue.push(neighbour);
      }
    }
  }

  return distances;
}

/** The distance to `word` from a `distancesFrom` result, or null when unknown or unreachable. */
export function distanceTo(graph: LadderGraph, distances: Int32Array, word: string): number | null {
  const node = graph.index.get(word);
  if (node === undefined) return null;

  const distance = distances[node] as number;
  return distance === UNREACHABLE ? null : distance;
}

/**
 * One shortest ladder from `start` to `end`, both included, for Give up (FR-86).
 *
 * Among the shortest paths it prefers the one with the most answer-list words,
 * because those are the words a player recognises. Remaining ties go to the
 * alphabetically smaller neighbour at every step, so the same puzzle always
 * shows the same ladder.
 *
 * It works backwards from `end`: every node on a shortest path to `end` has a
 * neighbour one step closer, so each node's best continuation is decided once,
 * layer by layer, in O(nodes + edges).
 *
 * @returns The ladder, or null when either word is unknown or no path exists.
 */
export function shortestLadder(
  graph: LadderGraph,
  start: string,
  end: string,
  answers: readonly string[],
): readonly string[] | null {
  const from = graph.index.get(start);
  const to = graph.index.get(end);
  if (from === undefined || to === undefined) return null;

  const toEnd = distancesFrom(graph, end);
  const total = toEnd[from] as number;
  if (total === UNREACHABLE) return null;

  const answerSet = new Set(answers);
  const isAnswer = (node: number): number => (answerSet.has(graph.words[node] as string) ? 1 : 0);

  // Nodes grouped by their distance to `end`, nearest first.
  const layers: number[][] = Array.from({ length: total + 1 }, () => []);
  toEnd.forEach((distance, node) => {
    if (distance !== UNREACHABLE && distance <= total) (layers[distance] as number[]).push(node);
  });

  const answerCount = new Int32Array(graph.words.length);
  const next = new Int32Array(graph.words.length).fill(UNREACHABLE);
  answerCount[to] = isAnswer(to);

  for (let layer = 1; layer <= total; layer += 1) {
    for (const node of layers[layer] as number[]) {
      let bestCount = -1;
      let bestNeighbour = UNREACHABLE;

      // Neighbours are alphabetical, so a strict comparison keeps the smallest on a tie.
      for (const neighbour of graph.neighbours[node] as readonly number[]) {
        if (toEnd[neighbour] === layer - 1 && (answerCount[neighbour] as number) > bestCount) {
          bestCount = answerCount[neighbour] as number;
          bestNeighbour = neighbour;
        }
      }

      answerCount[node] = bestCount + isAnswer(node);
      next[node] = bestNeighbour;
    }
  }

  const ladder = [start];
  for (let node = from; node !== to;) {
    node = next[node] as number;
    ladder.push(graph.words[node] as string);
  }
  return ladder;
}
