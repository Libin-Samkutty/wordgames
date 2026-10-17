import type { RawLists } from '../types';

/**
 * The structural invariants every generated `lists-<n>.ts` module must hold
 * (FR-26, FR-27, FR-75), as a function so the same checks run against the real
 * data and against deliberately corrupted fixtures that prove they can fail.
 *
 * @returns One message per problem; empty when the lists are sound.
 */
export function listProblems(lists: RawLists, length: number): string[] {
  const problems: string[] = [];
  const named: [string, readonly string[]][] = [
    ['answers', lists.answers],
    ['guesses', lists.guesses],
  ];
  if (lists.ladder) named.push(['ladder', lists.ladder]);
  if (lists.shuffle) named.push(['shuffle', lists.shuffle]);

  for (const [name, words] of named) {
    if (words.length === 0) problems.push(`${name} is empty`);
    if (words.some((word) => !/^[A-Z]+$/.test(word))) problems.push(`${name} is not uppercase A-Z`);
    if (words.some((word) => word.length !== length)) {
      problems.push(`${name} has a word that is not ${String(length)} letters`);
    }
    if (new Set(words).size !== words.length) problems.push(`${name} has duplicates`);
    if (words.some((word, index) => index > 0 && (words[index - 1] ?? '') > word)) {
      problems.push(`${name} is not sorted`);
    }
  }

  const guesses = new Set(lists.guesses);
  if (lists.answers.some((word) => !guesses.has(word))) problems.push('an answer is not a guess');

  if (lists.ladder) {
    const ladder = new Set(lists.ladder);
    if (lists.answers.some((word) => !ladder.has(word)))
      problems.push('an answer is not in ladder');
    if (lists.ladder.some((word) => !guesses.has(word))) {
      problems.push('a ladder word is not a guess');
    }
  }

  if (lists.shuffle) {
    const answers = new Set(lists.answers);
    if (lists.shuffle.some((word) => !guesses.has(word))) {
      problems.push('a shuffle word is not a guess');
    }
    if (lists.shuffle.some((word) => answers.has(word))) {
      problems.push('a shuffle word is also an answer');
    }
  }

  return problems;
}
