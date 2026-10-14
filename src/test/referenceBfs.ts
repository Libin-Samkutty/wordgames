/**
 * An independent reference for ladder distances (AC-36, T-58).
 *
 * Deliberately written differently from the engine's graph, so that agreement
 * means something. The engine files each word under wildcard buckets; this
 * generates every one-letter variant of a word and checks each against a Set.
 * The engine builds the graph once and searches many times; this searches
 * straight over the word set. If the two disagree, one of them is wrong.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Shortest distance in edges from `start` to `end` over `words`, or null if unreachable. */
export function referenceDistance(
  words: readonly string[],
  start: string,
  end: string,
): number | null {
  const wordSet = words instanceof Set ? (words as ReadonlySet<string>) : new Set(words);
  return referenceDistanceOverSet(wordSet, start, end);
}

/** As `referenceDistance`, for callers that already hold the word set. */
export function referenceDistanceOverSet(
  words: ReadonlySet<string>,
  start: string,
  end: string,
): number | null {
  if (!words.has(start) || !words.has(end)) return null;
  if (start === end) return 0;

  const distance = new Map<string, number>([[start, 0]]);
  const queue = [start];

  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head] as string;
    const next = (distance.get(current) ?? 0) + 1;

    for (let position = 0; position < current.length; position += 1) {
      for (const letter of ALPHABET) {
        if (letter === current[position]) continue;

        const candidate = current.slice(0, position) + letter + current.slice(position + 1);
        if (!words.has(candidate) || distance.has(candidate)) continue;
        if (candidate === end) return next;

        distance.set(candidate, next);
        queue.push(candidate);
      }
    }
  }

  return null;
}
