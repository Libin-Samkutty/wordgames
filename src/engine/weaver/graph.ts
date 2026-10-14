/**
 * The ladder graph: one node per ladder-list word, with two words joined when
 * they differ in exactly one position (FR-76, ARCHITECTURE §3.6).
 *
 * Plain data, built by a pure function from a word array the caller passes in,
 * so the engine never touches the dictionary (ADR-003). The caller builds it
 * once per length and keeps it.
 */
export interface LadderGraph {
  /** The words, in the order given. A node is an index into this array. */
  readonly words: readonly string[];
  /** Word to node index. */
  readonly index: ReadonlyMap<string, number>;
  /** For each node, its neighbours' node indices, ordered alphabetically by word. */
  readonly neighbours: readonly (readonly number[])[];
}

/**
 * Builds the graph with wildcard buckets: each word is filed under one pattern
 * per position, so `COLD` goes into `_OLD`, `C_LD`, `CO_D` and `COL_`. Words
 * that share a bucket differ only at the wildcard, so they are neighbours.
 * That is O(words × length), instead of comparing every pair.
 *
 * Words must be unique and the same length; the data tests guarantee both for
 * the generated lists.
 */
export function buildLadderGraph(words: readonly string[]): LadderGraph {
  const index = new Map<string, number>();
  words.forEach((word, node) => {
    index.set(word, node);
  });

  const buckets = new Map<string, number[]>();
  words.forEach((word, node) => {
    for (let position = 0; position < word.length; position += 1) {
      const pattern = `${word.slice(0, position)}_${word.slice(position + 1)}`;
      const bucket = buckets.get(pattern);
      if (bucket) bucket.push(node);
      else buckets.set(pattern, [node]);
    }
  });

  const neighbours: number[][] = words.map(() => []);
  for (const bucket of buckets.values()) {
    for (const a of bucket) {
      for (const b of bucket) {
        if (a !== b) (neighbours[a] as number[]).push(b);
      }
    }
  }

  // Alphabetical, so every walk over the graph is deterministic (FR-86).
  const byWord = (a: number, b: number): number =>
    (words[a] as string) < (words[b] as string) ? -1 : 1;
  for (const list of neighbours) list.sort(byWord);

  return { words, index, neighbours };
}
