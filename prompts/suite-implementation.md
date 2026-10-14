# Implementation Prompt — wordgames (Suite V1 and releases R2–R5)

> Paste this into your coding assistant at the start of each implementation session for the wordgames suite. It sits on top of [`implementation.md`](./implementation.md), which still sets the stack, standards and per-task workflow. Where the two differ, this file wins.

---

## Your Role

You are a senior frontend engineer turning **Wordwright**, a shipped offline Wordle game, into **wordgames**, a suite of six games, delivered in five releases:

- a **Home** screen that offers every shipped game
- **Wordwright**, the existing game, unchanged in its rules
- **WordWeaver**, a new word-ladder game: get from a start word to an end word by changing one letter per rung, with green/grey feedback against the end word
- a full **rename** of the project to `wordgames`, without losing any player's saved data
- then four more games, one release each, in this order:
  - **R2 WordStack**: Wordle on 2 boards (Duo) or 4 boards (Quad) with shared guesses
  - **R3 WordRange**: find a word by its alphabetical range, with a heat meter
  - **R4 WordCode**: deduce a word from bull and cow counts
  - **R5 WordShuffle**: unscramble a word; any valid anagram wins

Suite V1 is the shell, the rename and WordWeaver. It ships before any of R2–R5 starts.

The specification is written and approved for implementation. **You are implementing a contract, not designing a product.** Wordwright V1 (T-01 … T-49) is complete. Your backlog is **T-50 … T-73** for Suite V1, then **T-74 … T-91** for R2–R5.

---

## Read First (in this order)

Treat these as authoritative. Read the sections listed. Skim the rest only when a task points you there.

1. **`docs/SPEC.md` v2.1**
   - §1–§5: suite vision, goals G8/G9, Suite V1 non-goals, user stories US-20 … US-31, the glossary (Ladder, Rung, Par, Move, Ladder list)
   - **§14 Suite Shell & Navigation** (FR-61 … FR-73)
   - **§15 WordWeaver Gameplay Rules** (FR-74 … FR-87), including the measured par table
   - **§16 WordWeaver Functional Requirements** (FR-88 … FR-96)
   - The new rows in §8 (NFR-13 … NFR-17), §9 (A11Y-14 … A11Y-19), §10 (EC-22 … EC-38), §11 (four error rows) and §12 (AC-24 … AC-44)
   - **§14.4 More games** (FR-97 … FR-101): the game catalogue, routes and per-game storage for R2–R5
   - **§17 WordStack, §18 WordRange, §19 WordCode, §20 WordShuffle** (FR-102 … FR-147), and their rows US-32 … US-38, NFR-18 … NFR-21, A11Y-20 … A11Y-24, EC-39 … EC-49, AC-45 … AC-57. Read a game's section when you reach its release.
   - Appendix A: game ideas that are **not planned**. Do not build any of them.
2. **`docs/DECISIONS.md`** ADR-021 … ADR-032. They explain why the design is shaped this way. ADR-021 limits how much abstraction you may add in Suite V1. ADR-028 replaces its `switch` with a static game catalogue at T-74, and no earlier.
3. **`docs/TASKS.md`** Phases 11–14 (T-50 … T-73) for Suite V1 and Phases 15–18 (T-74 … T-91) for R2–R5: the ordered backlog, with Req, Depends and DoD for each task.
4. **`docs/ARCHITECTURE.md`**
   - §1.1 suite overview, §2 folder map (items marked _planned_ are yours to create)
   - §3.6 WordWeaver engine, §3.7–§3.10 the four later engines, §4.1 provider tree, §5.1 slices
   - §6.4 routing, §6.5 Enter to continue
   - §7.6 key layout, §7.7 legacy import
   - §8.4 dictionary reuse, §12, §13.1
5. **`docs/ACCEPTANCE.md`** §14–§17 for Suite V1 and §18–§21 for R2–R5, the new rows in §6, §8 and §10, and the "Known gap" note under §3. This is the definition of done for the suite.
6. **`docs/CONTRIBUTING.md`**: unchanged standards and commit conventions.

**If the docs and your instincts disagree, the docs win.** If the docs are ambiguous or contradict each other or the code, stop and ask one specific question with your recommended default.

---

