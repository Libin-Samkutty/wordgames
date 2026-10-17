# Word list provenance

The `lists-4.ts`, `lists-5.ts`, and `lists-6.ts` modules in this directory are **generated**, not hand-edited. Regenerate them with:

```bash
node scripts/build-dictionaries.mjs
npm run format
```

The generator is the only part of this repository that touches the network, and it is run by hand during development. It never runs in `npm run build`, in tests, or in the browser — the application makes zero network requests (NFR-5, ADR-001).

## Sources

| Source                                                                                                                         | Used for                                      | Licence                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| [ENABLE1](https://github.com/dolph/dictionary/blob/master/enable1.txt) (Enhanced North American Benchmark Lexicon, Alan Beale) | Guess list for each length                    | **Public domain**, explicitly released by the author                                                  |
| [`unix-words`](https://github.com/dolph/dictionary/blob/master/unix-words) (the traditional `/usr/share/dict/words`)           | Supplementary guess list, merged with ENABLE1 | Public domain; mirrored in the same repo as ENABLE1                                                   |
| [`popular.txt`](https://github.com/dolph/dictionary/blob/master/popular.txt) (dolph/dictionary)                                | Familiarity filter for answer candidates      | Public domain, derived from ENABLE1                                                                   |
| [`count_1w.txt`](https://norvig.com/ngrams/) (Peter Norvig, from the Google Web Trillion Word Corpus)                          | Frequency ranking to order answer candidates  | Data published freely for research and teaching; word/frequency pairs are facts and not copyrightable |

ENABLE1 is the standard free word list used by word games; it contains no capitalised proper nouns, no hyphenated forms, and no abbreviations with punctuation. Sources are cached in `scripts/.cache/` (gitignored) so repeat runs are offline and deterministic.

## How the lists differ (ADR-004, ADR-025)

**`guesses`** — every ENABLE1 word of the given length. Permissive by design, so a player who types a real word is almost never told it isn't one.

**`answers`** — the 700 most frequent words of that length that also pass a fairness screen. Small and curated, so every solution is deducible.

**`shuffle`** — the words WordShuffle draws its targets from (ADR-038): the 1,500 candidates ranked just below the answers, under the answer fairness filters plus two shuffle-only ones. A hand-read blocklist drops first names, surnames, places, foreign words, archaic forms, interjections, slang and crude or distressing words. A rule drops past-tense and -ing forms whose stem is also a word, because the ending gives the shape away. The blocklist is `SHUFFLE_BLOCKLIST` in the generator. It never contains an answer, and every word is a valid guess.

**`ladder`** (4 and 5 letters only) — the words WordWeaver builds ladders from: the most frequent ENABLE1 words of that length that have corpus frequency data, minus the blocklisted, name-like and clipped words, plus every answer. 1,400 words for 4 letters and 5,000 for 5. The plural rule for answers is not applied, because `CARS` is a fine rung. The sizes come from `scripts/measure-par.mjs` (SPEC §15.1) and are set by `LADDER_POOL_SIZE` in the generator.

## Answer fairness filters

Applied to the answer pool only. Every filtered word remains a **valid guess** — silently rejecting a word the player typed is a worse experience than accepting it, and the guess list is never displayed back to them.

| Filter                                              | Rationale                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trailing `-S` / `-ES` where the stem is also a word | Plurals and third-person verbs make poor answers: the final S is nearly free information, leaving the player to brute-force the stem. The original game applies the same rule.                                                                                                                                                                                                                                                                |
| Two or fewer distinct letters                       | Words such as `MAMA` become guessing games rather than deduction.                                                                                                                                                                                                                                                                                                                                                                             |
| Offensive / distressing words                       | Answers appear in celebratory UI and are announced by screen readers (FR-31). Slurs, vulgarities, and words about death, violence, or illness are excluded.                                                                                                                                                                                                                                                                                   |
| Reads as a proper noun                              | `AMAZON`, `YAHOO`, `WARREN`, `WRIGHT` and similar are legitimate lowercase English words — that is why ENABLE1 keeps them — but players read them as a company, a website, or a surname, and a solution that _feels_ like a proper noun feels unfair. Deliberately conservative: ordinary words that merely happen to also be surnames (`BROWN`, `GREEN`, `STONE`, `BAKER`, `KING`, `HOPE`) are kept, since removing them would gut the pool. |
| Clipped forms                                       | `COMP`, `PARA`, `TEMP`, `SPEC` are fragments of longer words rather than words players think in. Note that genuine standalone shortenings (`PHOTO`, `MEMO`, `DEMO`, `INFO`, `COMBO`) are kept.                                                                                                                                                                                                                                                |

## Current output

| Length | Answers | Guesses | Shuffle | Ladder |
| ------ | ------- | ------- | ------- | ------ |
| 4      | 700     | 6,142   | 712     | 1,400  |
| 5      | 700     | 13,746  | 1,144   | 5,000  |
| 6      | 700     | 24,637  | 1,051   | none   |

Comfortably above the SPEC minimums of 300 answers and 1,500 guesses (FR-30). At 700 answers per length, the no-repeat ring buffer (FR-4) suppresses the 50 most recent solutions, so a player sees no repeat for at least 50 games.

## Growing the word lists without duplicates

`guesses` is built from a **union of Sets**, not a concatenation of arrays: `new Set([...enable, ...unixWords])` in `scripts/build-dictionaries.mjs`. Adding a word that's already present is a no-op on a Set, so duplicates are structurally impossible rather than something filtered out after the fact — the same mechanism that keeps `enable`+`unixWords` clean today works for a third, fourth, or fifth source with no extra dedup logic.

To add another source:

1. Add its URL to the `SOURCES` map.
2. Fetch and `parseWords()` it into an uppercase Set, same as the existing sources.
3. Fold it into `allWords` with another Set-union spread.
4. Re-run `node scripts/build-dictionaries.mjs && npm run format`.

A word from the new source only reaches `answers` if it also clears the existing candidate filters (`popular.has(word) && ranks.has(word)`, plus `isFairAnswer`) — so a permissive new source only grows `guesses`, never accidentally pollutes the curated `answers` pool. `src/dictionary/__tests__/data.test.ts` re-checks uniqueness, sort order, and the `answers ⊆ guesses` invariant against whatever the generator produces, so a bad merge fails tests rather than shipping quietly.

## Invariants

Enforced twice — by the generator (which throws rather than emit a bad file) and by `src/dictionary/__tests__/data.test.ts`:

- Uppercase `/^[A-Z]+$/`, exactly the declared length (FR-27)
- Unique and sorted ascending (FR-27)
- `answers ⊆ guesses` (FR-26)
- For 4 and 5 letters, `answers ⊆ ladder ⊆ guesses` (FR-75)
- `answers.length ≥ 300`, `guesses.length ≥ 1500` (FR-30)
