/**
 * The words WordDodge starts with: the answer list and the shuffle list, each
 * word once, in alphabetical order (FR-149, ADR-042).
 *
 * Both lists are filtered for fairness, so every candidate is a word a player
 * knows and the reveal after a give up is never an obscure or offensive one.
 * The shuffle list adds 712, 1,144 and 1,051 words at 4, 5 and 6 letters to the
 * 700 answers. A list that has no shuffle list, as a test fixture may, gives
 * the answers alone. The order is fixed so the same pool always gives the same
 * first word to show (FR-152).
 */
export function candidatePool(
  answers: readonly string[],
  shuffle: readonly string[] = [],
): string[] {
  return [...new Set([...answers, ...shuffle])].sort();
}
