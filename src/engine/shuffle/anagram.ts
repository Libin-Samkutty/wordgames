/** Words keyed by their sorted letters: every key lists the words that are anagrams of each other. */
export type AnagramIndex = ReadonlyMap<string, readonly string[]>;

/** A word's letters in sorted order, the same for every anagram of it (FR-141). */
export function anagramKey(word: string): string {
  return [...word].sort().join('');
}

/**
 * Builds the anagram lookup once per length from the guess list (ADR-032). Each
 * list keeps the order of `words`, so a sorted guess list gives sorted anagrams.
 */
export function buildAnagramIndex(words: Iterable<string>): AnagramIndex {
  const index = new Map<string, string[]>();

  for (const word of words) {
    const key = anagramKey(word);
    const group = index.get(key);

    if (group) group.push(word);
    else index.set(key, [word]);
  }

  return index;
}

/** Every indexed word that uses exactly the letters of `word`, including itself if listed. */
export function anagramsOf(index: AnagramIndex, word: string): readonly string[] {
  return index.get(anagramKey(word)) ?? [];
}
