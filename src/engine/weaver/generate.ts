import { err, ok, type Result } from '@/lib/result';

import { pickRandom, type RandomSource } from '../random';
import { distanceTo, distancesFrom } from './bfs';
import { FALLBACK_MIN_PAR, MAX_START_ATTEMPTS, PAR_BAND, RECENT_START_WINDOW } from './constants';
import type { LadderGraph } from './graph';
import type { GenerateError, Puzzle, WeaverLength } from './types';

export interface GenerateOptions {
  readonly length: WeaverLength;
  readonly graph: LadderGraph;
  /** The answer list: where start and end words come from (FR-75). */
  readonly answers: readonly string[];
  /** Most-recent-first starts used for this length (FR-78). */
  readonly recentStarts: readonly string[];
  readonly random: RandomSource;
}

/** Removes and returns a random element. Mutates `items`, which the caller owns. */
function drawOne(items: string[], random: RandomSource): string {
  const word = pickRandom(items, random);
  items.splice(items.indexOf(word), 1);
  return word;
}

/** Up to `count` distinct words drawn at random, without replacement. */
function drawMany(pool: readonly string[], count: number, random: RandomSource): string[] {
  const remaining = [...pool];
  const drawn: string[] = [];
  while (drawn.length < count && remaining.length > 0) drawn.push(drawOne(remaining, random));
  return drawn;
}

/** The answers at a distance accepted by `accepts`, with their distances. */
function endsFrom(
  { graph, answers }: GenerateOptions,
  start: string,
  accepts: (distance: number) => boolean,
): { word: string; distance: number }[] {
  const distances = distancesFrom(graph, start);
  const ends: { word: string; distance: number }[] = [];

  for (const word of answers) {
    const distance = word === start ? null : distanceTo(graph, distances, word);
    if (distance !== null && accepts(distance)) ends.push({ word, distance });
  }
  return ends;
}

/**
 * Generates a puzzle with the injected random source (FR-77, FR-78, ADR-009).
 *
 *  1. Pick starts at random from the answer list, skipping the last
 *     `RECENT_START_WINDOW` of this length. Starts in that window are tried
 *     only once every other start has been, so a small list still produces a
 *     puzzle.
 *  2. One breadth-first search from each start.
 *  3. Collect the answers whose distance is inside `PAR_BAND` and pick the end
 *     from them at random.
 *  4. If none, try another start, up to `MAX_START_ATTEMPTS`.
 *  5. If still none, accept any reachable answer at distance of at least
 *     `FALLBACK_MIN_PAR` from one of those starts.
 *  6. If that also fails, return `no-puzzle` (EC-32).
 *
 * Par is the BFS distance over the ladder graph (FR-76), so it is correct by
 * construction.
 */
export function generatePuzzle(options: GenerateOptions): Result<Puzzle, GenerateError> {
  const { length, answers, recentStarts, random } = options;
  const band = PAR_BAND[length];

  const recent = new Set(recentStarts.slice(0, RECENT_START_WINDOW));
  const fresh = answers.filter((word) => !recent.has(word));
  const stale = answers.filter((word) => recent.has(word));

  const starts = drawMany(fresh, MAX_START_ATTEMPTS, random);
  starts.push(...drawMany(stale, MAX_START_ATTEMPTS - starts.length, random));

  const puzzle = (start: string, end: { word: string; distance: number }): Puzzle => ({
    length,
    start,
    end: end.word,
    par: end.distance,
  });

  for (const start of starts) {
    const ends = endsFrom(options, start, (d) => d >= band.min && d <= band.max);
    if (ends.length > 0) return ok(puzzle(start, pickRandom(ends, random)));
  }

  for (const start of starts) {
    const ends = endsFrom(options, start, (d) => d >= FALLBACK_MIN_PAR);
    if (ends.length > 0) return ok(puzzle(start, pickRandom(ends, random)));
  }

  return err('no-puzzle');
}