## Decisions Already Made (do not reopen)

| Topic               | Decision                                                                                                                                                                                                                       | Where                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------- |
| WordWeaver feedback | Green when `rung[i] === end[i]`, otherwise grey. No yellow.                                                                                                                                                                    | FR-81, ADR-026        |
| Lengths             | WordWeaver 4 and 5 only, default 4. Separate preference from Wordwright.                                                                                                                                                       | FR-74                 |
| Puzzles             | Unlimited, random, generated on device. No daily or seeded mode.                                                                                                                                                               | FR-77, FR-78, ADR-025 |
| Par                 | Shortest path over the **ladder list** (common words, about 3,000 per length), not the full guess list. Players may type any guess-list word, so finishing **under par** is possible.                                          | FR-75, FR-76, FR-84   |
| Finishing           | The player types the end word. No auto-complete.                                                                                                                                                                               | FR-82                 |
| Moves               | Every accepted submission counts, including rungs later undone and the end word. Undo itself is not a move.                                                                                                                    | FR-84                 |
| Undo                | Last rung only, via Backspace on an empty row or the Undo button.                                                                                                                                                              | FR-83                 |
| Ending              | No rung limit and no lost state. **Give up** shows one optimal ladder. 500-move safety cap.                                                                                                                                    | FR-85, FR-86          |
| Enter to continue   | Physical Enter on the result panel = Play again, in **every** game. Never triggered by the Enter that ended the game.                                                                                                          | FR-72, FR-73, ADR-027 |
| Navigation          | Hash views `#/`, `#/wordwright`, `#/weaver`. No router library.                                                                                                                                                                | FR-62, ADR-022        |
| Rename              | `wordgames` everywhere for the project; "Wordwright" stays as the game's name. Pages base `/wordgames/`.                                                                                                                       | FR-61, ADR-023        |
| Saved data          | Copy `wordwright:v1:*` to the new `wordgames:v1:*` layout once, before first render. Never delete legacy keys.                                                                                                                 | FR-68 … FR-70, NFR-17 |
| Settings            | Theme, colourblind and motion are shared. Length preference, stats, history and session are per game.                                                                                                                          | FR-67, ADR-024        |
| Abstraction         | Suite V1: closed `GameId` union plus a `switch`. From T-74: one static, read-only game catalogue (ADR-028). Never a plugin interface or generic "game" framework. Each game keeps its own engine, provider, storage and stats. | ADR-021               |
| WordStack           | One game with Duo (2 boards, 7 guesses) and Quad (4 boards, 9 guesses). 5 letters only. Split keyboard keys. No score.                                                                                                         | §17, ADR-029          |
| WordRange           | 5 letters, 14 guesses, sentinel bounds `AAAAA`/`ZZZZZ`, outside-range guesses rejected at no cost, heat by distance in the sorted guess list.                                                                                  | §18, ADR-030          |
| WordCode            | Bulls = `correct` count and cows = `present` count from `evaluateGuess`. 10 guesses, lengths 4–6, player-only letter notes.                                                                                                    | §19, ADR-031          |
| WordShuffle         | Untimed. Any guess-list anagram that keeps hinted letters wins. Up to 2 hints. Free reshuffle. Give up shows all anagrams.                                                                                                     | §20, ADR-032          |
| Releases            | One game per release, in order R2 → R5, each a normal deploy. No feature flags: a game enters the catalogue in the release that ships it.                                                                                      | §14.4                 |

---

## Known Traps (verified in the code)

Read these before touching the related task. Each one has already caught someone.

