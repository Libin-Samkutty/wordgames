import { evaluateGuess } from '../evaluate';
import type { Evaluation, LetterState } from '../types';

/**
 * The adversary (SPEC §21.1, ADR-039).
 *
 * It never picks a word. For each guess it sorts the words still possible by
 * the colours that guess would get, answers with the colours that keep the most
 * of them, and goes on with only those.
 */

/** One reply a guess can get, and the words that would have got it. */
interface Bucket {
  readonly evaluation: Evaluation;
  readonly words: string[];
}

/** What the game answers a guess with, and the words that survive it. */
export interface Reply {
  readonly evaluation: Evaluation;
  readonly candidates: readonly string[];
}

const KEY_LETTER: Readonly<Record<LetterState, string>> = {
  correct: 'c',
  present: 'p',
  absent: 'a',
};

const HIT_WEIGHT: Readonly<Record<LetterState, number>> = {
  correct: 2,
  present: 1,
  absent: 0,
};

/** A short string that is the same for the same colours, used to group words. */
function patternKey(evaluation: Evaluation): string {
  return evaluation.map((state) => KEY_LETTER[state]).join('');
}

/** How much a reply gives away: two for each green, one for each yellow. */
function hits(evaluation: Evaluation): number {
  return evaluation.reduce((sum, state) => sum + HIT_WEIGHT[state], 0);
}

/** Groups the candidates by the colours `guess` would get against each. */
function bucketize(guess: string, candidates: readonly string[]): Map<string, Bucket> {
  const buckets = new Map<string, Bucket>();

  for (const candidate of candidates) {
    const evaluation = evaluateGuess(guess, candidate);
    const key = patternKey(evaluation);
    const bucket = buckets.get(key);
    if (bucket) bucket.words.push(candidate);
    else buckets.set(key, { evaluation, words: [candidate] });
  }

  return buckets;
}

/**
 * True when `next` should replace `best`. The bigger bucket wins. A tie goes to
 * the reply with fewer hits, then to the smaller key, so the answer is always
 * the same for the same words (FR-149).
 */
function beats(next: [string, Bucket], best: [string, Bucket]): boolean {
  const [nextKey, nextBucket] = next;
  const [bestKey, bestBucket] = best;

  if (nextBucket.words.length !== bestBucket.words.length) {
    return nextBucket.words.length > bestBucket.words.length;
  }
  const nextHits = hits(nextBucket.evaluation);
  const bestHits = hits(bestBucket.evaluation);
  if (nextHits !== bestHits) return nextHits < bestHits;
  return nextKey < bestKey;
}

/**
 * The colours the game answers `guess` with, and the candidates left after.
 * The reply is all green only when the guess is the last word standing.
 *
 * @throws If `candidates` is empty, because there is then nothing to answer with.
 */
export function chooseReply(guess: string, candidates: readonly string[]): Reply {
  let best: [string, Bucket] | undefined;

  for (const entry of bucketize(guess, candidates)) {
    if (!best || beats(entry, best)) best = entry;
  }
  if (!best) throw new Error('chooseReply needs at least one candidate');

  return { evaluation: best[1].evaluation, candidates: best[1].words };
}

/** True when every letter of an evaluation is green. */
export function isAllCorrect(evaluation: Evaluation): boolean {
  return evaluation.every((state) => state === 'correct');
}
