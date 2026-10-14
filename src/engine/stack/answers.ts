import { pickAnswer } from '../createGame';
import type { RandomSource } from '../random';

/**
 * Draws one answer per board, all different (FR-103, EC-41).
 *
 * Each draw goes through the root engine's `pickAnswer`, so the no-repeat ring
 * buffer (FR-4) applies to every board. Answers already drawn for this game
 * are taken out of the pool, so two boards can never share an answer even when
 * the pool is small enough that the ring buffer's window would be empty.
 *
 * @param pool    The 5-letter answer list.
 * @param recent  Most-recent-first answers from earlier games, one buffer for both modes.
 * @param count   Boards to draw for.
 * @throws When the pool has fewer than `count` words: a caller bug.
 */
export function pickAnswers(
  pool: readonly string[],
  recent: readonly string[],
  count: number,
  random: RandomSource,
): string[] {
  if (pool.length < count) {
    throw new Error(`Cannot draw ${String(count)} different answers from ${String(pool.length)}`);
  }

  const drawn: string[] = [];
  for (let board = 0; board < count; board += 1) {
    const remaining = pool.filter((word) => !drawn.includes(word));
    drawn.push(pickAnswer(remaining, recent, random));
  }
  return drawn;
}