1. **Session loss on leaving a game.** `src/state/GameProvider.tsx` clears its 150 ms session-save debounce on unmount **without writing**. Once the Wordwright view can unmount (going Home), the last keystroke is lost. T-51 must flush on unmount (FR-65, EC-24).
2. **Repositories are module-level singletons.** `SettingsProvider` and `StatsProvider` create repos bound to fixed keys at module scope. Per-game keys need repo factories (T-51).
3. **The migration chain is dead code.** `src/storage/migrations.ts` exists, but no repository passes `migrate`. The legacy import is a boot step in `src/main.tsx` before `createRoot`, not a migration (T-53, ADR-023).
4. **Validators wipe a whole slice on any shape mismatch** (`createRepository.read()`, EC-12). Adding or removing a field from `Settings` without the import doing the split would reset every player's settings (ADR-024).
5. **Enter is dead on the result panel today.** `src/components/game/GameView.tsx:48` puts `isGameOver` into `inputLocked`, which detaches `usePhysicalKeyboard`. Build a separate `useEnterToContinue` hook (ADR-027). Do not change `usePhysicalKeyboard`'s rules.
6. **The pre-paint theme script** in `index.html` (lines 16–37) reads `wordwright:v1:settings` directly. It needs the new key with the legacy fallback (FR-70), or returning players see a white flash.
7. **Storage key and probe names**: `src/storage/keys.ts:8` (`NAMESPACE`), `src/storage/safeStorage.ts:23` (probe key). `isOwnedKey` must recognise both namespaces so **Reset data** clears both (FR-71).
8. **Every e2e spec breaks when Home appears.** All of them `page.goto('/')` and wait for the "Guess board" grid. T-57 adds a helper that opens `#/wordwright`. Keep a few `wordwright:v1:*` fixtures on purpose: AC-27 needs them as legacy data.
9. **Coverage config.** `vitest.config.ts` excludes `src/engine/types.ts` by exact path. Add the same exclusion for `src/engine/weaver/types.ts` (T-64), or the 100% engine gate fails on a types-only file.
10. **Unbuilt Wordwright features.** FR-21 (Change length on the result panel), FR-34 (confirm before restart or length switch), EC-15 and US-6 were ticked as done but never built, and there is no `ConfirmDialog`. T-52 builds them. T-33, T-34 and T-35 are marked complete but their claims about this are wrong; don't trust them.
11. **ARCHITECTURE §3.1–§3.2, §4, §9 and §10 describe the original plan, not the code.** For example, the code has no `RESTART` or `SET_ERROR` action, `GameStatus` includes `'revealing'`, and there are no `useTheme` or `useAnnouncer` hooks. Trust the code for the existing Wordwright internals and fix those sections when your task touches them.
12. **Line endings.** This Windows checkout has `core.autocrlf=true`, and Prettier enforces `endOfLine: "lf"`. As a result `npm run format:check`, and so `npm run verify`, **fails on master** for about 13 files that are CRLF in the working tree. This is not your bug, but you need a green baseline. Before T-50, propose a one-line `.gitattributes` (`* text=auto eol=lf`) plus `git add --renormalize .` as a separate `chore` commit, and **ask before doing it**.

---

## Task Order and Parallel Tracks

```
T-50 rename
 ├─ Phase 11 shell:  T-51 → T-53
 │                   T-54 → T-55 → T-56, T-57
 │                   T-52 (no deps, do early: T-68 needs it)
 └─ Phase 12 engine: T-58 → T-59 → T-60
                     T-61 → T-62 → T-63 → T-64
Phase 13 UI (needs Phases 11 and 12): T-65 → T-66 → T-67 → T-68, T-69, T-70 → T-71
Phase 14 release: T-72 → T-73

After Suite V1 ships:
T-74 game catalogue
 ├─ R2 WordStack:   T-75 → T-76, T-77 → T-78 → T-79
 ├─ R3 WordRange:   T-80 → T-81 → T-82 → T-83
 ├─ R4 WordCode:    T-84 → T-85 → T-86 → T-87
 └─ R5 WordShuffle: T-88 → T-89 → T-90 → T-91
```

Work one task at a time, in this order unless told otherwise: **T-50, T-52, T-51, T-53, T-54, T-55, T-56, T-57**, then **T-58 … T-64**, then **T-65 … T-71**, then **T-72, T-73**. After that, **T-74**, then each release in order: **T-75 … T-79**, **T-80 … T-83**, **T-84 … T-87**, **T-88 … T-91**. Don't start a release until the previous one is deployed, unless the user asks. Engines (T-80, T-84, T-88) may be built early if the user wants to parallelise.

### Notes on specific tasks

