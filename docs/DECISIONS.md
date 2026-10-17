# wordgames — Architecture Decision Records

ADR-style notes explaining _why_ the design is what it is. Each record is immutable once accepted: to change a decision, add a new ADR that supersedes it. This document exists to stop mid-implementation redesign debates.

The project was previously named Wordwright. ADR-001 to ADR-020 were written under that name, when the app was a single game; Wordwright is now the Wordle-style game inside the wordgames suite (ADR-021, ADR-023).

**Format:** Context → Decision → Consequences → Alternatives considered.

| #                                                                                              | Title                                                | Status                 |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------- |
| [001](#adr-001--no-backend)                                                                    | No backend                                           | Accepted               |
| [002](#adr-002--localstorage-for-all-persistence)                                              | LocalStorage for all persistence                     | Accepted               |
| [003](#adr-003--framework-independent-game-engine)                                             | Framework-independent game engine                    | Accepted               |
| [004](#adr-004--separate-answer-and-guess-dictionaries)                                        | Separate answer and guess dictionaries               | Accepted               |
| [005](#adr-005--kiss-over-abstraction)                                                         | KISS over abstraction                                | Accepted               |
| [006](#adr-006--react-context--usereducer-instead-of-a-state-library)                          | Context + useReducer, no state library               | Accepted               |
| [007](#adr-007--bundled-dictionaries-loaded-via-dynamic-import)                                | Bundled dictionaries via dynamic import              | Accepted               |
| [008](#adr-008--design-tokens-for-theming-and-colourblind-mode)                                | Design tokens for theming                            | Accepted               |
| [009](#adr-009--injected-randomness)                                                           | Injected randomness                                  | Accepted               |
| [010](#adr-010--six-guesses-at-every-word-length)                                              | Six guesses at every word length                     | Accepted               |
| [011](#adr-011--tailwind-for-styling)                                                          | Tailwind for styling                                 | Accepted               |
| [012](#adr-012--vitest-over-jest)                                                              | Vitest over Jest                                     | Accepted               |
| [013](#adr-013--no-pwa-in-v1)                                                                  | No PWA in V1                                         | Accepted               |
| [014](#adr-014--documentation-first-workflow)                                                  | Documentation-first workflow                         | Accepted               |
| [015](#adr-015--toolchain-version-pins-typescript-6-eslint-9)                                  | Toolchain version pins                               | Accepted               |
| [016](#adr-016--dependency-overrides-for-the-glob-stack)                                       | Dependency overrides for the glob stack              | Accepted               |
| [017](#adr-017--generated-word-lists-from-public-domain-sources)                               | Generated word lists from public-domain sources      | Accepted               |
| [018](#adr-018--tailwind-source-scanning-must-be-scoped-explicitly)                            | Tailwind source scanning scoped explicitly           | Accepted               |
| [019](#adr-019--browser-level-testing-with-playwright)                                         | Browser-level testing with Playwright                | Accepted               |
| [020](#adr-020--in-game-help-is-discoverable-not-interruptive)                                 | In-game help is discoverable, not interruptive       | Accepted               |
| [021](#adr-021--multi-game-suite-with-a-shared-shell)                                          | Multi-game suite with a shared shell                 | Accepted (refines 005) |
| [022](#adr-022--hash-based-view-routing-no-router-library)                                     | Hash-based view routing, no router library           | Accepted               |
| [023](#adr-023--rename-to-wordgames-and-import-the-legacy-namespace)                           | Rename to wordgames and import the legacy namespace  | Accepted (extends 002) |
| [024](#adr-024--shared-appearance-settings-per-game-prefs-and-stats)                           | Shared appearance settings; per-game prefs and stats | Accepted               |
| [025](#adr-025--wordweaver-puzzles-generated-on-device-over-a-common-word-ladder-list)         | WordWeaver puzzles generated on device               | Accepted (extends 004) |
| [026](#adr-026--wordweaver-rules-positional-feedback-no-rung-limit-typed-end-word-undo-counts) | WordWeaver rules                                     | Accepted               |
| [027](#adr-027--enter-starts-the-next-game-from-the-result-screen)                             | Enter starts the next game from the result screen    | Accepted               |
| [028](#adr-028--static-game-catalogue)                                                         | Static game catalogue                                | Accepted (refines 021) |
| [029](#adr-029--wordstack-one-game-duo-and-quad-modes)                                         | WordStack: one game, Duo and Quad modes              | Accepted               |
| [030](#adr-030--wordrange-alphabetical-range-with-heat-by-list-distance)                       | WordRange: alphabetical range, heat by list distance | Accepted               |
| [031](#adr-031--wordcode-bulls-and-cows-from-evaluateguess)                                    | WordCode: bulls and cows from evaluateGuess          | Accepted               |
| [032](#adr-032--wordshuffle-untimed-any-valid-anagram-wins)                                    | WordShuffle: untimed, any valid anagram wins         | Accepted               |
| [033](#adr-033--reset-actions-live-in-each-games-statistics-dialog)                            | Reset actions live in each game's Statistics dialog  | Accepted (refines 024) |
| [034](#adr-034--game-controls-reach-the-shell-header-through-a-portal-slot)                    | Game controls reach the header through a portal slot | Accepted (refines 021) |
| [036](#adr-036--wordweaver-backspace-no-longer-undoes)                                         | WordWeaver: Backspace no longer undoes               | Accepted (refines 026) |
| [037](#adr-037--wordrange-plays-4-5-and-6-letters)                                             | WordRange plays 4, 5 and 6 letters                   | Accepted (refines 030) |
| [038](#adr-038--wordshuffle-rarer-targets-no-letter-in-place-a-visible-clock)                  | WordShuffle: harder targets, scramble, a clock       | Accepted (refines 032) |
| [039](#adr-039--worddodge-an-adversary-that-never-picks-a-word)                                | WordDodge: an adversary that never picks a word      | Accepted               |
| [040](#adr-040--wordhunt-find-the-common-words-hiding-in-six-letters)                          | WordHunt: the common words hiding in six letters     | Accepted               |
| [041](#adr-041--wordhang-hangman-with-six-misses-one-letter-at-a-time)                         | WordHang: Hangman with six misses                    | Accepted               |
| [042](#adr-042--worddodge-draws-on-the-answer-and-shuffle-lists)                               | WordDodge: the answer and shuffle lists              | Accepted (refines 039) |

---

## ADR-001 — No backend

**Context.** Wordle's core loop needs no server: the dictionary is small, evaluation is a pure function, and there is exactly one player. A server would add hosting cost, deployment complexity, latency, privacy obligations, and an availability dependency for a game that should work on a plane.

**Decision.** V1 ships as a static SPA. No API, no server-side rendering, no serverless functions, no third-party services (no analytics, no fonts from CDNs, no error reporting).

**Consequences.**

- Deployable to any static host; the build output is the product.
- The answer is present in client memory and LocalStorage — cheating is trivially possible. Accepted: this is a single-player puzzle, not a competition. V3 competitive modes will need server-side validation, which the pure engine can be reused for.
- No cross-device sync, no shared daily word for everyone. Daily challenge in V2 will be _deterministic-by-date_, computed locally from a seed, which gives the same word to everyone without a server.
- Zero attack surface, zero PII, no cookie banner, no GDPR footprint.

**Alternatives.** (a) Thin API for the daily word — rejected, a date-seeded PRNG achieves the same locally. (b) Edge function for anti-cheat — rejected as V3 scope.

---

## ADR-002 — LocalStorage for all persistence

**Context.** We must persist settings, statistics, and an in-progress game. Options: LocalStorage, IndexedDB, cookies, OPFS, in-memory only.

**Decision.** LocalStorage, behind a `Repository<T>` abstraction with versioned keys (`wordwright:v1:<slice>`), runtime validation, a migration chain, and an in-memory fallback.

**Consequences.**

- Synchronous reads mean settings and theme apply before first paint — no flash, no async provider gymnastics.
- Our largest payload (50 recent games + aggregates) is a few KB, far below the ~5 MB quota.
- LocalStorage is unavailable or throwing in some contexts (Safari private mode, blocked cookies, quota 0). The `safeStorage` probe plus in-memory fallback keeps the app playable (EC-11).
- Data is per-origin and per-browser; clearing site data wipes stats. Documented in the UI's danger zone.
- Cross-tab consistency handled by the `storage` event for settings and stats; the active session is intentionally _not_ synced (last write wins).

**Why the repository indirection at all,** given ADR-005? Because it is the single seam that makes V2 migrations and V3 cloud sync possible, it is ~60 lines, and it centralises the try/catch that would otherwise be scattered through every component. It pays for itself immediately.

**Alternatives.** (a) IndexedDB — async API, more code, transactional guarantees we don't need for kilobytes of data; reconsider only if V2 stores per-day history at scale. (b) Cookies — sent on every request, size-limited, pointless without a server. (c) In-memory only — fails the streak/stats requirement outright.

---

## ADR-003 — Framework-independent game engine

**Context.** Game rules (evaluation, validation, scoring, state transitions) are the highest-value, longest-lived, most bug-prone part of the app. UI frameworks change; Wordle rules do not.

**Decision.** All rules live in `src/engine/` as pure TypeScript with **zero imports from React, the DOM, `localStorage`, timers, or `Math.random`**. The engine exposes a reducer plus pure helpers. Impurity (randomness, clock, dictionary) is injected as parameters.

**Consequences.**

- Engine tests run in a node environment in milliseconds with no rendering — this is why 100% branch coverage is affordable (NFR-8).
- The duplicate-letter algorithm — historically the #1 source of Wordle-clone bugs — is isolated and exhaustively tested against a truth table.
- The same engine can back a V2 web worker, a V2 daily-challenge precomputation, or a V3 server-side validator with no changes.
- Cost: a small amount of plumbing, notably dictionary validation being performed in the provider and its _result_ dispatched into the reducer, rather than the reducer looking words up itself. This is a deliberate trade and is documented in ARCHITECTURE §3.2.

**Alternatives.** (a) Rules inside React hooks — faster to write, far harder to test, and couples the most stable code to the least stable layer. (b) A class-based `Game` object with internal state — mutable, harder to serialise for persistence, and a poor fit for React's snapshot rendering model.

---

## ADR-004 — Separate answer and guess dictionaries

**Context.** A single word list forces a bad choice: a small list rejects legitimate guesses ("that's a real word!"), while a large list yields obscure answers no one can deduce (`XYLYL`).

**Decision.** Two lists per length. `answers-<n>` is small and curated (common, fair, no profanity, no proper nouns). `guesses-<n>` is large and permissive, and is a strict superset of the answer list (enforced by a test).

**Consequences.**

- Answers are always solvable and satisfying; guesses are rarely rejected unfairly.
- Guess validation is one `Set.has` on the large list (O(1), FR-17).
- Two artefacts per length to curate and keep in sync; the superset invariant test catches drift.
- Slightly larger bundle — mitigated by per-length code splitting (ADR-007).
- Enables V2 difficulty settings ("common answers only" vs "expanded") purely as data selection, and V3 community dictionaries as an extra registry entry.

**Alternatives.** (a) One list — rejected for the reasons above; it is the single most common complaint about Wordle clones. (b) Runtime frequency filtering — needs frequency data and produces unpredictable results; curation at build time is simpler and reviewable.

---

## ADR-005 — KISS over abstraction

**Context.** V2 and V3 lists are long and tempting. The classic failure mode of a documentation-first project is building a plugin architecture for features that may never ship.

**Decision.** Build the simplest implementation that satisfies V1. Prepare for the future only through **cheap seams**: function parameters, data maps, discriminated-union fields, and design tokens. No abstract base classes, no plugin registries, no dependency-injection container, no premature generics, no "mode strategy" interfaces, no feature flags.

Concretely, allowed seams are exactly: `RandomSource`, the dictionary registry map, `Repository<T>`, injected validation predicates, the `GameStatus`/action unions, and CSS design tokens. Everything else is written for today's requirement.

**Consequences.**

- Less code, fewer files, faster comprehension, easier review.
- Some V2 features will require touching several files — that is acceptable and cheaper in expectation than maintaining speculative indirection.
- Reviewers have an explicit rule to cite when rejecting speculative abstraction: _"ADR-005 — is this needed by V1?"_
- Rule of thumb adopted: **abstract on the third occurrence**, not the first or second.

**Alternatives.** A generalised game-mode framework up front — rejected; it would triple the surface area for hypothetical requirements whose real shape we cannot know yet.

---

## ADR-006 — React Context + useReducer instead of a state library

**Context.** State comprises four small, mostly independent slices (game, stats, settings, toasts). Candidates: Redux Toolkit, Zustand, Jotai, XState, or built-in React.

**Decision.** `useReducer` + split Contexts, one per slice, with memoised values.

**Consequences.**

- Zero runtime dependencies beyond React (NFR-10) and no library API to learn.
- The game reducer is already a pure function of `(state, action)` — the engine _is_ the store; React just hosts it.
- Manual `useMemo`/`useCallback` discipline is required to avoid needless re-renders; split contexts bound the blast radius.
- Time-travel debugging and devtools are lost. Acceptable for this size; the reducer is trivially testable in isolation instead.
- If a real performance issue appears, migrating to `useSyncExternalStore` or Zustand is mechanical because all mutations already flow through reducers/repositories (NFR-11).

**Alternatives.** (a) Redux Toolkit — boilerplate and a dependency for four slices. (b) Zustand — attractive, but Context is sufficient and dependency-free. (c) XState — the state chart is genuinely small (§3.2); a hand-written reducer is clearer here.

---

## ADR-007 — Bundled dictionaries loaded via dynamic import

**Context.** Three lengths × two lists ≈ tens of thousands of words. Loading everything up front hurts TTI (NFR-2); fetching at runtime breaks the offline guarantee (NFR-5).

**Decision.** Word lists are TypeScript modules bundled at build time, loaded per length through `import('./data/lists-<n>')`, cached in memory, with in-flight deduplication.

**Consequences.**

- A 5-letter player never downloads 4- or 6-letter data; the initial bundle stays within NFR-1.
- Dynamic import of a same-origin, already-cached asset works offline after first load — no `fetch`, no network dependency.
- We get an honest loading state (FR-56) and a real error path (EC-14) instead of a fake one.
- Adding a length is two data files plus one registry line (FR-29).
- Cost: async initialisation on first play of each length, and StrictMode double-invocation must be deduplicated (handled in `loadDictionary`).
- Word lists are compiled by the bundler; they must be plain arrays with no computation so tree-shaking and minification stay predictable.

**Alternatives.** (a) JSON in `public/` fetched at runtime — reintroduces network semantics and a failure mode we would then have to cache manually. (b) One static import of everything — simplest, but ~150–300 KB of words on first paint for no benefit. (c) Compressed/encoded blobs — premature; revisit only if the bundle budget is breached.

---

## ADR-008 — Design tokens for theming and colourblind mode

**Context.** We need light, dark, system, and a colourblind-safe palette in V1, and arbitrary themes in V2, without rewriting components.

**Decision.** All colour flows through semantic CSS custom properties (`--color-tile-correct`, `--color-surface`, …). Themes are attribute switches on `<html>`: `class="dark"`, `data-palette="cb"`. Components reference tokens via Tailwind and never hard-code a colour.

**Consequences.**

- Colourblind mode is a token swap (blue/orange), not a component change — plus non-colour markers so colour is never the only signal (A11Y-8).
- V2 themes are new token sets; zero component churn.
- Contrast can be audited in one file rather than across dozens of components.
- Discipline required: a raw `bg-green-500` in a component is a review-blocking defect.
- Theme is applied by an inline script before hydration to avoid a flash of incorrect theme.

**Alternatives.** (a) Tailwind `dark:` variants everywhere — doubles class lists and does not extend to a third palette. (b) CSS-in-JS theme provider — a runtime dependency and styling cost we don't need.

---

## ADR-009 — Injected randomness

**Context.** Random answer selection makes tests non-deterministic, and V2 needs date-seeded and shareable-seed games.

**Decision.** The engine depends on a `RandomSource { next(): number }` interface. Production passes a `Math.random` wrapper; tests pass fixed sequences; V2 will pass `seededRandom(seed)` (mulberry32).

**Consequences.**

- Every engine test is deterministic and reproducible; a failing case can be pinned by seed.
- Daily challenge and shareable seeded games become configuration, not new rules (ARCHITECTURE §12).
- Trivial cost: one parameter threaded through `createGame`.

**Alternatives.** Calling `Math.random()` inside the engine and stubbing the global in tests — brittle, leaks between tests, and blocks seeded modes.

---

## ADR-010 — Six guesses at every word length

**Context.** 4-letter words have a smaller search space than 6-letter words, so a difficulty-scaled guess count (e.g. 5/6/7) is arguable.

**Decision.** Exactly 6 guesses for all lengths, per the product requirement.

**Consequences.**

- One board shape, one loop, one distribution bucket set (1–6) — stats stay comparable across lengths.
- 4-letter mode plays easier and 6-letter harder; this is expressed through the **score multiplier** (FR-23) rather than the guess count, which keeps the UI identical.
- `MAX_GUESSES` remains a single named constant, so a V2 mode that varies it is a small change if ever wanted.

**Alternatives.** Variable guesses per length — complicates the distribution chart, breaks cross-length comparability of stats, and adds a rule players must learn.

---

## ADR-011 — Tailwind for styling

**Context.** Required by the stack. Recording the consequences so the team applies it consistently.

**Decision.** Tailwind utilities in JSX, semantic tokens in CSS, `animations.css` for keyframes, no CSS modules or CSS-in-JS.

**Consequences.** Styles live next to markup; no naming ceremony; dead CSS is impossible; responsive and state variants are inline. Long class strings are managed with a small `cn()` helper and by extracting components (never by adding a class-name abstraction layer). Prettier's Tailwind plugin keeps class order canonical so diffs stay readable.

---

## ADR-012 — Vitest over Jest

**Context.** Required by the stack; the alternative would be Jest.

**Decision.** Vitest with jsdom for component tests and node for engine tests, plus React Testing Library.

**Consequences.** Shares Vite's transform pipeline, so there is one config and no separate Babel/ts-jest setup; ESM and TypeScript work natively; watch mode is fast enough for the test-first engine workflow. Jest-specific ecosystem snippets need light translation — acceptable.

---

## ADR-013 — No PWA in V1

**Context.** The app is offline-capable in the sense that it makes no network calls, but without a service worker it still needs the browser cache to load on a cold, disconnected start. PWA is explicitly a V2 item.

**Decision.** Ship V1 without a service worker, manifest, or install prompt.

**Consequences.**

- Avoids the hardest class of bugs in this project category — stale service-worker caches serving old bundles.
- "Offline" in V1 means: after first load, no request is made and gameplay continues with the network off (NFR-5, AC-18). Cold-start-while-offline is a V2 promise, not a V1 one, and the README/SPEC say so.
- Because all assets are static and no runtime fetching exists, adding `vite-plugin-pwa` in V2 requires no application-code change (ARCHITECTURE §12).

**Alternatives.** Ship a minimal service worker now — rejected; caching strategy, update prompts, and versioning are real work that would compete with V1 polish.

---

## ADR-014 — Documentation-first workflow

**Context.** AI coding assistants and human contributors both produce inconsistent results from short prompts, and re-litigate settled questions mid-build.

**Decision.** Write and stabilise the full document set (README, SPEC, ARCHITECTURE, TASKS, CONTRIBUTING, ACCEPTANCE, DECISIONS) _before_ any implementation. Requirements carry stable IDs (`FR-x`, `AC-x`) so code, tests, tasks, and reviews can cite them.

**Consequences.**

- The assistant implements a contract instead of inferring one; output is far more consistent across sessions.
- Scope creep is answerable with a document reference rather than an opinion.
- Docs can drift from code — mitigated by the PR checklist requiring doc updates in the same PR (CONTRIBUTING).
- Up-front cost before the first line of app code; repaid by the absence of mid-build redesign.

**Alternatives.** Prompt-and-iterate — faster to start, but produces architectural churn and inconsistent conventions across sessions, which is exactly what this project is set up to avoid.

---

## ADR-015 — Toolchain version pins (TypeScript 6, ESLint 9)

**Context.** At scaffold time (2026-07) the latest releases were TypeScript 7.0.2 and ESLint 10.8.0, but two required tools had not caught up:

- `typescript-eslint@8.65.0` declares `typescript: ">=4.8.4 <6.1.0"`. TypeScript 7 is outside that range, and no `typescript-eslint` release supports it yet.
- `eslint-plugin-jsx-a11y@6.10.2` declares `eslint: "^3 … ^9"`. ESLint 10 is outside that range.

Both tools are load-bearing rather than optional: type-aware linting enforces NFR-7, and `jsx-a11y` is a first line of defence for the accessibility requirements (A11Y-1…A11Y-12), which are graded criteria in this project rather than nice-to-haves.

**Decision.** Pin **TypeScript `^6.0.3`** and **ESLint `^9.39.5`** for now. Track the upstream support and upgrade when `typescript-eslint` ships TypeScript 7 support and `jsx-a11y` (or a maintained replacement) supports ESLint 10.

**Consequences.**

- Type-aware linting and accessibility linting both work today; nothing is disabled to chase a version number.
- `baseUrl` was removed from `tsconfig.app.json` — deprecated in TS 6 and slated for removal in TS 7. Path mapping now resolves relative to the config file, which is the TS 7-compatible form, so that migration is already done.
- We are one major behind on two tools. This is a deliberate, revisitable position, not neglect; re-check at the start of each phase.
- Upgrading later is low-risk: the flat ESLint config and `tsc -b` project references are the same shape in both majors.

**Alternatives.** (a) TypeScript 7 with type-aware linting disabled — rejected, it trades an enforced quality gate for a version number. (b) ESLint 10 without `jsx-a11y` — rejected for the same reason, and accessibility is a headline goal (G5). (c) `--legacy-peer-deps` — rejected; silently ignoring peer ranges produces failures that surface later as confusing runtime errors.

---

## ADR-016 — Dependency overrides for the glob stack

**Context.** A clean install pulled in `brace-expansion` versions affected by GHSA-mh99-v99m-4gvg (high severity: DoS via unbounded expansion). The vulnerable copies arrive transitively through `minimatch@3`, which is depended on by `eslint`, `@eslint/config-array`, `@eslint/eslintrc`, and `eslint-plugin-jsx-a11y`.

The fix is only published on the `brace-expansion@5.0.8` line, and `minimatch@3` cannot consume it — its calling convention predates the v2 API rewrite. Overriding `brace-expansion` alone produced a hard crash (`TypeError: expand is not a function`) the moment ESLint tried to match a glob, so a naive override is worse than the vulnerability.

**Decision.** Override the whole glob stack to the maintained major line in `package.json`:

```json
"overrides": { "minimatch": "^10.2.5", "brace-expansion": "^5.0.8" }
```

**Consequences.**

- `npm audit` reports **0 vulnerabilities**, and ESLint runs correctly — both verified.
- `minimatch@10` is API-compatible for the glob patterns ESLint and its plugins use; the full lint suite and every architectural guard rule were re-verified after the change.
- Overrides are a blunt instrument: they apply tree-wide and can mask a genuine incompatibility in a future transitive dependency. Re-evaluate whenever ESLint or its plugins are upgraded, and delete these entries once upstream ships patched ranges natively.
- These are dev-only dependencies; nothing here reaches the shipped bundle, which remains `react` + `react-dom` only (NFR-10).

**Alternatives.** (a) Leave the advisory unresolved — rejected; a green audit is part of the quality bar and a persistent warning trains people to ignore audits. (b) `npm audit fix --force` — rejected; it proposed downgrading `eslint-plugin-jsx-a11y` to 6.4.1, losing flat-config support. (c) Drop `jsx-a11y` — rejected, see ADR-015.

---

## ADR-017 — Generated word lists from public-domain sources

**Context.** V1 needs ~700 fair answers and thousands of valid guesses at each of three lengths — roughly 30,000 words. Hand-curation is infeasible and unauditable; an API is forbidden (ADR-001, NFR-5). We also need the lists to be _reproducible_, so a reviewer can check how a word got in.

**Decision.** Generate the lists with a committed script, `scripts/build-dictionaries.mjs`, run by hand during development and its **output committed**. Sources:

- **ENABLE1** (Alan Beale) — public domain, the standard free word-game lexicon. Supplies the guess list. Contains no capitalised proper nouns, no hyphenation, no punctuated abbreviations.
- **`popular.txt`** (dolph/dictionary) — an ENABLE1 subset used as a familiarity signal.
- **Norvig's `count_1w`** (Google Web Trillion Word Corpus) — frequency ranking that orders answer candidates. Word/frequency pairs are facts, not creative expression.

Sources are cached in `scripts/.cache/` (gitignored) so re-runs need no network.

**Consequences.**

- The script is the only thing in the repository that touches the network, and it never runs during `npm run build`, in tests, or in the browser. The shipped app still makes zero requests.
- Provenance is auditable: anyone can re-run the generator and diff the output. Each generated module carries a SHA-256 of its contents.
- The generator asserts the SPEC invariants itself (superset, sorting, uniqueness, casing, minimum sizes) and throws rather than emit a bad file — the same invariants are re-asserted by `data.test.ts` against the committed output, so both the process and the artefact are checked.
- Answer fairness is a set of explicit, reviewable filters rather than taste: trailing-S plurals, ≤2 distinct letters, offensive terms, proper-noun readings, clipped forms. **Every filtered word remains a valid guess** — rejecting a real word the player typed is a worse experience than never using it as a solution (ADR-004).
- The proper-noun filter is deliberately conservative and hand-maintained. `AMAZON`, `YAHOO`, `WARREN` and `WRIGHT` are genuine lowercase English words, but players read them as a company, a website and two surnames. Meanwhile `BROWN`, `GREEN`, `STONE`, `BAKER`, `KING` and `HOPE` are also surnames and are _kept_, because excluding every word that doubles as a name would gut the pool. This judgement cannot be automated, so it lives in a reviewed list with a comment explaining the rule.
- Cost: the filters need occasional human attention as odd words surface in play. That is accepted; the alternative is either an unfair pool or an unauditable one.

**Alternatives.** (a) Hand-curate — infeasible at 30,000 words and no more trustworthy. (b) Ship a raw frequency cut with no fairness filters — produces plurals and unpleasant answers, the most common complaint about clones. (c) Fetch lists at runtime — breaks NFR-5 and ADR-001 outright. (d) Generate at build time rather than committing output — makes builds non-deterministic and network-dependent for no benefit.

---

## ADR-018 — Tailwind source scanning must be scoped explicitly

**Context.** The production build began failing with `transforming... Killed` — an OOM kill confirmed in `dmesg`, with Rolldown reserving ~15 GB of virtual memory. Bisecting ruled out our CSS, the e2e files, minification, and thread count. Running `@tailwindcss/cli` on a file containing nothing but `@import 'tailwindcss'` reproduced it, which cleared Vite entirely.

The cause is Tailwind v4's automatic source detection. It walks the project root and relies on **git boundaries** to prune. This workspace had no `.git` directory, so `.gitignore` was never consulted and the scanner crawled `node_modules` (264 MB) plus the tool caches under the home directory.

**Decision.** Two changes, belt and braces:

1. Initialise a git repository, which is correct for the project regardless and restores Tailwind's normal pruning.
2. Declare sources explicitly in `src/styles/index.css`, so the build never depends on ambient detection:

```css
@source not '../../node_modules';
@source not '../../.npm';
@source not '../../.cache';
@source '../../index.html';
@source '../**/*.{ts,tsx}';
```

We also moved Tailwind from the Vite plugin to the PostCSS integration while diagnosing. That was not the fix — both paths OOM'd — but PostCSS is retained because the earlier build already warned that `@tailwindcss/vite` dominated build time, and the two produce identical output.

**Consequences.**

- Build time fell from ~4 s to ~0.6 s, and peak memory is now bounded.
- Class detection is explicit and reviewable: a class used outside `src/` or `index.html` will not be generated, which is a deliberate constraint rather than a surprise.
- The `@source not` lines are environment-specific belt-and-braces. They are harmless in a normal checkout and are the only thing standing between a contributor without `.git` and a mystifying OOM.
- Cost: one more thing to update if the source layout changes. The comment in the stylesheet explains why it exists.

**Alternatives.** (a) Rely on the git repository alone — works, but leaves anyone building from a tarball or a shallow copy exposed to the same failure. (b) Raise Node's heap limit — does not help; the allocation is in Rust, outside V8's budget. (c) Downgrade Tailwind — disproportionate for a configuration problem.

---

## ADR-019 — Browser-level testing with Playwright

**Context.** Several V1 requirements cannot be verified in jsdom, which reports zero for every dimension and implements no layout, paint, or preference model: contrast (A11Y-7), visible focus (A11Y-6), 320 px layout and touch targets (FR-58, FR-59, EC-18), true offline behaviour (NFR-5, AC-18), real reloads (EC-9), and Lighthouse budgets (NFR-4). Asserting these in jsdom would produce green tests that prove nothing.

**Decision.** Add Playwright (Chromium, desktop + Pixel 5 projects) running against the **production build** via `vite preview`, covering four specs: `a11y`, `responsive`, `edge-cases`, and `screenshots`. Accessibility is audited with `@axe-core/playwright`. Contrast is checked separately by `scripts/check-contrast.mjs`, which parses the real token values out of the stylesheet and is wired into `npm run verify`.

**Consequences.**

- 88 browser tests complement 336 unit and integration tests; the split is by _what only a browser can answer_, not by preference.
- Testing the production bundle means the audited artefact is the shipped artefact.
- Three real defects surfaced immediately that no unit test had caught: 43 px of horizontal overflow at 320 px, the keyboard falling below the fold in landscape, and `Enter` silently ceasing to submit after any modal visit.
- README screenshots are generated by a spec, so they cannot drift from the real UI.
- Cost: a ~115 MB browser download and a slower full-check cycle. E2E stays out of `npm run verify` and runs as a separate `npm run test:e2e`, so the inner loop remains fast.

**Alternatives.** (a) jsdom only — cannot answer any of the above honestly. (b) Manual checking — unrepeatable and unowned; the point of the acceptance checklist is that evidence is reproducible.

---

## ADR-020 — In-game help is discoverable, not interruptive

**Context.** The app explains nothing to a first-time player: no instructions, no legend for the tile colours. The obvious fix is the pattern the original Wordle uses: pop a "How to play" dialog open on a first visit. That needs a persisted "seen" flag, and the only sensible home for it is the settings record (`wordwright:v1:settings`) — where `validateSettings` is all-or-nothing and `createRepository.read()` treats a `null` result as corrupt. An additive required field there would silently reset every existing player's theme, colourblind, and motion preferences on upgrade, plus raise a "saved data was reset" toast for a change that added nothing they'd notice as a loss. It would also put a focus-trapped modal in front of every one of the 88 existing browser tests and the integration suite, all of which boot from empty storage.

**Decision.** Help (FR-60) is reachable only from a header control (`How to play`, first in the tab order). Nothing about it is persisted; `HelpModal` is a pure function of `isOpen` and the active `wordLength`, exactly like `StatsModal` and `SettingsModal`.

**Consequences.**

- No schema change, no migration, no upgrade risk, no seeding required in any existing test.
- The example tiles reuse the board's own colour tokens and marker glyphs (`board/tileAppearance.ts`) rather than `Tile` itself, since `Tile` renders `role="gridcell"` and an orphan gridcell outside a grid/row ancestry is a critical axe violation.
- The cost is discoverability: a player who never looks at the header never sees the dialog. Accepted for V1 — auto-open on first visit can be added later as its own change, and would then owe the tolerant-validation work this decision avoids (see Alternative a).
- FR-29's promise that a new word length costs "no other file changes" now has one more touchpoint: a `HELP_EXAMPLES` entry. The `Record<WordLength, …>` type this is stored as turns a missing entry into a compile error rather than a silently blank dialog, which is the honest version of that promise.

**Alternatives.**

- (a) Auto-open once, gated by a `helpSeen` flag on `Settings`. Needs `validateSettings` to treat the field as optional with an asymmetric default (absent record → unseen; present record missing the field → treated as seen, since that means a returning player) to avoid the upgrade-reset problem above, plus seeding every e2e spec and two existing unit suites so they don't boot behind a modal. Real option, deferred rather than rejected.
- (b) A separate storage key for the flag. Avoids touching the settings schema, but adds a key, a repository, and provider plumbing for a single boolean — against ADR-005's preference for the cheapest working shape.
- (c) An inline panel under the board instead of a modal. Competes for the same space as `ResultPanel` and risks pushing the keyboard below the fold on short viewports (EC-18), which a portalled, scrollable dialog does not.

---

## ADR-021 — Multi-game suite with a shared shell

**Context.** The app is growing from one game into a suite: Wordwright plus a word-ladder game, WordWeaver (SPEC §14–§16). The two games share a lot of surface: appearance settings, the header frame, toasts, modals, the on-screen keyboard, tile tokens, the word lists and the storage layer. Their rules, state and statistics are different. ADR-005 bans plugin registries and "mode strategy" interfaces, and says to abstract on the third occurrence. Two games is the second occurrence.

**Decision.** Build the suite by composing plain parts:

- One shell owns the URL, Home, the header frame, shared settings and the storage layout (FR-61 to FR-71).
- Games are named by a closed union, `type GameId = 'wordwright' | 'weaver'`. The shell picks the view with a `switch` over the route (ADR-022). There is no game registry, no plugin API and no shared "game" interface or strategy object.
- Each game has its own engine folder, reducer, providers and components. Shared UI parts (`Modal`, `Button`, `Keyboard`, tile tokens, `ConfirmDialog`) are reused by import.
- Where two providers look alike but hold different shapes (stats, session), each game gets its own provider. We accept the duplication rather than write a generic provider.
- Revisit this at a third game. That is when ADR-005's rule of three says a shared shape may be worth extracting.

How the existing ADRs apply: ADR-003 (pure engine), ADR-009 (injected randomness) and ADR-013 (no PWA) apply to WordWeaver unchanged. ADR-010 (six guesses) and FR-29 (adding a length) are Wordwright-only.

**Consequences.**

- The games cannot affect each other's rules or state. A WordWeaver bug cannot corrupt Wordwright stats (G8).
- Adding a third game touches a few known places: the `GameId` union, the route switch, a Home card and a storage namespace. TypeScript flags a missed `switch` case.
- Some provider code is duplicated across the two games. It is small, and each copy is simpler than a generic version would be.
- Engine purity rules and the 100% coverage gate extend to `src/engine/weaver/` (NFR-16).

**Alternatives.** (a) A game registry with a common `Game` interface (view, reducer, stats shape). Rejected: with two games we would be guessing at the shape, which ADR-005 forbids. (b) A separate app per game. Rejected: it duplicates the shell, settings and lists, and splits a player's data across two sites. (c) WordWeaver as a mode inside Wordwright's engine. Rejected: the rules share almost nothing, and it would couple two reducers that have no reason to change together.

---

## ADR-022 — Hash-based view routing, no router library

**Context.** The suite needs three views: Home, Wordwright and WordWeaver. Players expect Back, Forward and bookmarks to work (US-22). The app is hosted on GitHub Pages, which has no SPA fallback: a deep link to a path such as `/wordgames/weaver` returns a 404 because no such file exists.

**Decision.** Route on the URL hash: `#/`, `#/wordwright` and `#/weaver` (FR-62). A small `useRoute` hook reads `location.hash` through `useSyncExternalStore`, subscribed to `hashchange`. An empty or unknown hash renders Home and is corrected with `history.replaceState`, so no extra history entry is added (EC-22). On a view change, focus moves to the new view's `<h1>` (A11Y-15).

**Consequences.**

- No new runtime dependency (NFR-10). The router is a route parser and one hook.
- Deep links and bookmarks work on any static host, including GitHub Pages, with no server config.
- Back and Forward are plain browser behaviour.
- Hash URLs look a little less tidy than path URLs. Accepted for a static suite with three views.
- The hash is used for routing only. A later feature that needs URL parameters (for example seeded games) uses the query string (ARCHITECTURE §12).

**Alternatives.** (a) `react-router`. Rejected: a runtime dependency (NFR-10) for three fixed views. (b) History API paths plus a `404.html` that redirects into the app. Rejected: a known GitHub Pages workaround, but it adds a redirect hop, behaves differently on other hosts and is awkward to test. (c) Keep the current view in React state. Rejected: Back would leave the app, and deep links would not exist.

---

## ADR-023 — Rename to wordgames and import the legacy namespace

**Context.** "Wordwright" was the project name and is now the name of one game in the suite. The suite is renamed **wordgames** (FR-61): package name, page title and the GitHub Pages base path `/wordgames/`. Existing players have data under `wordwright:v1:{settings,stats,session,meta}` (`src/storage/keys.ts`). G9 says the rename must cost them nothing (US-23, AC-27).

The storage layer has a migration chain (`src/storage/migrations.ts`, `CURRENT_SCHEMA_VERSION = 1`), but no repository passes a `migrate` option to `createRepository`. The chain is not wired in anywhere today, and it works on one key's value, not on moving data between keys. It cannot carry this change.

**Decision.** A one-time legacy import runs as a boot step in `src/main.tsx`, before the first render (FR-69):

- It runs only if `wordgames:v1:meta` is absent and at least one `wordwright:v1:*` key exists.
- It **copies** and never moves. `wordwright:v1:settings` is split into the shared settings and Wordwright `prefs` (ADR-024). `stats`, `session` and `meta` are copied as-is to `wordgames:v1:wordwright:*`.
- The marker `wordgames:v1:meta` is written **last**, so an interrupted import runs again on the next load.
- Legacy keys stay in place for this release (NFR-17). The import never throws. On any failure the app continues with defaults.
- The inline theme script in `index.html` reads `wordgames:v1:settings` and falls back to `wordwright:v1:settings`, so the first load after the rename has no theme flash (FR-70).
- Old and new builds are served from the same origin (`<owner>.github.io`), so localStorage carries over when the path changes.
- A redirect stub stays at the old Pages path and forwards `/wordwright/` to `/wordgames/` (EC-37, T-73).

**Consequences.**

- Returning players keep stats, streaks, settings and an in-progress game (AC-27).
- Nothing is deleted, so a rollback to the old build still finds its data. A later release can remove legacy keys.
- An old tab still running the previous build may keep writing `wordwright:*` keys. The marker means the import never runs again, so the new keys win (EC-25).
- A corrupt legacy value is copied as-is. The normal read path then resets that slice with one toast (EC-26), so the import needs no validation of its own.
- If storage is unavailable at boot, the import is skipped and the app runs in memory (EC-27).
- **Reset data** on the error screen clears both namespaces (FR-71).

**Alternatives.** (a) Keep the `wordwright:` namespace for the whole suite. Rejected: the keys would be misnamed for good, and WordWeaver data would live under another game's name. (b) A read-through fallback in every repository (read the new key, else the old one). Rejected: it spreads rename logic across every repository permanently, instead of one boot step. (c) Move the data and delete the legacy keys. Rejected: an interrupted move can lose data, and it blocks rollback.

---

## ADR-024 — Shared appearance settings; per-game prefs and stats

**Context.** Today `Settings` is `{ theme, colorblind, motion, defaultWordLength }` under one key, and stats and the session are single records. In a suite, theme, colourblind mode and motion should apply everywhere, including Home. Word length means different things per game: Wordwright offers 4, 5 and 6, WordWeaver offers 4 and 5 (FR-74). Statistics have a different shape in each game.

ADR-020 describes a trap in the current storage code. `validateSettings` is all-or-nothing, and `createRepository.read()` treats a `null` validation result as corrupt: it returns defaults and raises the reset toast (EC-12). Changing the settings shape at the same key would wipe every player's settings on upgrade.

**Decision.**

- Shared settings shrink to `{ theme, colorblind, motion }` at `wordgames:v1:settings` (FR-67, FR-68).
- `defaultWordLength` moves to per-game `prefs`: `wordgames:v1:wordwright:prefs` and `wordgames:v1:weaver:prefs`.
- Stats, session and meta are per game, under `wordgames:v1:<game>:*`.
- **Reset statistics** and **Reset history** act only on the game the player is in (FR-67, AC-38).
- The split happens inside the legacy import (ADR-023). Every new key is first written in its new shape, by the import or by the app, so no validator ever meets an old-shaped record at its own key. This avoids the trap without making any validator tolerant.

**Consequences.**

- Appearance is set once and applies to Home and both games.
- Each game's stats and resets are independent. Two tabs on different games do not fight over keys (EC-28).
- `SettingsProvider` holds appearance only and can sit above the routed views. Per-game prefs live with each game's providers.
- The settings and stats repositories are module-level singletons today. They become per-game repository factories (T-51).
- There are no cross-game statistics. That is a Suite V1 non-goal (SPEC §3).

**Alternatives.** (a) One settings record with a map of per-game lengths. Rejected: it changes the shape at an existing key, which is the reset trap above. (b) Fully per-game settings, including theme. Rejected: Home would have no theme of its own, and players would set dark mode twice. (c) Make `validateSettings` tolerant of missing and extra fields. Possible, but the import already gives a clean cut-over at no extra cost.

---

## ADR-025 — WordWeaver puzzles generated on device over a common-word ladder list

**Context.** A WordWeaver puzzle is a start word, an end word and a known **par**, the length of the shortest ladder between them (FR-76, FR-77). Par has to be computed somewhere, and it has to feel fair. Three measurements shaped the decision:

- Over the full guess list, obscure words make par unfair. `EAST → WEST` has par 2 there, through `WAST`, a word few players know.
- The answer list alone (700 words per length) is too sparse to serve as the graph. Only **0.1%** of in-band 5-letter pairs have an optimal ladder made entirely of answer words, against **4.7%** for 4 letters.
- Searching on the device is cheap. On desktop Node over the full guess list: 4 letters, graph build **7 ms** and BFS about **6 ms**; 5 letters, build **45 ms** and BFS about **16 ms**. Over that list the 5-letter median par is about 8, and **9.1%** of 5-letter answer pairs are unreachable (SPEC §15.1 table).

**Decision.**

- Add a third list per length, the **ladder list**: common words ranked by the same frequency data as the answer list (1,400 for 4 letters and 5,000 for 5 letters, fixed by the T-58 measurement). It is a superset of the answer list and a subset of the guess list (FR-75). `scripts/build-dictionaries.mjs` emits it as a third export of `src/dictionary/data/lists-4.ts` and `lists-5.ts`.
- Build the ladder graph at runtime with wildcard buckets. Each word is filed under one pattern per position (`C_LD`, `CO_D`, …), and words that share a bucket are neighbours. The graph is cached per length.
- Start and end words come from the answer list. Par is the BFS distance over the ladder graph (FR-76).
- Generation follows FR-78: a random start that skips the last 20 starts, one BFS, an end picked from those inside `PAR_BAND`, up to 20 starts tried, then any reachable end at distance ≥ 3, then a Retry panel (EC-32).
- `PAR_BAND` is set by measurement: 4–6 for 4 letters and 4–7 for 5 letters. The ladder-list size is the smallest frequency cut where at least 90% of answer starts have one or more in-band ends. 4 letters meets that at 1,400 words. 5 letters never does within the 15 KB budget: 5,000 words reach 74.9%, and even the full guess list reaches only 93.4%. FR-78's 20 start attempts make that sufficient. The measurement is repeated whenever the lists are regenerated (FR-77).
- Players may type any guess-list word as a rung, so a player who knows a rare word can finish under par (FR-84).

**Consequences.**

- No new data chunk and no network. The ladder list rides in the existing `lists-4` and `lists-5` chunks, within 15 KB gzipped each (NFR-14).
- Par reflects ladders made of everyday words. Under-par results can happen and are shown as such ("Under par by n!", AC-44).
- The first puzzle costs one graph build plus one BFS. NFR-13 sets the budget (≤ 400 ms p95 for 5 letters under mobile CPU throttling). If that is missed, generation moves to a Web Worker with no new dependency.
- Generation is deterministic under `seededRandom`, so tests can pin puzzles (AC-36). A later daily mode would be a seed, not new rules.
- The engine stays pure. The graph is built from word arrays passed in as data (ADR-003, NFR-16).

**Alternatives.** (a) Par over the full guess list. Rejected: obscure-word par, as in the `WAST` example. (b) An answers-only graph. Rejected: too sparse, per the numbers above. (c) A precomputed list of puzzle pairs, or a precomputed adjacency chunk. Rejected: it adds a build artefact and download size to save tens of milliseconds, and a fixed pair list would repeat. (d) A hand-curated puzzle list. Rejected: finite, and it needs ongoing curation.

---

## ADR-026 — WordWeaver rules: positional feedback, no rung limit, typed end word, undo counts

**Context.** Word-ladder games vary in their rules. We needed one rule set that is easy to explain in the help dialog, fair to score against par, and simple to model in a reducer (SPEC §15).

**Decision.**

- **Feedback** is positional only. A letter is green when it matches the end word in the same position, otherwise grey (FR-81). There is no yellow.
- **No rung limit and no lost state.** A safety cap disables rung input at 500 moves. Give up and New puzzle still work (FR-85, EC-34).
- **The player types the end word** to finish. It must pass the same checks as any rung, so it can only be entered from a neighbour (FR-82). There is no auto-complete.
- **Undo counts.** `moves` counts every accepted rung, including rungs later undone. Undo itself is not a move (FR-83, FR-84).
- **Give up** is the only ending other than a solve. It reveals one optimal ladder and resets the streak (FR-86, FR-92).

**Consequences.**

- The help dialog can explain the game in a few short sentences (FR-95).
- `moves` against par is a single honest number. Undo cannot be used to explore for free.
- With no lost state, giving up is the only way to break a streak. Abandoning a puzzle (New puzzle, length change) is not recorded (FR-92).
- The reducer has two end states, `solved` and `gave-up`, and needs no guess counter beyond the safety cap.

**Alternatives.** (a) Wordle-style yellow. Rejected: the end word is always visible, so "this letter is somewhere in the target" adds noise, not information. (b) Auto-complete when the ladder is one step from the end. Rejected: it hides the final step, and typing the winning word is part of the payoff. (c) A hard rung cap with a loss. Rejected: a ladder puzzle is about finding a path, and a cap punishes exploration that the move count already charges for. (d) Free undo. Rejected: moves would stop meaning anything, and par hits would be trivial.

---

## ADR-027 — Enter starts the next game from the result screen

**Context.** Desktop players finish a game with Enter and expect Enter to start the next one (US-24). Today Enter does nothing on Wordwright's result panel: `GameView` includes `isGameOver` in `inputLocked`, which detaches `usePhysicalKeyboard` (`src/components/game/GameView.tsx`). The risk in fixing it is one keypress doing two things: the Enter that submits the winning guess must not also start a new game.

**Decision.** Add a separate hook, `src/hooks/useEnterToContinue.ts`, used by both games' result panels (FR-72, FR-73):

- It attaches its `keydown` listener when the result panel mounts. The panel mounts only after the final reveal completes, so the submitting keypress has already been handled.
- It ignores `event.repeat`, any modifier key, keypresses while a dialog is open, and keypresses while focus is on a button, link or text field. Those controls keep their own Enter behaviour, so nothing fires twice (EC-35, EC-36).
- It never moves focus. **Play again** is not autofocused (A11Y-18).
- `usePhysicalKeyboard` is unchanged.

**Consequences.**

- Enter to continue behaves the same in both games and is testable on its own.
- Holding Enter through the final submission does not skip the result (EC-35, AC-28, AC-29).
- With no autofocus, a held Enter cannot repeat-click a focused **Play again** button, and screen-reader users are not moved without warning.

**Alternatives.** (a) Autofocus **Play again**. Rejected: a held or repeated Enter would click it, and moving focus on a result disorients screen-reader users. (b) Add a game-over branch to `usePhysicalKeyboard`. Rejected: it mixes typing and navigation in one listener, and the same-keypress race would need timing guards instead of a mount boundary. (c) No Enter shortcut. Rejected: it is the most common desktop expectation and it is missing today.

---

## ADR-028 — Static game catalogue

**Context.** ADR-021 named the games in a closed `GameId` union and picked a view with a `switch`, and said to revisit that at a third game. WordStack is the third game, and three more follow it (SPEC §14.4, §17–§20). With six games the switch would have six cases in each of Home, the route parser and the page-title code, and each new game would touch all three. Every game view would also be imported eagerly into the entry bundle, which NFR-20 rules out.

**Decision.** Replace the switch with one static, read-only, ordered array in `src/shell/catalogue.ts` (FR-97):

```ts
interface CatalogueEntry {
  readonly id: GameId;
  readonly name: string; // "WordStack"
  readonly description: string; // one line, shown on the Home card
  readonly route: string; // "#/stack"
  readonly View: React.LazyExoticComponent<React.ComponentType>; // React.lazy(() => import(…))
}
export const GAMES: readonly CatalogueEntry[] = [/* in Home order */];
```

- Home renders one card per entry, in array order. The route parser looks a hash up in the array, and an unknown hash goes Home (EC-22). Page titles and the header `<h1>` come from `name` (FR-66, FR-98).
- Each `View` is loaded with `React.lazy`, so a game's code downloads only when its route opens (NFR-20).
- Each `View` mounts its own providers. The shell never sees a game's state.
- A game enters the array in the release that ships it (FR-97). `GameId` stays an explicit union, widened when work on a game starts, so its storage keys and tests can exist before it has a route.
- Storage keys come from one builder, `wordgames:v1:<gameId>:{prefs,stats,session,meta}` (FR-99).

This is not a plugin system. There is no runtime registration and no shared interface for engines, reducers, providers, storage or statistics. Each game keeps its own of each, as ADR-021 says. The catalogue holds only what the shell needs to list, route to and title a game.

**Consequences.**

- Adding a game is one catalogue entry plus the game's own folders. Home, routing and titles need no edit.
- TypeScript no longer flags a missed `switch` case. A unit test checks that ids and routes are unique and that every entry has a name, description and route.
- The entry bundle holds the shell, Home and the catalogue, but no game code. It stays within NFR-1 as games are added (NFR-20).
- Opening a game shows a short loading fallback while its chunk loads. The header `<h1>` and title render from the catalogue straight away, so focus can move to the `<h1>` on route change as before (A11Y-15).
- Wordwright and WordWeaver move onto the catalogue in T-74 with no behaviour change.

**Alternatives.** (a) Keep growing the switch. Rejected: six cases in three places, and every game imported eagerly. (b) A full plugin or strategy interface, with each game supplying its reducer, stats shape and storage through a common contract. Rejected: ADR-005 bans it, and the four new games share too little state shape for one contract to fit without becoming generic. (c) A catalogue with eager imports. Rejected: the entry bundle would grow with every game (NFR-1, NFR-20).

---

## ADR-029 — WordStack: one game, Duo and Quad modes

**Context.** Multi-board Wordle comes in several sizes: two boards (Dordle), four (Quordle), eight (Octordle) and sixteen (Sedecordle). We wanted one multi-board game that fits a phone, reuses the Wordwright engine, and is simple to explain (SPEC §17).

**Decision.**

- One game, **WordStack**, with two modes: **Duo** (2 boards, 7 guesses) and **Quad** (4 boards, 9 guesses). Duo is the default and the mode preference persists (FR-102).
- Words are 5 letters only.
- One no-repeat ring buffer for WordStack, shared by both modes, and all answers in a game are different (FR-103, EC-41).
- Each board scores the shared guess with `evaluateGuess` (`src/engine/evaluate.ts`), so duplicate-letter handling is the §6.3 algorithm (FR-105). Boards reuse `Board` and `Tile`.
- Each keyboard key is split into one segment per board, each showing that board's state (FR-109). A new `SplitKey` component does this; Wordwright's `Key` is unchanged.
- No numeric score. A result is won or lost, with guesses used and boards solved (FR-110).

**Consequences.**

- The engine is a thin layer over existing functions: `evaluateGuess` per board, `validateGuess`, `deriveKeyStates` per board and `pickAnswer`. Most of the new code is layout and the split keyboard.
- Statistics are kept per mode, and the guess distribution has a different bucket range for each (2–7 and 4–9, FR-111).
- A Quad guess runs four evaluations and starts four row reveals at once. NFR-21 holds that to the 16 ms render budget.
- With 5 letters only, there is no length selector. The header selector is the mode (FR-101).

**Alternatives.** (a) Separate Dordle and Quordle games. Rejected: two catalogue entries, two engines and two stats screens for what is one rule with a different board count. (b) 8 or 16 boards. Rejected: they do not fit a phone screen with the keyboard (Appendix A). (c) Lengths 4 and 6 as well. Rejected: each length needs its own guess limit balanced per mode, for little gain. (d) Show one board at a time with tabs to switch. Rejected: the game is about reading all boards together, and tabs hide that.

---

## ADR-030 — WordRange: alphabetical range with heat by list distance

**Context.** A Hot & Cold style game is a natural fit for the suite. The well-known versions (hotandcold.app, Semantle) rank guesses by meaning, which needs word embeddings: tens of megabytes of vectors or a server. That conflicts with NFR-1, NFR-5 and NFR-10. An alphabetical version (Betweenle, Alphaguess) needs only the sorted word list we already ship (SPEC §18).

**Decision.**

- Words are 5 letters. The secret comes from the answer list with its own ring buffer (FR-115).
- **14 guesses.** The 5-letter guess list has 13,746 words and log2(13,746) ≈ 13.7, so a player who halves the range every time always finds the word (FR-115).
- The range starts at two sentinels, `AAAAA` and `ZZZZZ`, which are not words. Each guess narrows it (FR-116).
- A guess before the lower bound or after the upper bound is rejected with `Outside the range` and costs nothing. Checks run in FR-117 order, so a guess equal to a bound, which is always an earlier guess, gets `Already guessed` first (EC-42, EC-43).
- **Heat** is the distance between guess and secret, counted in positions in the sorted 5-letter guess list, in five fixed bands from Burning (1–20) to Freezing (over 2,000). Heat is always shown as a word (FR-120, A11Y-22).

**Consequences.**

- No new data. The guess list is already sorted and uppercase, so bounds compare as plain strings and heat is a difference of two indices (ARCHITECTURE §8.5).
- Heat is monotonic with the range. Any guess inside the range is closer to the secret than the bound on its side, so it is never colder than that bound, and heat and before/after never disagree.
- The heat bands are engine constants. They may need tuning after play-testing, which is a constant change, not a rule change.
- A player who halves the range carefully never loses. That is accepted: the challenge is reaching the word in fewer guesses, and the guess distribution records it.

**Alternatives.** (a) Meaning-based Hot & Cold. Rejected: needs embeddings, which breaks NFR-1, NFR-5 and NFR-10. (b) Unlimited guesses. Rejected: no tension, and no loss state to make a win feel earned. (c) Heat by letter-by-letter distance (how many leading letters match, or letter gaps). Rejected: it is not monotonic with the range, so a guess inside a tighter range could read colder than one outside it.

---

## ADR-031 — WordCode: bulls and cows from evaluateGuess

**Context.** Bulls & Cows (Mastermind with words) reports two counts per guess instead of tile colours: letters in the right place and letters in the word but elsewhere. The hard part is duplicate letters. A separate counting function would need its own truth table and could disagree with Wordwright (SPEC §19).

**Decision.**

- Bulls are the number of `correct` positions and cows the number of `present` positions in `evaluateGuess(guess, secret)` (FR-129). There is no second counting algorithm.
- Lengths 4, 5 and 6, default 5, with their own length preference. Every length allows **10 guesses** (FR-127).
- The secret may have repeated letters. It comes from the answer list with its own ring buffer.
- **Letter notes** are the player's own marks (unmarked, ruled out, in the word) set on the keyboard keys through a Type and Mark switch. The game never sets them. They are saved with the session (FR-132, FR-135).

**Consequences.**

- Duplicate-letter counts are proven by the existing §6.3 truth table. A WordCode test only needs to check the counting step.
- With no tile colours, the board needs a different row component: neutral tiles plus the counts as text (FR-131).
- Notes add one field to the session. A restore with notes missing or unreadable falls back to no notes.
- One guess limit at every length mirrors ADR-010's choice for Wordwright. Lengths differ in difficulty, and the stats are kept per length.

**Alternatives.** (a) Jotto, which reports one count of shared letters. Rejected: harder to read and less fun, and bulls and cows give clearer feedback for the same deduction (Appendix A). (b) Secrets with distinct letters only. Rejected: it shrinks the answer pool, and players would learn to rule out repeats. (c) Notes that mark themselves from the counts. Rejected: that does the deduction for the player, which is the game.

---

## ADR-032 — WordShuffle: untimed, any valid anagram wins

**Context.** An unscramble game has three choices to make: which words count as a solve, whether there is a clock, and how much help to give. Many letter sets make several real words: `LISTEN`, `SILENT`, `ENLIST`, `INLETS`, `TINSEL` and `ELINTS` all use the same six letters (SPEC §20).

**Decision.**

- **Any guess-list anagram wins** if it uses exactly the tray letters and keeps every hinted letter in place, even when it is not the drawn target (FR-141, EC-47).
- The scramble is never the target and never itself a word. If no such ordering exists, another target is drawn (FR-138, EC-49).
- **Up to 2 hints.** Each fixes the leftmost unfixed letter of the drawn target in place. A hinted letter is placed and locked in the answer row and taken out of the tray. Typed and tapped letters fill the other positions left to right, and Backspace never removes a locked letter (FR-142).
- Because hinted letters are locked, the UI cannot submit an answer that moves one. The engine still rejects such an answer as a guard, with no toast (FR-140, EC-48).
- **Reshuffle** is free and unlimited (FR-143).
- **No timer and no guess limit.** Give up asks for confirmation, then shows the target and every other valid anagram (FR-137, FR-144).

**Consequences.**

- The engine needs an anagram lookup: words keyed by their sorted letters. The provider builds it once per length from the guess list and passes it in as data, like WordWeaver's ladder graph.
- Accepting any anagram makes the game fair. It also means the "other valid anagrams" list on the result panel can include rare guess-list words (for `LISTEN` it also contains `ELINTS`).
- With no timer and no limit, give up is the only non-solve ending, as in WordWeaver. Statistics count hints instead of time (FR-146).
- Hints follow the drawn target. When the player is heading for a different anagram, a hint steers them to the target instead. Accepted: hints are optional.
- Locking hinted letters in the row means there is no error message for a broken hint. The rule is enforced by the input model, and the engine guard only protects against a bad action or a hand-edited session.

**Alternatives.** (a) Only the drawn target wins. Rejected: rejecting `SILENT` because the target was `LISTEN` feels like a bug. (b) Timed rounds. Rejected: adds a timer and a scoring model, and a timed mode is listed as not planned (Appendix A). (c) A Waffle-style grid. Rejected: needs a crossword-grid generator and a swap interaction (Appendix A). (d) Unlimited hints. Rejected: the third or fourth hint gives the word away.

---

## ADR-033 — Reset actions live in each game's Statistics dialog

**Context.** Wordwright's **Reset statistics** and **Reset history** sat in a danger zone in the Settings dialog (FR-47). Settings is now shared by the whole suite (ADR-024) and is reachable from Home, where no game is mounted. Its provider tree has no `StatsProvider`, so it cannot reach any one game's statistics, and a reset button that silently chooses a game would break FR-67 ("resetting one game's statistics never touches the other").

**Decision.**

- The two reset actions move into each game's own Statistics dialog, through one shared `ResetStatsSection` that names exactly what will be deleted and confirms with the shared `ConfirmDialog` (FR-47).
- The Settings dialog keeps only the shared appearance controls and has no destructive action.
- The section stays visible when there is something to delete, including a recent-games log kept after **Reset statistics**, so **Reset history** is still reachable.
- `Modal` keeps a module-level stack of open dialogs so that Escape closes only the topmost, which is what lets a confirmation open over Statistics.

**Consequences.**

- A reset can only reach the data of the game whose dialog it is in. AC-38 and AC-56 are structural, not a matter of care.
- The reset moves from Settings to Statistics, one tap further from where a returning player might look. Accepted: the dialog that shows the numbers is where deleting them makes sense.
- Every later game gets the same section by passing a description of what its statistics contain.

**Alternatives.** (a) Keep a danger zone in Settings that resets the game last played. Rejected: ambiguous on Home. (b) One zone in Settings listing every game. Rejected: Settings would have to import every game's repositories, which ADR-021 forbids for the shell. (c) A "Reset all data" button. Rejected: it is the error screen's job (FR-71), and it deletes more than anyone asked.

---

## ADR-034 — Game controls reach the shell header through a portal slot

**Context.** The header frame belongs to the shell (FR-64): **All games**, the `<h1>`, the game's controls, then Settings. The controls (How to play, a length selector, Statistics, and for Wordwright **New game**) read the game's own context, which exists only below the shell. Putting the header in each view would repeat it six times and, from T-74, would delay the `<h1>` until a lazy chunk loads.

**Decision.**

- The shell renders the header once and hands its controls element to the views through `HeaderSlotContext`. A game view renders `<HeaderControls>…</HeaderControls>`, which `createPortal`s into that element.
- The controls render inside the header, in tab order after the `<h1>`, yet read the game's providers through React's tree.
- **New game** is a header control for Wordwright. FR-64 and FR-101 list How to play, a selector and Statistics, and an in-page button costs about 48 px of height, which pushed the keyboard off screen at 320 px wide and in short landscape. SPEC FR-64 now names it.
- Below the `sm` breakpoint a game header wraps to two rows (title row, then controls and Settings), so every control keeps a 44 px target at 320 px.

**Consequences.**

- The `<h1>`, the title and the focus target exist before any game code does, so a lazy game view (T-74) can fall back to a skeleton without losing the heading.
- A game's controls appear one commit after the header, because the slot element is set by a ref callback.
- The portal is an indirection to learn. It is contained in two small files, `headerSlot.ts` and `HeaderControls.tsx`.

**Alternatives.** (a) Each view renders its own header. Rejected: repeated markup, and it loses the heading during a lazy load. (b) A `controls` prop on the shell's header, with each game's controls lifted into the shell. Rejected: the shell would import every game's providers. (c) A registry the games write their controls into. Rejected: a plugin-style indirection that ADR-021 rules out.

---

## ADR-035 — New statistics fields read as zero in older saves

**Context.** Five of the six games saved no solve time, and each had little beyond played, win % and streaks. Adding a field is risky because every statistics validator rebuilds a bucket from a fixed list and returns null if one is missing. That discards the whole blob, so a player would lose their statistics on the first load after an update. The migration chain exists but no repository uses it, and the stored blobs carry no version of their own.

**Decision.**

- A field added to a statistics bucket is optional on read. A bucket saved without it reads as a neutral value: `0` for totals, `null` for a best or minimum, a zero array for a distribution. A field that is present but wrong still rejects the bucket.
- A field added to a game record is optional, and a malformed value is dropped rather than rejecting the row.
- Averages over a new field keep their own count (for example `timedSolves`), because wins saved before the field existed have no value. Dividing by `gamesWon` would skew the average.
- Where an existing count already implies the new figure, it is derived instead of stored. WordShuffle's solves by hints and WordStack's All-view chart are both worked out from existing counts, so they include games from before this change.
- The solve-time counters live in one module, `src/storage/timeStats.ts`, shared by the five games.
- The shared `Distribution` chart marks the row for the game just won, and `ViewSwitcher` replaces four copies of the same radio group.

**Consequences.**

- Nobody loses statistics on upgrade, and no `schemaVersion` or migration is needed.
- New figures start from zero for existing players. A time average or a chart fills in as they play, and shows `—` until then.
- Each new field needs three edits: the type and default, the validator, and the fold. Each also needs an "old blob still loads" test next to the existing storage tests.
- Stack and Weaver record time from the reducer's `finishedAt`, which a reload mid-reveal sets to the reload time. That solve can be a few seconds long, and is clamped by `clampDuration` like WordWright's.

**Alternatives.** (a) Store a `schemaVersion` in each blob and add migrations. Rejected: a bigger change that the existing path has never exercised, and the global version would bump for every game at once. (b) Reset statistics when a field is missing. Rejected: it throws away the player's history for a cosmetic addition.

---

## ADR-036 — WordWeaver: Backspace no longer undoes

**Context.** ADR-026 let Backspace on an empty row undo the last rung. Undo costs a move that is never refunded, and a player clearing a word often presses Backspace more times than there are letters. The extra presses removed a rung by accident and left the move on the counter.

**Decision.**

- Backspace removes typed letters only. On an empty row it does nothing.
- The **Undo** button is the only way to remove a rung.
- The move rules are unchanged: `moves` still counts every accepted rung, including undone ones (FR-84, AC-33).

**Consequences.**

- Holding or tapping Backspace can no longer cost a rung or leave a hidden move on the counter.
- Undo from a physical keyboard now needs the button. The help dialog says so.

**Alternatives.** (a) Keep the behaviour. Rejected: it caused the accidental undo. (b) Undo on Backspace, but not on key repeat. Rejected: a separate, deliberate press still undoes by accident, and the rule is harder to explain.

---

## ADR-037 — WordRange plays 4, 5 and 6 letters

**Context.** WordRange played 5 letters only, and the SPEC listed other lengths as out of scope. Every other game with a length picker offers 4, 5 and 6 (WordWright, WordCode), and the 4 and 6-letter lists already ship, so the data cost is zero. Two things were tuned to the 5-letter list: the 14-guess limit and the heat bands.

**Decision.**

- WordRange offers 4, 5 and 6 letters, with 5 the default. It uses the shared length selector, confirm-on-change flow, **Change length** button and All / length statistics switch that WordCode has.
- The guess limit is floor(log2 N) + 1 for each list: 13, 14 and 15 for 6,142, 13,746 and 24,637 words. Halving always wins, which is the premise ADR-030 set.
- The heat bands scale the 5-letter ones by list size over 13,746, so each band covers about the same share of its list. A shared set of absolute bands would make Freezing rare at 4 letters and the usual result at 6.
- The game's length is the length of its secret. `RangeState` and `RangeRecord` carry `wordLength`.
- Statistics are kept overall and per length, and the recent answers per length. Anything saved before this change reads as 5-letter data (ADR-035): a flat stats bucket becomes the 5-letter and overall buckets, with the overall distribution padded from 14 to 15 buckets. No schema version or migration is needed.

**Consequences.**

- Nobody loses statistics, a saved game or the no-repeat buffer on upgrade.
- The overall distribution has 15 buckets, so for a player who has only played 5 letters the last one stays empty.
- The worked example in the help dialog stays at 5 letters, because its distances come from the 5-letter list. The dialog says so.
- The heat bands for 4 and 6 letters are constants and can be tuned after play-testing, as ADR-030 allows for the 5-letter ones.

**Alternatives.** (a) One limit of 15 for every length. Rejected: it makes 4 and 5 letters easier than the data requires. (b) Absolute heat bands for every length. Rejected: the heat would read differently at each length. (c) Keep one flat statistics bucket and add a length field to each game. Rejected: win rate and streaks would mix lengths with different limits.

---

## ADR-038 — WordShuffle: rarer targets, no letter in place, a visible clock

**Context.** WordShuffle was too easy. Every target was one of the 700 most common words, the same pool as the answers of the other games. The scramble was a uniform random order, so on average one letter started where it belongs, and a 4-letter scramble was one swap from the answer 29% of the time. A reshuffle could put the tray back near the target's order, or onto a word. ADR-032 chose an untimed game, and SPEC §3 lists hard mode as a non-goal.

**Decision.**

- **Rarer targets.** The generator adds a `shuffle` list to each `lists-<n>.ts`: the 1,500 candidates ranked just below the answers, filtered like answers plus two shuffle-only rules. A hand-read `SHUFFLE_BLOCKLIST` drops names, foreign and archaic words, interjections, slang and crude or distressing words, because the pool reaches into a range full of them. A rule drops -ED and -ING forms whose stem is a word, because the ending gives the shape away. This leaves 712, 1,144 and 1,051 words at 4, 5 and 6 letters. The list shares no word with `answers`, and every word stays a valid guess and a valid anagram.
- **No letter in place.** Among the orders that are not a word, the first scramble keeps those with the fewest letters where the target has the same letter, and picks one at random. That is zero for nearly every word. A word with repeated letters, such as `AAB`, can force one, and then the fewest possible is used.
- **Reshuffle follows the same rule.** It never returns the current order, never a word, and keeps the fewest letters where the target has them, counting only the letters a hint has not locked.
- **A visible count-up clock.** It starts at the first letter and stops at the solve or give up. It shows `m:ss` while playing, and the result panel and the solve announcement give the time. It never ends a puzzle and is not a score. It reads the saved `startedAt`, so a game restored after leaving keeps counting, as the recorded solve time does.
- This is a change to the one game, not a difficulty setting. There is no toggle and no new mode.

**Consequences.**

- A saved game from before the change has an answer as its target. The restore check accepts the answers and the shuffle list, so nobody loses a game.
- Each lists chunk grows by its shuffle list. The 4-letter list has fewer candidates, so its pool is smaller.
- The shuffle list is hand-curated. A new word list or a regeneration needs the blocklist read again. The data tests check that it has no answer in it, that every word is a guess, and that a spot-check of offensive words is absent.
- Statistics are unchanged. They already held solve time and hints (ADR-035), so the new clock adds no field.
- A count-up clock adds pressure without a fail state. ADR-032's "no timer" is replaced by "no time limit". Appendix A's timed unscramble stays not planned, because it needs a limit and a score.
- WordShuffle's tests that pinned the first scramble moved to the new first scramble: ANLTP for PLANT and ELINST for LISTEN.

**Alternatives.** (a) A Normal / Hard toggle. Rejected: more work, a spec change for a hard mode, and statistics per mode, for a game that was simply too easy. (b) Only one answer per target. Rejected: it reverses ADR-032's "any valid anagram wins" for little gain. (c) One hint instead of two. Rejected: the other changes already raise the difficulty, and hints are optional. (d) A countdown timer. Rejected: it needs a loss state, a pause when the tab is hidden, and a change to streaks. (e) Several words a round. Rejected: new round state, session save and statistics, the largest change of the three. (f) Pick the pool by frequency rank only. Rejected: the range below the answers is full of names and slang, which the blocklist removes.

---

## ADR-039 — WordDodge: an adversary that never picks a word

**Context.** The suite has no game where the answer moves. Absurdle showed that a Wordle whose secret is undecided is a different puzzle: the player is not guessing a word but cutting down a set, and the game fights back. It needs the Wordle board, the keyboard, the scorer and the answer lists, all of which exist, so it is the cheapest new game.

**Decision.**

- **Candidates, not a secret.** A game starts with the answer list for the chosen length, 700 words, as its candidates. It never draws a word, so it has no ring buffer and no `meta` key.
- **Largest group wins.** Each accepted guess is scored against every candidate with `evaluateGuess`. The candidates are grouped by their colours, and the game answers with the largest group's colours and keeps that group. A tie in size goes to fewer hits (two for a green, one for a yellow), then to the smaller pattern string. This makes every answer a pure function of the candidates and the guess, so it can be tested exactly. With 700 candidates a guess costs at most 700 scores.
- **Won on the last word.** The reply is all green only when the guess is the only candidate left, because the all-green group has one word and loses any tie to a group with fewer hits. The game is won then. There is no guess limit.
- **Give up shows the first candidate.** In list order, with a count of the others, so the reveal is the same on every reload. A give up counts as a loss.
- **The save omits the candidates.** A session holds the guesses and their colours. A restore replays them against the answer list and drops the game if any reply differs, so a changed list can never leave a game that is unwinnable or that contradicts what the player saw.
- **The shared board.** WordDodge reuses `Board`, `Tile`, `Keyboard` and `useRevealTimeline` with its own state, and adds no new component. The board has a row per guess and scrolls.

**Consequences.**

- The game never ends by loss, only by a win or a give up. Its statistics have no loss streak and group wins by guesses used: five or fewer, one row each from 6 to 11, and 12 or more. A saved game has no guess cap as a rule. A storage guard of 1,000 guesses only keeps a corrupt blob from being huge.
- A reload during a reveal restores the game from before that guess, because a game is not saved while revealing. This avoids saving a result the player has not seen.
- The first guess is the most informative one. The candidates are only the 700 answers, though any guess-list word may be played, so the set is small enough to finish in a handful of guesses. The game is easier than Absurdle, which uses a list of over 2,000.
- No new word data, no new runtime dependency and no new chunk beyond the view (NFR-18, NFR-20).

**Alternatives.** (a) Use the whole guess list as candidates. Rejected: tens of thousands of words, obscure answers and a slow first guess. (b) A guess limit with a loss. Rejected: the game already pushes back, and a limit would make a hard puzzle punishing rather than interesting. (c) Pick a secret at the end. Rejected: this is the same as Wordle with a delayed draw, and gives no reason to explain the adversary. (d) Hard mode that forces every revealed hint to be used. Rejected for now: Wordwright has none (V2), and the game's pressure comes from the adversary.

---

## ADR-040 — WordHunt: find the common words hiding in six letters

**Context.** Spelling Bee and Wordscapes give a few letters and ask for every word that can be made from them. The suite already has the pieces: an anagram index and a tray in WordShuffle, and 4, 5 and 6-letter lists. It has no 3-letter list, so a puzzle can only hold 4 to 6 letter words, and the question is whether six letters hide enough of them.

**Decision.**

- **Six letters, no selector.** A puzzle is a 6-letter seed word. The tray is its letters in another order. There is no length choice and no per-length statistics, because five letters would hide too few 4 and 5-letter words, and seven would need a 7-letter list.
- **Required words are common words.** A word hides in the tray when it is spelled from the tray's letters, each used no more often than it appears. The required words are the hidden words in the answer list or the shuffle list for their length. Those lists are filtered for fairness, so a player is never asked to find a name, a slur or an obscure word.
- **Every other word is a bonus.** Any other guess-list word spelled from the tray is accepted and counted as a bonus word. It does not fill a slot and is never needed. This keeps the rare words a player knows from being rejected, without making them a requirement.
- **A good puzzle hides 8 to 20 required words.** The pool is every answer and shuffle word of 6 letters that does. Fewer is over too soon, and the richest seeds hide over 30, which is a chore. On the shipped lists that is 739 of 1,751 seeds. Each hides at least three 4-letter words and at least one 6-letter word, so every puzzle has slots at two or more lengths.
- **Worked out on the device.** The sub-multisets of the tray are found by choosing 4, 5 or 6 of its letters and looking up each sorted-letter key in the anagram index, 22 lookups for a tray of distinct letters. Scoring every seed takes a few tens of milliseconds, once, after the three lists load. No data is added.
- **The save carries the words.** A saved puzzle holds its required words, found words and bonus words. It restores whatever the lists now hold, and needs no replay.
- **No hints and no word-count limit.** A clock counts up as in WordShuffle (ADR-038). It does not end a puzzle.

**Consequences.**

- The view loads the 4, 5 and 6-letter lists together, about 150 KB gzipped on a first visit. They are the same chunks the other games load, and Home still makes no dictionary request (NFR-15).
- A found word shows as a word and an unfound slot as a blank, so the board needs no colour to carry meaning. Found slots use a green border and the normal text colour, because the green tile pair is below 4.5:1 for small text.
- Giving up shows the words missed in their slots and in the result.
- Statistics have no per-length view, and track the share of words found over all puzzles, which a partial result adds to.

**Alternatives.** (a) Add a 3-letter list for more words per puzzle. Rejected: new data, a hand read for offensive words, and bigger chunks, for words that are mostly obscure. (b) Seven letters with a required centre letter and repeats allowed, as Spelling Bee does. Rejected: it changes the game's shape and needs a 7-letter list. (c) Require every guess-list word. Rejected: it would ask for words nobody knows. (d) Pick puzzles at build time. Rejected: the same result for more files, and the pool depends on three lists that already load together. (e) A hint button. Rejected for now: the slots already show how many words are left at each length.

---

## ADR-041 — WordHang: Hangman with six misses, one letter at a time

**Context.** Hangman is the most familiar word game there is, and the suite has none where the player picks letters and not words. It needs no new data and no word lookup. The choices are how many misses to allow, whether the figure is drawn, and how much of the game to share with the Wordle games, whose keyboard and checks do not fit a one-key guess.

**Decision.**

- **Six misses at every length.** Head, body, two arms and two legs, as in the classic game. One limit for all lengths keeps the figure the same size and the rule easy to say. On the shipped lists, a player who knows the whole answer list wins at least half of the games they play at every length, and a player who tries letters in a fixed English frequency order and ignores what is revealed wins about one game in ten. The game rewards reading the pattern.
- **A drawn figure.** An inline SVG, in the text colour, adds one part per miss. It is decorative and hidden from assistive technology. The misses are also text ("2 of 6 misses"), the wrong letters are listed, and each guess is announced, so the figure carries nothing alone.
- **A letter is applied at once.** There is no Enter, no Backspace and no word to look up, so the engine takes only a letter and the clock, and there are no rejection toasts. A letter already tried is ignored and costs nothing, and its key is disabled.
- **Derived, not stored.** The state holds the secret and the letters tried, in order. The misses, the revealed letters and the key colours all follow from those, so a saved game cannot disagree with its own letters. A saved game whose status is not the one its letters give is discarded.
- **Its own keyboard.** The shared keyboard names a key "correct position" or "not in word" and has Enter and Backspace. WordHang's keyboard reuses the shared QWERTY layout, drops those two keys, names a tried key "in the word" or "not in the word", and adds a tick or a cross to the key as well as its colour.
- **The secret is an answer.** It comes from the answer list for the length, with a ring buffer per length, so it is always a common, fair word.
- **No give up and no hint.** A player who wants out starts a new game, which asks first if a letter has been tried. A clock runs from the first letter and is recorded for statistics, but it is not shown.

**Consequences.**

- A win is checked before a loss, so a letter that completes the word wins even after five misses. A win and a loss cannot happen on the same letter, because only a miss can lose and a miss never completes the word.
- Statistics group wins by misses (0 to 5) instead of guesses, and count wins with no miss. A loss ends the streak.
- The result panel replaces the keyboard when the game ends, so the result never pushes the keyboard off a small screen. The letter that ended the game cannot also start the next one, and Enter starts it (FR-73).
- No new data, no new dependency, and no change to the shared keyboard.

**Alternatives.** (a) Scale the misses by length, such as 7, 6 and 5. Rejected: the figure would need a different number of parts per length, and the measured win rates at the three lengths are close. (b) Show hearts or a counter and no drawing. Rejected: the figure is what makes the game Hangman. (c) Add a prop to the shared keyboard to hide Enter and Backspace. Rejected: its key names and its state labels are Wordle's, and a second set would be needed anyway. (d) A hint that reveals a letter. Rejected for now: it adds a rule and a statistic for a game that is already short. (e) Phrases, as some Hangman games use. Rejected: it needs a phrase list and spaces in the board.

---

## ADR-042 — WordDodge draws on the answer and shuffle lists

**Context.** ADR-039 started WordDodge with the 700 answers of the length. A player who picks a random word that is still possible needs 4.6 to 7.1 guesses on average, and one who picks well needs 4 to 5. That is easy, because 700 words fall to a handful after two or three guesses. Absurdle uses over 2,000.

**Decision.**

- **The pool is the answer list plus the shuffle list**, each word once and in alphabetical order. That is 1,412, 1,844 and 1,751 words at 4, 5 and 6 letters. Both lists are filtered for fairness and the shuffle list was read by hand (ADR-038), so every candidate is a word a player knows.
- **It is worked out when the dictionary loads.** `candidatePool(answers, shuffle)` is a pure engine function and the provider keeps the result for the session. A dictionary with no shuffle list, as a test fixture may, gives the answers alone.
- **Nothing else changes.** The adversary, the tie-break, the save format and the statistics are as in ADR-039. A guess still costs one score per candidate, at most 1,844, so there is no delay.

**Consequences.**

- Measured on the shipped lists, a random-pick player needs 6.0 to 7.6 guesses on average, up from 4.6 to 7.1, and a player who picks well needs 4 to 6, up from 4 to 5. The game is harder at every length, most at 5 and 6 letters.
- A game saved before the change was answered against 700 words. Replayed against the larger pool its first reply can differ, so it fails the replay check of FR-153 and is dropped. The player starts a new game. No statistic is lost, because only a finished game is recorded.
- The give up shows the first candidate in alphabetical order, as before. It is now a word from the larger pool, but still a fair one.
- The statistics chart groups wins as five or fewer, 6 to 11, and 12 or more. Typical games now fall in the middle rows, so the grouping still fits.
- No new data, no new chunk and no change to the other games.

**Alternatives.** (a) The whole guess list, 6,142 to 24,637 words. Rejected: it holds obscure and possibly offensive words, the last word can be one nobody could work out, and a give up could show it. (b) A new larger list of about 3,000 fair words per length. Rejected for now: it needs a new hand-read list and adds about 10 KB gzipped to each lists chunk. The answer and shuffle lists give a 2 to 2.6 times larger pool at no cost, and a larger list can follow if this is still too easy. (c) A Normal and a Hard pool. Rejected: more rules and statistics per mode, for a game that was simply too easy (as ADR-038 concluded for WordShuffle).
