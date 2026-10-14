#!/usr/bin/env node
/**
 * WordWeaver par measurement (T-58, FR-75, FR-77).
 *
 *   node scripts/measure-par.mjs                 # sweep ladder sizes, 4 and 5 letters
 *   node scripts/measure-par.mjs --sizes 3000    # one size
 *   node scripts/measure-par.mjs --band 4-6,4-8  # bands for 4 and 5 letters
 *
 * For each length and ladder-list size it builds the ladder graph (two words
 * are joined when they differ in exactly one position), runs one breadth-first
 * search from every answer-list word, and reports:
 *   - the par distribution over every (start, end) answer pair;
 *   - the share of answer starts that have at least one in-band end, which is
 *     the number FR-77 fixes the ladder-list size by (>= 90%).
 *
 * A DEVELOPMENT tool, like the generator it imports from. It reads the same
 * on-disk source cache, so it makes no network request once those are cached.
 * Re-run it whenever the lists are regenerated.
 */

import { gzipSync } from 'node:zlib';

import { buildLadder, buildLists, ladderPool, loadSources } from './build-dictionaries.mjs';

const LENGTHS = [4, 5];
const DEFAULT_SIZES = [1500, 2000, 2500, 3000, 3500, 4000, 5000, 6000, 8000];
const DEFAULT_BAND = { 4: [4, 6], 5: [4, 7] };
const TARGET_COVERAGE = 0.9;

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const sizes = argValue('--sizes')?.split(',').map(Number) ?? DEFAULT_SIZES;
const bandArg = argValue('--band')?.split(',');
const bands = bandArg
  ? { 4: bandArg[0].split('-').map(Number), 5: (bandArg[1] ?? bandArg[0]).split('-').map(Number) }
  : DEFAULT_BAND;

/** Adjacency lists over `words`, using wildcard buckets (`C_LD`) to find neighbours. */
function buildGraph(words) {
  const index = new Map(words.map((word, i) => [word, i]));
  const buckets = new Map();

  for (const [i, word] of words.entries()) {
    for (let position = 0; position < word.length; position += 1) {
      const key = `${word.slice(0, position)}_${word.slice(position + 1)}`;
      const bucket = buckets.get(key);
      if (bucket) bucket.push(i);
      else buckets.set(key, [i]);
    }
  }

  const adjacency = words.map(() => []);
  for (const bucket of buckets.values()) {
    for (const a of bucket) {
      for (const b of bucket) if (a !== b) adjacency[a].push(b);
    }
  }
  return { index, adjacency };
}

/** Distance from `start` to every node, or -1 when unreachable. */
function distancesFrom(adjacency, start) {
  const distance = new Int32Array(adjacency.length).fill(-1);
  distance[start] = 0;
  const queue = [start];
  for (let head = 0; head < queue.length; head += 1) {
    const node = queue[head];
    for (const next of adjacency[node]) {
      if (distance[next] === -1) {
        distance[next] = distance[node] + 1;
        queue.push(next);
      }
    }
  }
  return distance;
}

function measure(ladder, answers, [min, max]) {
  const { index, adjacency } = buildGraph(ladder);
  const histogram = new Map();
  let unreachable = 0;
  let pairs = 0;
  let startsWithInBandEnd = 0;

  for (const start of answers) {
    const distance = distancesFrom(adjacency, index.get(start));
    let hasInBand = false;

    for (const end of answers) {
      if (end === start) continue;
      pairs += 1;
      const d = distance[index.get(end)];
      if (d === -1) {
        unreachable += 1;
        continue;
      }
      histogram.set(d, (histogram.get(d) ?? 0) + 1);
      if (d >= min && d <= max) hasInBand = true;
    }
    if (hasInBand) startsWithInBandEnd += 1;
  }

  const share = (count) => count / pairs;
  const inBandPairs = [...histogram]
    .filter(([d]) => d >= min && d <= max)
    .reduce((n, [, c]) => n + c, 0);
  const atLeast8 = [...histogram].filter(([d]) => d >= 8).reduce((n, [, c]) => n + c, 0);
  const upTo3 = [...histogram].filter(([d]) => d <= 3).reduce((n, [, c]) => n + c, 0);

  return {
    coverage: startsWithInBandEnd / answers.length,
    row: {
      'par<=3': share(upTo3),
      par4: share(histogram.get(4) ?? 0),
      par5: share(histogram.get(5) ?? 0),
      par6: share(histogram.get(6) ?? 0),
      par7: share(histogram.get(7) ?? 0),
      'par8+': share(atLeast8),
      unreachable: share(unreachable),
      inBand: share(inBandPairs),
    },
    parOf: (a, b) => {
      const i = index.get(a);
      const j = index.get(b);
      if (i === undefined || j === undefined) return undefined;
      const d = distancesFrom(adjacency, i)[j];
      return d === -1 ? undefined : d;
    },
  };
}

const pct = (value) => `${(value * 100).toFixed(1)}%`;

const sources = await loadSources();
process.stdout.write(`${sources.summary}\n`);

for (const length of LENGTHS) {
  const { answers, guesses } = buildLists(length, sources);
  const pool = ladderPool(length, sources);
  const band = bands[length];

  process.stdout.write(
    `\n== ${length} letters · answers ${answers.length} · guesses ${guesses.length} · ` +
      `pool ${pool.length} · band ${band[0]}–${band[1]} ==\n`,
  );
  process.stdout.write(
    'pool size | ladder | gzip KB | par<=3 | par4  | par5  | par6  | par7  | par8+ | unreach | in band | starts with in-band end\n',
  );

  if (process.argv.includes('--full')) {
    const { coverage, row } = measure(guesses, answers, band);
    process.stdout.write(
      `     full | ${String(guesses.length).padStart(6)} |         | ${pct(row['par<=3']).padStart(6)} | ${pct(row.par4).padStart(5)} | ` +
        `${pct(row.par5).padStart(5)} | ${pct(row.par6).padStart(5)} | ${pct(row.par7).padStart(5)} | ${pct(row['par8+']).padStart(5)} | ` +
        `${pct(row.unreachable).padStart(7)} | ${pct(row.inBand).padStart(7)} | ${pct(coverage)}  (whole guess list, for reference)
`,
    );
  }

  for (const size of sizes) {
    const ladder = buildLadder(pool, answers, size);
    const gzipKb = gzipSync(ladder.map((word) => `  '${word}',`).join('\n')).length / 1024;
    const { coverage, row } = measure(ladder, answers, band);
    const mark = coverage >= TARGET_COVERAGE ? '  <= meets 90%' : '';

    process.stdout.write(
      `${String(size).padStart(9)} | ${String(ladder.length).padStart(6)} | ${gzipKb.toFixed(1).padStart(7)} | ` +
        `${pct(row['par<=3']).padStart(6)} | ${pct(row.par4).padStart(5)} | ${pct(row.par5).padStart(5)} | ` +
        `${pct(row.par6).padStart(5)} | ${pct(row.par7).padStart(5)} | ${pct(row['par8+']).padStart(5)} | ` +
        `${pct(row.unreachable).padStart(7)} | ${pct(row.inBand).padStart(7)} | ${pct(coverage)}${mark}\n`,
    );
  }
}