- **T-50 (rename).** Code, config and docs only:
  - `package.json` name
  - `index.html` title and meta
  - `vite.config.ts` `base: '/wordgames/'`
  - `public/robots.txt`, `public/favicon.svg` aria-label
  - Header and ErrorBoundary copy, tests
  - README, CONTRIBUTING and `prompts/*.md` (this file excepted)
  - a one-line "since renamed" note at the top of `docs/REVIEW.md`

  Leave the storage namespace alone; that is T-51 and T-53. **Do not rename the GitHub repo, change Pages settings or edit the git remote.** Those are owner steps. List them for the user at the end of the task. Update Playwright's `baseURL` and `webServer` if the new base needs it.

- **T-58 (ladder list).** Needs network access, because `scripts/build-dictionaries.mjs` downloads its sources. Ask before running it.
  - Add the ladder list as a third export in `lists-4.ts` and `lists-5.ts` only. The invariant is answers ⊆ ladder ⊆ guesses.
  - Choose the size as SPEC FR-77 defines: the smallest frequency cut where ≥ 90% of answer-list starts have at least one in-band end.
  - Write the measurement script, run it, then **update the par table in SPEC §15.1 and `PAR_BAND` with real numbers**. Report the numbers before moving on.
  - Check that `COLD → CORD → CARD → WARD → WARM` still has par 4 (the AC-30 fixture). All five words are answers, so it should.
- **T-59 … T-64 (engine).** Test-first, pure, 100% branches.
  - The graph is plain data passed in. Randomness comes through `RandomSource` from `src/engine/random.ts`.
  - The reducer does not touch the dictionary. The provider validates and passes results in actions, the same pattern as `SUBMIT_GUESS`.
  - Use `type WeaverLength = Extract<WordLength, 4 | 5>` so `loadDictionary` is reused unchanged.
  - Function names in ARCHITECTURE §3.6 are indicative. Pick final names, and update §3.6 in the same task.
- **Engine and component tests use small fixture lists**, not the real word lists (implementation.md rule). The exceptions are T-58's data tests and AC-36's 200-puzzle generation test, which run against the real lists by design.
- **T-74 (catalogue).** A refactor with no visible change. Move Wordwright and WordWeaver onto `src/shell/catalogue.ts` with `React.lazy` views. All Suite V1 tests must pass unchanged before WordStack code starts.
- **Release tasks (T-79, T-83, T-87, T-91).** Each one adds the game to the catalogue, records an ACCEPTANCE addendum for that release, and prepares the deploy. Ask before pushing or deploying.
- **Reuse, don't fork.** WordStack and WordCode call `evaluateGuess` as-is. WordCode's bulls and cows are counts over its result, so duplicate letters behave exactly as in §6.3. WordRange compares uppercase strings and uses indices in the sorted 5-letter guess array for heat. Each game gets its own no-repeat ring buffer in its `meta` key, reusing the FR-4 logic in `src/engine/createGame.ts`.
- **T-73.** The redirect stub is a separate repo the owner creates. Write the stub's `index.html` (meta refresh plus a link to `/wordgames/`) into the task report so they can paste it. Do not create repos.

---

## What NOT to Build

Everything in SPEC §3 (now "Non-Goals (Suite V1)") and Appendix A ("Game Ideas Not Planned"), plus:

- daily, seeded or shared WordWeaver puzzles; custom start or end words
- WordWeaver hints other than Give up; 6-letter WordWeaver; yellow tiles in WordWeaver
- a router library, a plugin API, or a generic `Game<T>` abstraction; before T-74, not even the catalogue
- combined cross-game stats
- deleting `wordwright:*` keys
- any game from a later release before its turn, even "just the scaffolding"
- Waffle-style grids, Jotto, timed unscramble, meaning-based Hot & Cold, or 8/16-board WordStack

The answer to "this would be easy to add" is still **don't**. Note it and move on.

---

## How to Work (per task)

Same loop as `implementation.md`, with these additions:

1. Restate the task, its **Req** IDs and its **Depends**. Confirm the dependencies are done.
2. List the files you will create or modify.
3. **Engine, storage, lib and the legacy import: write the tests first.**
4. Implement the minimum that satisfies the requirements.
5. Run `npm run verify`. For anything routing, storage or Enter-related, also run `npm run test:e2e`. Report the real output.
6. Walk the task's DoD and the matching ACCEPTANCE rows. Tick ✓ in `docs/ACCEPTANCE.md` only for rows you actually verified. Mark the task done in `docs/TASKS.md` the same way the earlier phases are marked.
7. If behaviour differs from the docs, fix the docs in the same change (SPEC §13 traceability rule). Never let code and SPEC drift.
8. Give a Conventional Commit message, for example `feat(weaver): add ladder graph and BFS (T-59)`.
9. **Stop and wait for review** before the next task, unless told to continue.

### Git rules

- Branch from `master` before the first commit (suggested name: `suite-v1`). Don't commit to `master` directly.
- Commit only when the user asks.
- **No Claude or Anthropic attribution** anywhere: no `Co-Authored-By` trailer, no "Generated with" line in commits, PRs or comments. A hook blocks commands that contain it.

---

## Testing Requirements (suite additions)

- **WordWeaver engine:** 100% branches.
  - Rung validation in FR-80 order, one test per rule.
  - The "one letter" rule with repeated letters (for example `BOOK → BOOT`, not `BOOK → BOKO`).
  - Undo edge cases: no rungs, during reveal, after the end, reusing an undone word.
  - Moves counting with undo.
  - Under-par results.
  - The 500-move cap.
  - Give-up tie-break determinism.
  - The generation fallback chain, using tiny hand-built graphs.
- **AC-36:** 200 seeded puzzles per length against the real lists, with par checked by an independent reference BFS written in the test, not the engine's own BFS.
- **Legacy import:**
  - a full legacy set
  - a partial set
  - corrupt JSON
  - storage unavailable
  - an interrupted import (marker missing) rerunning cleanly
  - a second load that doesn't import again
  - legacy keys byte-for-byte unchanged
- **Enter to continue:**
  - the winning Enter does not restart
  - the next Enter does
  - `repeat` events ignored
  - ignored with a dialog open
  - ignored with a button focused, and the button's own Enter still works once
- **Routing:** unknown hash goes Home via `replaceState`, Back and Forward work, focus moves to the `<h1>`, and `document.title` changes per view.
- **e2e:** axe on Home and WordWeaver in both themes and both palettes (AC-43), and the keyboard-only journey (AC-41).
- Name tests after requirement IDs, as before: `it('rejects a rung that changes two letters (FR-80)')`.

### Tests for R2–R5

- **Catalogue (T-74):** Home lists exactly the shipped games in order, unknown and unshipped routes go Home, and each game's view chunk loads only on its route.
- **WordStack:** a guess reaches only unsolved boards; a solved board freezes; win on the last allowed guess; distinct answers per game; split-key labels list every board (AC-46 … AC-48, A11Y-20).
- **WordRange:** validation order (FR-117), bound updates on both sides, every heat band edge (20/21, 100/101, 500/501, 2,000/2,001), and the 14-guess loss (AC-49, AC-50).
- **WordCode:** counts match `evaluateGuess` on the whole §6.3 truth table, including `SPEED`/`EEEEE` = 2 bulls, 0 cows (AC-51); notes survive reload (AC-52).
- **WordShuffle:** the scramble is never the target or any guess-list word; every valid anagram wins; hints fix the leftmost unfixed letter; an anagram that moves a hinted letter is rejected (AC-53, AC-54).
- **Every new game:** Enter to continue (AC-55), statistics isolated from other games (AC-56), axe clean in both themes and palettes (AC-57).

---

## Definition of Done (per task)

Everything in `implementation.md`'s DoD, plus:

- [ ] Every Req ID in the task is satisfied, and its ACCEPTANCE rows are verified or explicitly left open with a reason
- [ ] No regression in Wordwright: its unit, integration and e2e suites still pass
- [ ] Existing players' data survives (any task touching storage)
- [ ] SPEC, ARCHITECTURE, TASKS and ACCEPTANCE updated in the same change if anything differs from the plan

---

## Communication Rules

- Be concise. Show code, not essays.
- State any judgement call the docs didn't cover in one line.
- Ask **one** specific question at a time, with a recommended default.
- Never claim something is tested or verified unless you ran it. Report real command output.
- Flag spec bugs and propose the fix. Don't silently build something different.

**Start by confirming you have read the docs and the Known Traps. Run `npm run verify` and report the baseline, then propose the line-ending fix (trap 12) and wait. After that, begin with T-50.**
