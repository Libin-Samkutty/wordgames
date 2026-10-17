# wordgames — Implementation Roadmap

The project was previously named Wordwright. That name now belongs to the Wordle-style game inside the suite.

Ordered, phased backlog for Wordwright V1 (Phases 0–10), Suite V1 (Phases 11–14) and the game releases R2–R6 (Phases 15–19). Every task is **independently completable**: it has a clear deliverable, explicit acceptance, and can be shipped as one commit or PR without breaking `main`.

**Conventions**

- `T-xx` — task id, cited in commits (`feat(engine): add evaluateGuess (T-06)`).
- **Req** — the `SPEC.md` requirements the task satisfies.
- **DoD** — done when these are true, _in addition to_ the global bar: `npm run verify` passes, no console errors, docs updated if behaviour changed.
- Phases are sequential; tasks inside a phase are mostly parallelisable unless a dependency is noted.

**Progress:** 95 / 95 complete. Wordwright V1 (T-01 … T-49) is done, plus a full review pass (2026-07-26); see [`REVIEW.md`](./REVIEW.md). Suite V1 (T-50 … T-73) is built and verified in this environment; deployment and the redirect are owner steps (see the README). Releases R2–R5 (T-74 … T-91) follow Suite V1, one game per release: WordStack, WordRange, WordCode, then WordShuffle.

---

## Phase 0 — Project Setup (T-01 … T-05) ✅ COMPLETE

### ✅ T-01 · Scaffold the Vite + React + TypeScript project

Create the app with Vite's `react-ts` template. Enable `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, and the `@/*` path alias in `tsconfig` and `vite.config.ts`. Remove all template boilerplate (demo CSS, logos, counter).
**Req:** NFR-7 · **DoD:** `npm run dev` serves a blank shell; `npm run build` succeeds; no template assets remain.

### ✅ T-02 · Tailwind + design tokens

Install and configure Tailwind. Create `styles/index.css` with the semantic token set (`--color-tile-correct|present|absent`, `--color-key-*`, `--color-surface`, `--color-text`, `--color-border`, `--color-focus`) for three variants: light, `.dark`, and `[data-palette="cb"]`. Add `styles/animations.css` with keyframes (`flip`, `pop`, `shake`, `bounce`) and a reduced-motion override block.
**Req:** FR-43, FR-44, A11Y-7, A11Y-9 · **Depends:** T-01 · **DoD:** toggling the `dark` class and `data-palette` on `<html>` in devtools visibly re-themes a sample element; all token pairs pass AA contrast (record the ratios in the PR).

### ✅ T-03 · ESLint + Prettier

Flat ESLint config: `typescript-eslint` recommended-type-checked, `react-hooks`, `react-refresh`, `jsx-a11y`. Prettier with `prettier-plugin-tailwindcss`. Add a custom rule/override banning raw colour utilities in `src/components/**` (ADR-008) — an `eslint-plugin-no-restricted-syntax` pattern or a documented review rule if tooling proves awkward.
**Req:** NFR-7 · **Depends:** T-01 · **DoD:** `npm run lint` and `npm run format:check` pass clean on the scaffold.

### ✅ T-04 · Vitest + Testing Library

Configure Vitest with two projects/environments (node for `engine|lib|storage`, jsdom for components), `src/test/setup.ts` (jest-dom, `matchMedia` mock, `localStorage` mock), coverage thresholds (100% branches for `src/engine/**`, 85% statements overall), and `renderWithProviders`.
**Req:** NFR-8 · **Depends:** T-01 · **DoD:** a placeholder test passes in both environments; `npm run test:coverage` reports and enforces thresholds.

### ✅ T-05 · npm scripts, folder skeleton, app shell

Add every script from the README table including `verify`. Create the full empty folder tree from ARCHITECTURE §2 with barrel files. Add `index.html` (title, meta viewport, theme-flash-prevention inline script), `main.tsx`, and a minimal `App.tsx` rendering `header`/`main`/`footer` landmarks and one `h1`.
**Req:** A11Y-12, EC-17 · **Depends:** T-01…T-04 · **DoD:** `npm run verify` passes; the shell renders with correct landmarks; theme class is set before first paint (no flash on reload in dark mode).

---

### Phase 0 verification record (2026-07-26)

| Check            | Result                                                                                         |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| `npm run verify` | ✅ typecheck + lint + format:check + 5 tests, zero warnings                                    |
| `npm run build`  | ✅ 191 KB raw / **60.35 KB gzipped** entry bundle — NFR-1 budget is 200 KB gzipped             |
| `npm audit`      | ✅ 0 vulnerabilities (see ADR-016)                                                             |
| Dev server       | ✅ Vite 8 ready in 362 ms, HTTP 200, theme script inlined                                      |
| Test projects    | ✅ `unit` (node) and `ui` (jsdom) both execute                                                 |
| Coverage gate    | ✅ verified by probe: the `src/engine/**` 100% rule fails independently of the global 85% rule |
| Design tokens    | ✅ compile to `var(--color-*)`; light / `.dark` / `[data-palette="cb"]` all emitted            |
| Guard: ADR-003   | ✅ `import 'react'` inside `src/engine/**` → error                                             |
| Guard: ADR-009   | ✅ `Math.random()` / `Date.now()` inside `src/engine/**` → error                               |
| Guard: ADR-008   | ✅ `bg-green-500` inside `src/components/**` → error                                           |
| Guard: NFR-11    | ✅ `localStorage` outside `src/storage/**` → error                                             |

**Pinned toolchain:** React 19.2 · Vite 8.1 · TypeScript 6.0 · Tailwind 4.3 · Vitest 4.1 · ESLint 9.39 (see ADR-015 for why TS 6 and ESLint 9 rather than 7 and 10).

---

## Phase 1 — Dictionary Data (T-06 … T-08) ✅ COMPLETE

### ✅ T-06 · Source and generate word lists

Produce `answers-{4,5,6}` (≥ 300 each, common/solvable/no profanity/no proper nouns) and `guesses-{4,5,6}` (≥ 1500 each, superset of answers). Emit as TS modules of uppercase, sorted, deduplicated string arrays. Write `data/README.md` documenting source and licence.
**Req:** FR-25, FR-26, FR-27, FR-30, FR-31 · **DoD:** all six modules exist and satisfy the invariants; provenance documented.

### ✅ T-07 · Dictionary invariant tests

Test every list: `/^[A-Z]+$/`, exact length, unique, sorted, minimum size, `answers ⊆ guesses`.
**Req:** FR-26, FR-27, FR-30 · **Depends:** T-06 · **DoD:** the suite fails loudly if any invariant is violated (verify by temporarily corrupting a list).

### ✅ T-08 · Registry + lazy loader

Implement `registry.ts` (length → dynamic import), `loadDictionary.ts` with in-memory cache, in-flight promise dedup, `Set` construction, and a typed `DictionaryLoadError`.
**Req:** FR-17, FR-28, FR-29, EC-14 · **Depends:** T-06 · **DoD:** unit tests cover cache hit, concurrent-call dedup, and rejection mapping; `vite build` emits one chunk per length (verify in build output).

---

## Phase 2 — Game Engine (T-09 … T-17) ✅ COMPLETE · _test-first, no UI_

### ✅ T-09 · Engine types and constants

`types.ts` and `constants.ts` per ARCHITECTURE §3.1: `WORD_LENGTHS`, `MAX_GUESSES = 6`, `LetterState`, `TileState`, `Evaluation`, `Guess`, `GameStatus`, `GameState`, `GameError`, score weights.
**Req:** FR-1, FR-2 · **DoD:** compiles; no `any`; all state unions exhaustive.

### ✅ T-10 · `evaluateGuess`

Two-pass count-based algorithm, SPEC §6.3.
**Req:** FR-12, FR-13, EC-1 · **Depends:** T-09 · **DoD:** the full truth table passes as table-driven tests, plus property tests (result length invariant; identical guess ⇒ all correct; per-letter `correct+present ≤` count in answer); 100% branch coverage.

### ✅ T-11 · `validateGuess`

Returns `Result<string, 'too-short' | 'not-a-word'>`; uppercases input; takes an injected `isAllowed` predicate.
**Req:** FR-6, FR-14, FR-15, FR-16, FR-17 · **Depends:** T-09 · **DoD:** tests for short, unknown, valid, lowercase, and repeated-guess-allowed cases.

### ✅ T-12 · `deriveKeyStates`

Fold guesses into `Map<string, LetterState>` with `correct > present > absent` precedence; never downgrade.
**Req:** FR-53 · **Depends:** T-10 · **DoD:** tests prove a letter yellow-then-green becomes green and green-then-yellow stays green.

### ✅ T-13 · Randomness + answer picking

`RandomSource`, `systemRandom`, `seededRandom` (mulberry32), and `pickAnswer(pool, recentlyUsed, random)` with the no-repeat ring buffer and reset-on-exhaustion.
**Req:** FR-3, FR-4, EC-20 · **Depends:** T-09 · **DoD:** seeded source is reproducible; no repeat within the buffer window; exhaustion resets rather than throwing.

### ✅ T-14 · `scoreGame`

Implements FR-23 exactly (base, length multiplier, speed bonus, loss = 0).
**Req:** FR-23, FR-24 · **Depends:** T-09 · **DoD:** table tests for each guess count × length × representative solve times, plus the 0-score loss case and the `speedBonus` floor at 0.

### ✅ T-15 · `gameReducer`

All actions and transitions from ARCHITECTURE §3.2. Pure and total; returns the same reference for no-op actions; enforces input locking (FR-11) and the max-length cap (FR-7).
**Req:** FR-5, FR-7, FR-8, FR-9, FR-11, FR-18, FR-19, FR-22, EC-2, EC-3, EC-5, EC-8 · **Depends:** T-10, T-13 · **DoD:** state-machine tests for every transition, including illegal actions in each status; `startedAt` set exactly once on first letter; 100% branch coverage.

### ✅ T-16 · Selectors

`isGameOver`, `currentRowIndex`, `remainingGuesses`, `boardRows(state)` (6 rows of tile view-models), `guessesUsed`.
**Req:** FR-50, FR-51 · **Depends:** T-15 · **DoD:** `boardRows` returns a stable 6×n structure for empty, partial, and complete boards.

### ✅ T-17 · Engine barrel + coverage gate

`engine/index.ts` exports the public surface only. Verify no engine file imports React/DOM/storage (add a lint rule or an import-boundary test).
**Req:** NFR-8, ADR-003 · **Depends:** T-09…T-16 · **DoD:** engine branch coverage is 100%; the boundary test fails if a forbidden import is added.

---

### Phase 1 & 2 verification record (2026-07-26)

| Check                  | Result                                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `npm run verify`       | ✅ exit 0 — typecheck + lint + format + **238 tests**, zero warnings                                                     |
| Engine coverage        | ✅ **100% statements / branches / functions / lines** across every `src/engine` module                                   |
| Dictionary coverage    | ✅ 100% on `loadDictionary`, `registry`, `types`                                                                         |
| Code splitting         | ✅ verified by build probe: `lists-4` 10.66 KB, `lists-5` 24.59 KB, `lists-6` 45.77 KB gzipped, as three separate chunks |
| Entry bundle           | ✅ 61 KB gzipped with a dictionary imported — NFR-1 budget is 200 KB                                                     |
| Engine purity          | ✅ `boundaries.test.ts` (24 assertions) greps every engine file for React/DOM/storage/`Date.now`/`Math.random`           |
| Evaluation truth table | ✅ all 10 SPEC §6.3 rows pass, plus 4 property tests                                                                     |

**Word lists generated** by `scripts/build-dictionaries.mjs` from ENABLE1 (public domain), ranked by Google Trillion Word Corpus frequency:

| Length | Answers | Guesses |
| ------ | ------- | ------- |
| 4      | 700     | 3,903   |
| 5      | 700     | 8,636   |
| 6      | 700     | 15,232  |

Answer pools are filtered for plurals, two-distinct-letter words, offensive terms, proper-noun readings, and clipped forms — see `src/dictionary/data/README.md`. All filtered words remain valid _guesses_ (ADR-004).

**Note on `v8 ignore` comments:** four defensive branches in the engine are unreachable by construction (the reducer's exhaustiveness `default`, and three `??` fallbacks that exist only to satisfy `noUncheckedIndexedAccess`). Each carries a comment explaining why, rather than an artificial test. The 100% figure is honest, not gamed.

---

## Phase 3 — Storage Layer (T-18 … T-22) ✅ COMPLETE

### ✅ T-18 · `safeStorage`

Availability probe with try/catch, in-memory `Map` fallback, exported `isPersistent` flag.
**Req:** EC-11, NFR-12 · **DoD:** tests simulate a throwing `localStorage` and assert the fallback keeps working.

### ✅ T-19 · `createRepository` + schemas

Generic typed repository (`read`/`write`/`clear`/`subscribe`) with runtime validation guards and defaults-on-failure. Cross-tab `storage` event subscription.
**Req:** FR-42, EC-12, EC-16, NFR-11, NFR-12 · **Depends:** T-18 · **DoD:** tests cover valid read, corrupt JSON, wrong shape, quota throw on write, and a cross-tab event firing subscribers.

### ✅ T-20 · Migration chain

`meta.schemaVersion`, ordered migration map, newer-version-resets-to-defaults behaviour.
**Req:** EC-13 · **Depends:** T-19 · **DoD:** tests run a synthetic v0 → v1 migration and the newer-version reset path.

### ✅ T-21 · Settings repository

`Settings { theme, colorblind, motion, defaultWordLength }` with defaults `system / false / system / 5`.
**Req:** FR-43…FR-46, FR-48 · **Depends:** T-19 · **DoD:** round-trip and default-fallback tests pass.

### ✅ T-22 · Stats & session repositories

`StatsState` (aggregate + `perLength` + `recentGames` capped at 50) with an idempotent `recordGame` reducer keyed by game id; `sessionRepository` for the in-progress `GameState` with debounced writes and a `visibilitychange`/`pagehide` flush, discarding mismatched or stale sessions on read.
**Req:** FR-20, FR-32, FR-33, FR-35…FR-39, FR-42, EC-9, EC-10 · **Depends:** T-19 · **DoD:** unit tests for streak increment/reset, distribution buckets, averages, fastest solve, the 50-item cap, double-record idempotency, and session restore/discard.

---

## Phase 4 — Providers & Wiring (T-23 … T-26) ✅ COMPLETE

### ✅ T-23 · SettingsProvider + `useTheme`

Applies `dark` class and `data-palette` / `data-motion` attributes; live `matchMedia` subscription for `system`.
**Req:** FR-43, FR-44, FR-45, FR-48, EC-17 · **Depends:** T-21 · **DoD:** integration test flips the mocked media query and asserts the class updates without reload.

### ✅ T-24 · ToastProvider

Queue capped at 3, auto-dismiss 2 s (errors 3 s), manual dismiss, polite + assertive live regions.
**Req:** FR-55, A11Y-4 · **DoD:** fake-timer tests for auto-dismiss, cap/eviction, and severity → live-region routing.

### ✅ T-25 · StatsProvider

Wraps the stats repository; exposes `stats` and `recordGame`; guarantees single-record-per-game.
**Req:** FR-20, FR-35…FR-39 · **Depends:** T-22 · **DoD:** recording the same game id twice changes nothing.

### ✅ T-26 · GameProvider

`useReducer(gameReducer)` + dictionary loading (status `loading`/`error`/`playing`) + validation guard + session persistence + stats recording on completion + announcements. Exposes `{ state, boardRows, keyStates, addLetter, removeLetter, submitGuess, restart, setWordLength, retryDictionary }`.
**Req:** FR-10, FR-11, FR-18…FR-21, FR-32, FR-33, FR-34, FR-56, EC-14, EC-15, NFR-11 · **Depends:** T-08, T-17, T-24, T-25 · **DoD:** integration tests with a fixture dictionary cover win, loss, invalid word, short guess, restore, and dictionary failure + retry.

---

## Phase 5 — Core UI (T-27 … T-34) ✅ COMPLETE

### ✅ T-27 · `Tile`

Memoised; renders `empty | filled | correct | present | absent`; flip animation with per-tile delay; colour applied at flip midpoint; colourblind marker; full `aria-label`.
**Req:** FR-51, FR-52, A11Y-2, A11Y-8 · **Depends:** T-02, T-16 · **DoD:** component tests assert accessible name per state; reduced motion renders the final state with no animation.

### ✅ T-28 · `Row` + `Board`

`role="grid"`/`row"`/`gridcell"` structure, always 6 rows, shake animation on invalid submit, responsive `clamp()` sizing.
**Req:** FR-50, FR-59, A11Y-2, EC-18 · **Depends:** T-27 · **DoD:** grid semantics assertions pass; board renders correctly for all three lengths at 320 px.

### ✅ T-29 · On-screen `Keyboard`

Three QWERTY rows, Enter/Backspace with `aria-label`s, state colours derived from `deriveKeyStates`, press animation, ≥ 44 px targets.
**Req:** FR-10, FR-53, FR-54, FR-58, A11Y-10 · **Depends:** T-12, T-26 · **DoD:** clicking keys drives the board; key colours update only after the row reveal completes.

### ✅ T-30 · `usePhysicalKeyboard`

Window listener; A–Z, Enter, Backspace/Delete; ignores modifier combos, non-alpha keys, and events while a modal is open or input is locked.
**Req:** FR-6, FR-9, FR-10, FR-11, EC-3, EC-4, EC-5, EC-7 · **Depends:** T-26 · **DoD:** tests assert `Ctrl+R` is not intercepted and typing during a reveal is ignored.

### ✅ T-31 · `useRevealTimeline`

Staggered reveal (250 ms), completion callback dispatching `REVEAL_COMPLETE`, stagger collapsed to 0 under reduced motion, cleanup on unmount/restart.
**Req:** FR-52, A11Y-9 · **Depends:** T-26 · **DoD:** fake-timer tests verify ordering, total duration, instant mode, and no post-unmount dispatch.

### ✅ T-32 · Loading, error, and skeleton states

`BoardSkeleton` with accessible "Loading dictionary…" text; `DictionaryError` panel with a working Retry.
**Req:** FR-56, EC-14 · **Depends:** T-26 · **DoD:** both states are reachable in tests; input is disabled while loading.

### ✅ T-33 · `ResultPanel`

Shows win/loss, the answer on loss, guesses used, solve time, score; **Play again** and **Change length**; announced to screen readers; appears only after the reveal finishes.
**Req:** FR-18, FR-19, FR-21, A11Y-5 · **Depends:** T-31 · **DoD:** appears post-reveal; **Play again** yields a different answer (AC-8).

### ✅ T-34 · `Header` + `LengthSelector`

Accessible radio group for 4/5/6, stats and settings buttons with labels, confirmation dialog when switching length mid-game with guesses made.
**Req:** FR-34, FR-49, EC-15, AC-10 · **Depends:** T-26, T-36 · **DoD:** confirmation appears only when ≥ 1 guess exists; cancelling preserves the game.

---

## Phase 6 — Statistics & Settings UI (T-35 … T-39) ✅ COMPLETE

### ✅ T-35 · `Modal` + `useFocusTrap` + `ConfirmDialog`

Portal, `role="dialog" aria-modal="true"`, labelled heading, focus trap, `Esc`/backdrop close, focus restoration; `ConfirmDialog` built on it.
**Req:** FR-57, A11Y-11, EC-7 · **DoD:** keyboard-only test: open → Tab cycles inside → `Esc` closes → focus returns to the trigger.

### ✅ T-36 · `StatsModal`

All FR-35 metrics, distribution bars with the current game highlighted, recent games list, per-length view, empty state.
**Req:** FR-35…FR-41 · **Depends:** T-25, T-35 · **DoD:** with fixture stats, every displayed value matches a hand-computed expectation (AC-11); 0-games shows the empty state, never `NaN`.

### ✅ T-37 · `SettingsModal`

Theme radio group, colourblind toggle, motion toggle, default-length preference, danger zone.
**Req:** FR-43…FR-46, FR-48 · **Depends:** T-23, T-35 · **DoD:** every control persists and applies immediately.

### ✅ T-38 · Danger zone — reset statistics / reset history

Two separate destructive actions, each behind a confirmation naming exactly what is deleted.
**Req:** FR-47, AC-12 · **Depends:** T-36, T-37 · **DoD:** resetting stats leaves settings and the active game untouched; resetting history clears only recent games.

### ✅ T-39 · `ErrorBoundary`

Full-screen recovery UI with **Reload** and **Reset data**; no stack traces shown to the user.
**Req:** EC-21 · **DoD:** a test child that throws renders the recovery UI; **Reset data** clears all namespaced keys.

---

### Phase 3–6 verification record (2026-07-26)

| Check             | Result                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| `npm run verify`  | ✅ exit 0 — **336 tests**, zero errors, zero warnings; three consecutive clean runs                    |
| Production build  | ✅ entry **72 KB gzipped** (NFR-1 budget 200 KB), dictionaries still split per length                  |
| Integration suite | ✅ 23 flows driven entirely through accessible queries (`getByRole` / `getByLabelText`)                |
| Storage           | ✅ 69 tests: corrupt JSON, wrong shape, quota throw, unavailable storage, cross-tab events, migrations |

**Two real bugs found and fixed during this phase, both caught by tests rather than by reading:**

1. **`safeStorage` bound its backend at module load.** It captured whatever `localStorage` was at import time, so settings silently failed to load. In production this would also have broken any browser that revokes storage access mid-session. Now resolved lazily on first use, with `resetSafeStorage()` as a test seam.
2. **Every guess announcement was silently dropped (A11Y-3).** Two effects fought over the "already announced" counter; the reset effect depended on `guesses.length`, so it ran on every guess and marked it announced before the announcing effect saw it. Screen-reader users would have received no feedback at all. Fixed by keying the counter on game id, and guarded by a regression test that was verified to fail against the old code.

A third issue — a flaky assertion on the win announcement — was traced to the result panel and the live region being written by separate effects; the test now waits rather than assuming a single commit.

---

## Phase 7 — Accessibility Pass (T-40 … T-43) ✅ COMPLETE

### ✅ T-40 · Announcements

`useAnnouncer` + polite region for per-guess results and game end; assertive region for errors; exactly one announcement per event.
**Req:** A11Y-3, A11Y-4, A11Y-5, AC-16 · **Depends:** T-26, T-31 · **DoD:** tests assert message text and that no duplicate announcement fires.

### ✅ T-41 · Focus management & tab order

Audit every interactive element: visible `:focus-visible` ring, logical order, no traps outside modals, skip-to-content if needed.
**Req:** A11Y-1, A11Y-6, AC-17 · **DoD:** a full keyboard-only play-through and settings change with no mouse.

### ✅ T-42 · Contrast & colourblind verification

Measure every text/background and tile pair in light, dark, and colourblind palettes; document ratios; add non-colour markers.
**Req:** A11Y-7, A11Y-8, AC-14 · **DoD:** all pairs ≥ AA; ratio table recorded in the PR.

### ✅ T-43 · Automated a11y sweep

Run axe (via `@axe-core/react` in dev or `vitest-axe` in tests) over the main view and each modal.
**Req:** G5, NFR-4 · **DoD:** zero serious/critical violations.

---

## Phase 8 — Testing & Hardening (T-44 … T-45) ✅ COMPLETE

### ✅ T-44 · Integration test suite

End-to-end flows through providers with a fixture dictionary: full win, full loss, invalid inputs, restart, length switch, refresh-restore, stats accumulation across several games, reset flows, storage-unavailable mode.
**Req:** AC-1…AC-12, AC-19 · **Depends:** Phases 4–7 · **DoD:** each listed AC has at least one asserting test, cited by ID in the test name.

### ✅ T-45 · Edge case sweep

One test (or documented manual check) per `EC-1…EC-21`.
**Req:** EC-1…EC-21 · **DoD:** a table in the PR maps every EC to its test or manual verification note.

---

## Phase 9 — Polish & Release (T-46 … T-48) ✅ COMPLETE

### ✅ T-46 · Responsive & device pass

320 px → 2560 px, landscape phones, iOS Safari dynamic viewport (`dvh`), touch target sizes, no horizontal scroll.
**Req:** FR-58, FR-59, EC-18, AC-22 · **DoD:** screenshots at 320/375/768/1440 px plus landscape attached to the PR.

### ✅ T-47 · Performance & bundle budget

Bundle analysis against NFR-1, Lighthouse mobile run against NFR-4, verify per-length chunking and zero network requests during play.
**Req:** NFR-1…NFR-5, AC-18, AC-21 · **DoD:** Lighthouse scores and the network-tab evidence recorded in the PR.

### ✅ T-48 · Documentation & release readiness

Update README (screenshots, final scripts), reconcile docs with the built app, walk the entire `ACCEPTANCE.md` checklist, tag `v1.0.0`.
**Req:** All · **Depends:** T-01…T-47 · **DoD:** every `ACCEPTANCE.md` box is ticked with evidence; `npm run verify` green from a clean clone.

---

### Phase 7–9 verification record (2026-07-26)

Browser-level evidence, produced against the **production build** in Chromium (ADR-019).

| Check                               | Result                                                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| axe (WCAG 2.0/2.1 A + AA)           | ✅ **zero violations** on the game view, both dialogs, dark mode, and a played board                          |
| Lighthouse mobile                   | ✅ Performance **100**, Accessibility **100**, Best Practices **100**, SEO 91 · TTI 1.6 s · CLS 0 · TBT 0 ms  |
| Lighthouse desktop                  | ✅ Performance **100**, Accessibility **100**, Best Practices **100** · TTI 0.4 s                             |
| Contrast (`npm run check:contrast`) | ✅ all 80 token pairs across light / dark / colourblind / dark-colourblind meet AA — now enforced in `verify` |
| Responsive                          | ✅ 320 → 2560 px plus landscape, no horizontal scroll, all three word lengths                                 |
| Touch targets                       | ✅ keys and header controls ≥ 44 px on phone viewports                                                        |
| Offline                             | ✅ zero network requests after load; a full game plays with the network disabled                              |
| Storage failure                     | ✅ corrupt JSON and a throwing `localStorage` both leave the game playable                                    |
| Test totals                         | ✅ **336** unit/integration + **88** browser = 424 passing                                                    |

**Four real defects found in this phase, none of which any unit test had caught:**

1. **18 contrast pairs below AA** — including white-on-yellow tiles at 2.63:1 and dark-mode borders at 1.65:1. Fixed by computing compliant replacements rather than eyeballing them; the audit now runs in `verify`.
2. **43 px of horizontal overflow at 320 px** (AC-22) — the header could not fit its controls. Fixed by letting the title truncate and the keys flex.
3. **Keyboard below the fold in landscape** (EC-18) — board and keyboard now shrink together under `max-height: 560px`.
4. **`Enter` silently stopped submitting after opening any dialog** — closing a modal restores focus to its trigger (FR-57), and the old rule bailed out of Enter for _any_ focused button. A player who visited Settings once could not submit another guess. Fixed so a focused control only wins when the row is empty, and covered by a regression test.

A fifth issue, the production build being OOM-killed, was traced to Tailwind's source scanner crawling `node_modules` in the absence of a git boundary — see ADR-018.

---

## Phase 10 — Post-V1 Enhancements (T-49 …)

### ✅ T-49 · How to play dialog

Header control plus a portalled dialog explaining the rules, with three worked
tile examples that follow the active word length and the colourblind palette.
Opened by the player only; nothing is persisted (ADR-020).

**Req:** US-19, FR-60, A11Y-13, AC-23 · **Depends:** T-34 (`Header`), T-35 (`Modal`) ·
**DoD:** `npm run verify` green; new component and integration tests pass; axe
clean on the dialog in both palettes; `npm run test:e2e` green; no new colour
token, so `check:contrast` is unchanged; SPEC / ARCHITECTURE / DECISIONS /
ACCEPTANCE updated in the same PR.

---

## Phase 11 — Suite Shell & Rename (T-50 … T-57)

Turns the single game into the wordgames suite. Rationale in ADR-021 to ADR-024 and ADR-027.

### ✅ T-50 · Rename to wordgames

Rename the product. Change the `package.json` name, the `index.html` title and meta tags, `base: '/wordgames/'` in `vite.config.ts`, `robots.txt`, the favicon `aria-label`, and the product name in `Header` and `ErrorBoundary` copy. Update tests that assert the old name. Update README and CONTRIBUTING, and add a one-line note at the top of `REVIEW.md` that it predates the rename. Owner steps, outside the PR: rename the GitHub repo, update the Pages settings, and run `git remote set-url` locally.
**Req:** FR-61, G9 · **Depends:** — · **DoD:** `npm run build` emits asset URLs under `/wordgames/`; a repo-wide search for "Wordwright" finds only the game name, the legacy `wordwright:` storage keys and historical docs; `npm run test:e2e` green.

### ✅ T-51 · Storage layout and per-game repositories

Move to the FR-68 key layout. Replace the module-level Settings and Stats repository singletons with factories that take a game id, so each game gets its own `prefs`, `stats`, `session` and `meta` keys under `wordgames:v1:<game>:`. Shrink shared settings to `{ theme, colorblind, motion }` and move `defaultWordLength` into Wordwright `prefs`. Make `isOwnedKey` match both the `wordgames:` and `wordwright:` namespaces, so **Reset data** clears both. Rename the probe key to `__wordgames_probe__`. Flush the session on unmount: `GameProvider` currently clears the debounce timer without writing.
**Req:** FR-65, FR-67, FR-68, FR-71, EC-24, EC-28 · **Depends:** T-50 · **DoD:** unit tests show each repository reads and writes only its own key; resetting one game's stats leaves the other game's keys byte-identical; **Reset data** removes every `wordgames:` and `wordwright:` key; a test that types a letter and unmounts within the debounce window finds that letter in the stored session.

### ✅ T-52 · Shared ConfirmDialog and Wordwright restart controls

Build one `ConfirmDialog` on top of `Modal` for the whole suite, and use it for the settings danger zone (FR-47). Use it to finish the Wordwright features that were never built: **Change length** on the result panel (FR-21), and a confirmation before restarting or switching length when at least one guess exists (FR-34, EC-15). Add a **Restart** control so a player can start a fresh word mid-game (US-6). T-33, T-34 and T-35 are marked complete but claim parts of this work (Change length, the length-switch confirm, a `ConfirmDialog`); none of it exists in `src/` today.
**Req:** FR-21, FR-34, FR-47, EC-15, US-6, AC-10 · **Depends:** — · **DoD:** integration tests: switching from 5 to 6 letters after one guess asks to confirm, **Cancel** keeps the board, confirm starts a fresh 6-letter game with stats unchanged (AC-10); restart with zero guesses does not ask; **Change length** on the result panel works; the reset dialogs still name exactly what is deleted; ACCEPTANCE rows 3.12 and 3.13 ticked with evidence.

### ✅ T-53 · Legacy import and theme fallback

Add a boot step in `main.tsx`, before the first render, that runs the FR-69 import from `wordwright:v1:*` to the new keys. Write `wordgames:v1:meta` last. Never delete or change legacy keys, never throw, and fall back to defaults on any failure. The existing migration chain in `migrations.ts` is not wired into any repository, so the import does not rely on it (ADR-023). Change the inline theme script in `index.html` to read `wordgames:v1:settings` and fall back to `wordwright:v1:settings`.
**Req:** FR-69, FR-70, NFR-17, US-23, EC-25, EC-26, EC-27, AC-27 · **Depends:** T-51 · **DoD:** unit tests cover a full import, an interrupted import that re-runs on the next load, a second load that does not import again, a corrupt legacy key copied as-is, and storage unavailable at boot; every test asserts the legacy keys are unchanged afterwards; a browser test with legacy dark-theme settings shows no light flash on first load (AC-27).

### ✅ T-54 · Hash routing, titles and focus

Add a small `useHashRoute` hook in `src/shell/` built on `useSyncExternalStore` over `hashchange` (ADR-022). Map `#/`, `#/wordwright` and `#/weaver` to views. Correct an empty or unknown hash to `#/` with `history.replaceState`. Set `document.title` per view (FR-66). On every view change, close any open dialog and move focus to the new view's `<h1>`.
**Req:** FR-62, FR-66, US-22, A11Y-15, EC-22, EC-38, AC-25, AC-26 · **Depends:** T-50 · **DoD:** unit tests: `#/foo` and `#weaver` show Home and the history length does not grow; Back and Forward switch views; the title matches FR-66 for each view; after a view change `document.activeElement` is the `<h1>`; Back with a dialog open closes it.

### ✅ T-55 · Provider restructure, Home and header

Split `App.tsx` into the shell and the game views. Shared appearance settings, toasts and the error boundary wrap everything. Each game's providers mount only inside its own view (ADR-021). Build Home: a `<ul>` of game cards, each a link with a name and a one-line description. Rework `Header` so a game view shows **All games**, the game name as `<h1>`, the game's controls, then settings, and Home shows the suite name and settings only (FR-64).
**Req:** FR-61, FR-63, FR-64, US-20, US-21, A11Y-14, NFR-15, AC-24 · **Depends:** T-51, T-54 · **DoD:** a component test shows Home mounts no game provider and calls no `loadDictionary`; the production build shows no `lists-*` request on Home and the entry bundle stays within NFR-1; leaving Wordwright mid-game and returning restores the board; every view has exactly one `<h1>`.

### ✅ T-56 · Enter to continue (Wordwright)

Add a `useEnterToContinue` hook, separate from `usePhysicalKeyboard` (ADR-027). The Wordwright result panel arms it on mount. It ignores `event.repeat`, modifier keys, open dialogs, and focus on a button, link or text field. It never moves focus.
**Req:** FR-72, FR-73, US-24, A11Y-18, EC-35, EC-36, AC-28 · **Depends:** T-55 · **DoD:** hook tests for each ignored case; an integration test wins with physical Enter, sees no new game start, then presses Enter again and gets a new game (AC-28); with a dialog open over the result panel, Enter goes to the dialog; focus does not move when the panel appears.

### ✅ T-57 · End-to-end suite updates

Update the Playwright specs for the new shell. Add a helper that opens `#/wordwright` and waits for the "Guess board" grid, and use it in every existing spec. Update the storage keys the specs seed and read. Keep a few `wordwright:v1:*` fixtures for the import test (AC-27). Add Home to the axe scans, and add browser tests for hash navigation and Back.
**Req:** AC-24, AC-25, AC-26, AC-41 · **Depends:** T-55 · **DoD:** `npm run test:e2e` green; new specs cover AC-24, AC-25, AC-26 and a keyboard-only round trip Home → Wordwright → Home; axe reports zero serious or critical issues on Home.

---

## Phase 12 — WordWeaver Data & Engine (T-58 … T-64) · _test-first, no UI_

Pure engine code in `src/engine/weaver/`, so the existing engine lint boundary and coverage gate apply. Can run in parallel with T-51 … T-57. Rationale in ADR-025 and ADR-026.

### ✅ T-58 · Ladder list and par measurement

Extend `scripts/build-dictionaries.mjs` to emit a third export, the ladder list, from `lists-4.ts` and `lists-5.ts`: the most frequent words of that length, ranked by the same frequency data as the answers. Add invariant tests: uppercase, sorted, unique, and answers ⊆ ladder ⊆ guesses. Add a measurement script (for example `scripts/measure-par.mjs`) that prints the par distribution over the ladder list for each length. Use it to fix the ladder-list size (the smallest cut where at least 90% of answer starts have an in-band end) and `PAR_BAND`. Record the final table in SPEC §15.1.
**Req:** FR-75, FR-77, NFR-14 · **Depends:** T-50 · **DoD:** invariant tests pass and fail when a list is corrupted on purpose; each of `lists-4` and `lists-5` grows by no more than 15 KB gzipped (build output recorded in the PR); SPEC §15.1 shows the measured distribution and the final `PAR_BAND`; the `EAST → WEST` example in FR-76 is checked against the real list.

### ✅ T-59 · Ladder graph and shortest paths

`buildLadderGraph(words)` using wildcard buckets (`C_LD`) for adjacency, cached per length by the caller. `distancesFrom(graph, start)` runs one breadth-first search. `shortestLadder(graph, start, end, answers)` returns one optimal ladder, preferring the most answer-list words and breaking ties by alphabetical order of neighbours (FR-86).
**Req:** FR-76, FR-86, NFR-16 · **Depends:** T-58 · **DoD:** tests on a small fixture graph check neighbours, distances, unreachable words, the answer-word preference and the tie-break; the same puzzle always returns the same ladder; every step changes exactly one letter; 100% branch coverage.

### ✅ T-60 · Puzzle generation

`generatePuzzle(lists, graph, recentStarts, random)` follows FR-78: skip recent starts, one BFS per start, pick the end from in-band answers, try up to 20 starts, fall back to any reachable answer at distance ≥ 3, and return a typed failure when nothing qualifies. Add the `PAR_BAND` constant.
**Req:** FR-74, FR-77, FR-78, EC-32, AC-36 · **Depends:** T-59 · **DoD:** with `seededRandom` and the real lists, 200 puzzles per length all have start ≠ end, both words in the answer list, par inside `PAR_BAND`, and par equal to an independent reference BFS (AC-36); fixture tests reach the fallback and the failure path; a start in `recentStarts` is never picked while another start qualifies.

### ✅ T-61 · Rung validation and evaluation

`validateRung(input, previous, ladder, isAllowed)` checks in the FR-80 order and returns `too-short`, `not-a-word`, `not-one-letter` or `already-used`. `evaluateRung(rung, end)` returns `correct` or `absent` per position, with no `present` (FR-81). Reuse `validateGuess` for the first two checks.
**Req:** FR-79, FR-80, FR-81, FR-82, EC-29, AC-31, AC-32, AC-34 · **Depends:** — · **DoD:** table tests for each error in order (a short, unknown word reports `too-short`); `CARE` after `CORD` gives `not-one-letter`; `COLD` after `CORD` gives `already-used`; `CARD` against `WARM` is `[absent, correct, correct, absent]` and `COLD` against `WARM` is all `absent` (AC-34); the end word passes from a neighbour; 100% branch coverage.

### ✅ T-62 · WordWeaver reducer

`weaverReducer` with `ADD_LETTER`, `REMOVE_LETTER`, `SUBMIT_RUNG`, `UNDO`, `GIVE_UP`, `REVEAL_COMPLETE` and `NEW_PUZZLE`. Backspace on an empty row undoes the last rung (FR-83). `moves` counts every accepted rung, undone or not. Submitting the end word sets `solved`. Rung input stops at 500 moves (FR-85). There is no score (FR-87). Pure and total, returning the same reference for no-op actions.
**Req:** FR-83, FR-84, FR-85, FR-87, EC-30, EC-34, AC-33 · **Depends:** T-61 · **DoD:** state-machine tests for every action in every status; undo with no rungs returns the same state (EC-30); rungs `CORD`, `CARD`, undo, `CARD` again gives 3 moves (AC-33); the 500th move blocks input but `GIVE_UP` and `NEW_PUZZLE` still work; 100% branch coverage.

### ✅ T-63 · Selectors and result summary

`ladderRows(state)` for the board view-model, plus `resultSummary(state)` returning `moves`, `par`, `ladderLength`, `overPar` and `parHit`, and a label of "Par!", "Under par by n!" or "+n".
**Req:** FR-84, EC-31, AC-30, AC-44 · **Depends:** T-62 · **DoD:** tests: the `COLD → WARM` fixture solved in 4 gives "Par!" and a par hit (AC-30); 6 moves gives "+2" (EC-31); 3 moves against par 4 gives "Under par by 1!", a par hit and `overPar` of −1 (AC-44); 100% branch coverage.

### ✅ T-64 · Engine barrel, lint and coverage gate

Export the WordWeaver public surface from `src/engine/weaver/index.ts`. Confirm the engine boundary rules and the 100% branch gate cover the new folder, and that no WordWeaver file imports Wordwright engine internals except shared helpers (`validateGuess`, `random`). `vitest.config.ts` excludes `src/engine/types.ts` by exact path, so add the same exclusion for `src/engine/weaver/types.ts`.
**Req:** NFR-16 · **Depends:** T-59 … T-63 · **DoD:** `npm run test:coverage` shows 100% branches for `src/engine/weaver/**`; adding `import 'react'` or `Math.random()` to a WordWeaver engine file fails lint (checked by probe, then reverted); the boundary test lists the new files.

---

## Phase 13 — WordWeaver Storage, State & UI (T-65 … T-71)

### ✅ T-65 · WordWeaver schemas and repositories

Schemas and runtime guards for WordWeaver `prefs`, `stats`, `session` and `meta` (FR-68), using the T-51 factories. A `recordGame` reducer that is idempotent by game id and updates overall and per-length stats (FR-92). Session restore that discards invalid games (FR-93).
**Req:** FR-92, FR-93, EC-33, AC-38 · **Depends:** T-51, T-64 · **DoD:** unit tests for solve, give up, par hit, negative average over par, streak reset on give up, the 50-game cap and double-record idempotency; each FR-93 discard rule has a test; resetting WordWeaver stats leaves 10 recorded Wordwright games unchanged (AC-38).

### ✅ T-66 · WordWeaver providers

`WeaverStatsProvider` and `WeaverGameProvider` in `src/state/weaver/`. The game provider loads the dictionary, builds and caches the ladder graph per length, generates puzzles, persists the session (debounced, on page hide and on unmount), records stats once, and exposes the actions. While loading it shows the `"Preparing puzzle…"` state, and on dictionary failure the Retry panel.
**Req:** FR-93, FR-96, EC-23, AC-40 · **Depends:** T-65, T-55 · **DoD:** integration tests with a fixture dictionary: a solve records once; leaving the view and returning restores the ladder, move count and typed letters (AC-40); leaving mid-reveal restores the row fully revealed (EC-23); a dictionary failure shows Retry and Retry recovers; input is disabled while preparing.

### ✅ T-67 · Ladder board and reveal

`WeaverBoard` in `src/components/weaver/`: start row, rungs, input row and end row (FR-88). The rung area scrolls and keeps the input row in view. Reuse `Tile` and `useRevealTimeline` with two states (FR-89). Grid and tile labels follow A11Y-16.
**Req:** FR-88, FR-89, A11Y-16, US-25, US-26 · **Depends:** T-66 · **DoD:** component tests assert the grid name "Word ladder", the row labels and a tile label such as "Rung 2, letter 3: A, matches end word"; reduced motion shows the final state with no animation; with 15 rungs the input row and end row stay visible.

### ✅ T-68 · Controls: undo, give up, new puzzle, length

Keyboard with the Wordwright layout but no letter colours, plus **Undo**, **Give up** and **New puzzle** buttons (FR-90). A 4/5 length selector. **Give up**, **New puzzle** and a length change ask to confirm through `ConfirmDialog` when at least one rung exists (FR-94).
**Req:** FR-90, FR-94, US-27, US-28, US-29, AC-35, AC-39 · **Depends:** T-52, T-67 · **DoD:** integration tests: give up after 2 rungs shows a ladder of `par` steps that all change one letter and all sit in the ladder list, and stats show played +1, gave up +1, streak 0 (AC-35); **Cancel** on **New puzzle** or a length change keeps the ladder (AC-39); with no rungs nothing asks to confirm; every button is at least 44 × 44 px on a touch viewport.

### ✅ T-69 · Result panel and Enter to continue

`WeaverResultPanel` showing the FR-91 content: "Solved!" or "Gave up", moves against par, the player's ladder, the optimal ladder after a give up, **Play again** and **Change length**. Arm `useEnterToContinue` on mount.
**Req:** FR-91, US-30, AC-29 · **Depends:** T-56, T-67 · **DoD:** integration test solves with physical Enter, sees no new puzzle, then presses Enter again and gets a new puzzle of the same length (AC-29); each par label ("Par!", "Under par by n!", "+n") renders; **Play again** stays reachable with Tab.

### ✅ T-70 · Help and statistics dialogs

`WeaverHelpModal` with the FR-95 content and a worked example that follows the selected length and palette, decorative per A11Y-13. `WeaverStatsModal` with the FR-92 metrics, per-length view, recent games and the empty state, plus scoped reset actions.
**Req:** FR-92, FR-95, US-31, AC-42 · **Depends:** T-66 · **DoD:** the help example shows 4 tiles at 4 letters and 5 at 5 (AC-42); with fixture stats every value matches a hand-computed expectation; average over par shows `—` with no solves and can show a negative number; 0 games shows the empty state, never `NaN`.

### ✅ T-71 · Announcements and accessibility pass

Polite announcements for each accepted rung, undo, solve and give up (A11Y-17), assertive for errors. Confirm WordWeaver uses only the existing `correct` and `absent` tokens and markers (A11Y-19). Run axe on Home and WordWeaver.
**Req:** A11Y-17, A11Y-19, AC-43 · **Depends:** T-67 … T-70 · **DoD:** tests assert the exact A11Y-17 strings, once per event; `npm run check:contrast` is unchanged with no new token; axe reports zero serious or critical issues on Home and WordWeaver in both palettes and both themes (AC-43).

---

## Phase 14 — Suite Verification & Release (T-72 … T-73)

### ✅ T-72 · Performance, responsive and integration checks

Measure 5-letter graph build plus first puzzle under Lighthouse mobile CPU throttling, and later puzzles. If NFR-13 is missed, move generation to a Web Worker. Check both games and Home from 320 px to 2560 px and in landscape. Add a browser test that plays both games end to end with the keyboard only.
**Req:** NFR-13, AC-37, AC-41, EC-18 · **Depends:** Phase 13 · **DoD:** timings for first and later puzzles recorded in the PR and within NFR-13; Lighthouse mobile on Home and WordWeaver still meets NFR-4; no horizontal scroll at 320 px and the WordWeaver keyboard stays visible in landscape; the keyboard-only test covers Home → each game → result → Home (AC-41).

### ✅ T-73 · Docs reconcile, deploy and redirect

Reconcile SPEC, ARCHITECTURE, DECISIONS and README with what was built. Fill the Suite V1 addendum in `ACCEPTANCE.md` and tick its rows with evidence. Deploy to `/wordgames/`. Create a stub repo named `wordwright` whose Pages site redirects to `/wordgames/` with a meta refresh (owner step).
**Req:** EC-37, G9 · **Depends:** T-72 · **DoD:** every Suite V1 row in `ACCEPTANCE.md` is ticked with evidence; the deployed `/wordgames/` site plays both games; opening the old `/wordwright/` URL lands on `/wordgames/`; a returning player's stats survive the move (checked by hand on the live site).

---

## Phase 15 — WordStack, release R2 (T-74 … T-79)

Adds the game catalogue that every later game uses, then WordStack (SPEC §17). Starts after Suite V1 ships. Rationale in ADR-028 and ADR-029. Each new game follows the WordWeaver layout: engine in `src/engine/<game>/`, providers in `src/state/<game>/`, components in `src/components/<game>/`.

### ✅ T-74 · Game catalogue and lazy game views

Replace the `GameId` switch with one read-only ordered array in `src/shell/catalogue.ts`. Each entry is `{ id, name, description, route, View }`, and `View` is a `React.lazy` import of the game's view (ADR-028). Home, `useHashRoute`, page titles and the header all read this array. A route that is not in the catalogue goes Home (FR-97, EC-22). Add a key builder in `src/storage/` that returns `wordgames:v1:<gameId>:<part>` for the T-51 repository factories (FR-99). Let any catalogue game arm `useEnterToContinue` and pass its controls to the header (FR-100, FR-101). Move Wordwright and WordWeaver onto the catalogue and the key builder with no behaviour change.
**Req:** FR-97, FR-98, FR-99, FR-100, FR-101, NFR-18, NFR-20, AC-45, EC-50 · **Depends:** T-73 · **DoD:** every existing unit, integration and browser test passes unchanged; a test with a three-entry fixture catalogue shows three cards in catalogue order and the right title and `<h1>` on each route; `#/stack` goes Home while WordStack is not in the catalogue; the key builder returns exactly the FR-68 keys for Wordwright and WordWeaver, so no stored data moves; the production build emits a separate chunk per game view, and the entry bundle is no larger than before (sizes recorded in the PR).

### ✅ T-75 · WordStack engine

Pure code in `src/engine/stack/`. Types and constants for the two modes: Duo is 2 boards and 7 guesses, Quad is 4 boards and 9 guesses (FR-102). `createStackGame(mode, answers, recent, random)` draws one different answer per board, using one no-repeat ring buffer for both modes (FR-103, EC-41). `stackReducer` reuses `validateGuess` for input checks (FR-104), adds an accepted guess to every unsolved board, and scores each board with `evaluateGuess` (FR-105). A board freezes once solved (FR-106, EC-39). The game is won when every board is solved within the limit, and lost otherwise (FR-107, EC-40). Selectors give each board's rows and status, guesses left, boards solved and the unsolved answers.
**Req:** FR-102, FR-103, FR-104, FR-105, FR-106, FR-107, NFR-19, EC-39, EC-40, EC-41, AC-46, AC-47, AC-48 · **Depends:** T-74 · **DoD:** `PANEL` against `PLANT` and `STORM` gives the AC-46 results; after board 1 is solved on guess 3, guess 4 lands only on board 2 (AC-47); Quad with two boards unsolved after 9 guesses is lost and lists both answers (AC-48); solving the last board on the final guess is a win (EC-40); 1,000 seeded draws never repeat an answer within a game (EC-41); a rejected guess changes no board; 100% branch coverage and the engine purity lint cover `src/engine/stack/**`.

### ✅ T-76 · Split keyboard

Add a selector that returns each board's best state per letter, using `deriveKeyStates` per board and blank for a solved board (FR-109). Add a presentational `SplitKey` in `src/components/stack/` that draws one segment per board: halves for Duo, quarters for Quad. Its accessible name lists every board's state (A11Y-20). Keep Wordwright's `Key` unchanged.
**Req:** FR-109, US-33, A11Y-20 · **Depends:** T-75 · **DoD:** selector tests show a letter that is present on board 1 and absent on board 2 gets those two states, and a solved board's segment is blank; a component test asserts a Quad key's label such as "A: board 1 present, board 2 absent, board 3 solved, board 4 absent"; every segment state carries the colourblind marker, so state never relies on colour alone; `npm run check:contrast` passes with no new token; Wordwright's keyboard tests pass unchanged.

### ✅ T-77 · WordStack storage and providers

Schemas and runtime guards for WordStack `prefs` (`{ mode }`), `stats`, `session` and `meta` (the ring buffer) under `wordgames:v1:stack:*`, using the T-74 key builder. A `recordGame` reducer, idempotent by game id, that keeps overall and per-mode stats with the FR-111 distribution buckets and the last 50 games. `StackStatsProvider` and `StackGameProvider` in `src/state/stack/`: load the 5-letter dictionary, persist the session (debounced, on page hide and on unmount), discard a restore whose answers have left the answer list (FR-112), and record each finished game once.
**Req:** FR-111, FR-112, AC-56 · **Depends:** T-75 · **DoD:** unit tests for a win, a loss, both modes' buckets (Duo 2–7, Quad 4–9), streaks, the 50-game cap and double-record idempotency; leaving mid-game and returning restores every board and the typed letters; a session with an unknown answer is discarded and a new game starts; resetting WordStack stats leaves the stored Wordwright and WordWeaver stats byte-identical (AC-56).

### ✅ T-78 · WordStack view and controls

`StackView` in `src/components/stack/`, reusing `Board` and `Tile` per board. Duo shows two boards side by side; Quad shows a 2 × 2 grid. The board area scrolls and the keyboard stays visible (FR-108). A Duo/Quad selector in the header. `StackResultPanel` with the FR-110 content, **Play again** in the same mode and **Change mode**, and `useEnterToContinue` armed on mount. Restarting or switching mode after at least one guess asks to confirm through `ConfirmDialog` (FR-113). All boards reveal together and must stay smooth in Quad (NFR-21).
**Req:** FR-108, FR-110, FR-113, US-32, NFR-21, AC-55 · **Depends:** T-76, T-77 · **DoD:** integration tests: a Duo win and a Quad loss each show the right result panel; the Enter that submits the winning guess does not start a new game and the next Enter does (AC-55); switching mode after one guess asks to confirm, **Cancel** keeps the game, and stats are unchanged either way; at 320 px and in landscape the keyboard stays visible in Quad with no horizontal scroll; a Quad guess renders within 16 ms in a performance trace (NFR-21, trace recorded in the PR).

### ✅ T-79 · WordStack help, stats, accessibility and release

`StackHelpModal` with the FR-114 content and a two-board example that is decorative per A11Y-13. `StackStatsModal` with overall and per-mode views, recent games, the empty state and scoped reset actions. Name each board grid "Board _n_ of _m_", with "solved" added once solved (A11Y-20). Announce one summary per guess with the A11Y-21 wording. Add WordStack to the catalogue. Run axe, deploy, and fill the R2 addendum in `ACCEPTANCE.md`.
**Req:** FR-114, A11Y-21, US-38, AC-57 · **Depends:** T-78 · **DoD:** tests assert the exact A11Y-21 announcement, once per guess; the help dialog never opens by itself; with fixture stats every value matches a hand-computed expectation and 0 games shows the empty state, never `NaN`; axe reports zero serious or critical issues on WordStack in both themes and both palettes (AC-57); Home shows the WordStack card in catalogue order and `#/stack` opens it (AC-45); the deployed site plays WordStack; every R2 row in `ACCEPTANCE.md` is ticked with evidence.

---

## Phase 16 — WordRange, release R3 (T-80 … T-83)

Adds WordRange (SPEC §18). Rationale in ADR-030.

### ✅ T-80 · WordRange engine

Pure code in `src/engine/range/`. First add a sorted `guessList` array to `Dictionary` (`src/dictionary/types.ts`, `loadDictionary.ts`) alongside the `guesses` Set; WordRange and WordShuffle both need it (ARCHITECTURE §8.5). Constants: 5 letters, `MAX_GUESSES = 14`, the sentinel bounds `AAAAA` and `ZZZZZ`, and the five heat bands (FR-115, FR-120). `validateRangeGuess(input, state, isAllowed)` reuses `validateGuess` for the first two checks, then rejects a repeat and a guess not strictly inside the range, in the FR-117 order. `rangeReducer` marks each accepted guess before or after, narrows the range, and ends the game on a match or after 14 guesses (FR-116, FR-118, FR-119). `listDistance(list, a, b)` finds both words by binary search and `heatOf(distance)` maps the difference through the bands. They use positions in the sorted 5-letter guess list, which is already sorted uppercase, so no new data is needed.
**Req:** FR-115, FR-116, FR-117, FR-118, FR-119, FR-120, NFR-19, EC-42, EC-43, AC-49, AC-50 · **Depends:** T-74 · **DoD:** with secret `PLANT`, `BRAVE` is "after", the range becomes `BRAVE … ZZZZZ` and the heat is Freezing, and `PLAIN` is Burning (AC-49); with range `BRAVE … STORM`, `ABOUT` returns `outside-range` and uses no guess (AC-50, EC-42); a repeat returns `already-guessed` (EC-43); each rejection has a table test in the FR-117 order; each heat band boundary (20/21, 100/101, 500/501, 2,000/2,001) has a test; the 14th wrong guess loses; 100% branch coverage and the engine purity lint cover `src/engine/range/**`.

### ✅ T-81 · WordRange storage and providers

Schemas and runtime guards for `wordgames:v1:range:{prefs,stats,session,meta}`, with the ring buffer in `meta`. A `recordGame` reducer, idempotent by game id, with buckets 1–14 and the last 50 games (FR-124). `RangeStatsProvider` and `RangeGameProvider` in `src/state/range/`: load the 5-letter dictionary, persist the session, discard a restore whose secret has left the answer list, and record each finished game once (FR-125). Restarting after at least one guess asks to confirm through `ConfirmDialog`.
**Req:** FR-124, FR-125 · **Depends:** T-80 · **DoD:** unit tests for a win, a loss, streaks, buckets, the 50-game cap and double-record idempotency; leaving mid-game and returning restores the bounds, the guess list and the typed letters; a session with an unknown secret is discarded; restart after one guess asks to confirm and **Cancel** keeps the game.

### ✅ T-82 · WordRange view

`RangeView` in `src/components/range/`: the upper bound, the input row with the last guess's heat, the lower bound, then every guess sorted alphabetically with before or after and its heat (FR-121). Heat is always shown as a word. Reuse the keyboard with no letter colours (FR-122). `RangeResultPanel` with the FR-123 content and `useEnterToContinue` armed on mount.
**Req:** FR-121, FR-122, FR-123, US-34, AC-55 · **Depends:** T-81 · **DoD:** integration tests: after `BRAVE` and `STORM` the bounds read `BRAVE` and `STORM` and the list is sorted alphabetically; every heat level renders its word; keys never change colour; the Enter that submits the winning guess does not start a new game and the next Enter does (AC-55); no horizontal scroll at 320 px with 14 guesses listed.

### ✅ T-83 · WordRange help, stats, accessibility and release

`RangeHelpModal` with the FR-126 content and a decorative three-guess example. `RangeStatsModal` with the FR-124 metrics, recent games, the empty state and scoped reset actions. Announce each guess with the A11Y-22 wording, with heat in words. Add WordRange to the catalogue. Run axe, deploy, and fill the R3 addendum in `ACCEPTANCE.md`.
**Req:** FR-126, A11Y-22, US-38, AC-57 · **Depends:** T-82 · **DoD:** tests assert the exact A11Y-22 announcement, once per guess; the help dialog never opens by itself; with fixture stats every value matches a hand-computed expectation and 0 games shows the empty state; axe reports zero serious or critical issues on WordRange in both themes and both palettes (AC-57); Home shows the WordRange card and `#/range` opens it (AC-45); the deployed site plays WordRange; every R3 row in `ACCEPTANCE.md` is ticked with evidence.

---

## Phase 17 — WordCode, release R4 (T-84 … T-87)

Adds WordCode (SPEC §19). Rationale in ADR-031.

### ✅ T-84 · WordCode engine

Pure code in `src/engine/code/`. Lengths 4, 5 and 6, `MAX_GUESSES = 10`, and the secret drawn with its own ring buffer per length (FR-127). Input checks reuse `validateGuess` (FR-128). `scoreCode(guess, secret)` returns `{ bulls, cows }` by counting `correct` and `present` in `evaluateGuess`, so duplicate letters follow FR-12 and FR-13 (FR-129). `codeReducer` wins when bulls equal the length and loses after 10 guesses (FR-130).
**Req:** FR-127, FR-128, FR-129, FR-130, NFR-19, EC-44, AC-51 · **Depends:** T-74 · **DoD:** `PANEL` against `PLANT` gives 1 bull and 3 cows, and `EEEEE` against `SPEED` gives 2 bulls and 0 cows (AC-51); every row of the SPEC §6.3 truth table gives counts equal to its `correct` and `present` totals (EC-44); a win at each length and a loss on the 10th guess; 100% branch coverage and the engine purity lint cover `src/engine/code/**`.

### ✅ T-85 · WordCode storage and providers

Schemas and runtime guards for `wordgames:v1:code:{prefs,stats,session,meta}`. The session includes the letter notes. A `recordGame` reducer, idempotent by game id, with overall and per-length stats, buckets 1–10 and the last 50 games (FR-134). `CodeStatsProvider` and `CodeGameProvider` in `src/state/code/` load the dictionary for the selected length, persist the session with notes, and record each finished game once (FR-135).
**Req:** FR-134, FR-135, EC-45, AC-52 · **Depends:** T-84 · **DoD:** unit tests for a win, a loss, per-length stats, streaks, the 50-game cap and double-record idempotency; a session with notes set round-trips exactly (EC-45); leaving mid-game and returning restores the rows, the typed letters and the notes; a session with an invalid secret or notes is discarded.

### ✅ T-86 · WordCode view and letter notes

`CodeView` in `src/components/code/`. Each row shows the guess on neutral tiles and the counts as text, for example "2 bulls · 1 cow" (FR-131). A notes panel of 26 toggle buttons cycles each letter through unmarked, ruled out and in the word. The marks also show on the keyboard keys in a style that cannot be confused with game feedback, and the game never sets them (FR-132). A length selector. `CodeResultPanel` with the FR-133 content and `useEnterToContinue` armed on mount. Restarting or switching length after at least one guess asks to confirm through `ConfirmDialog`.
**Req:** FR-131, FR-132, FR-133, US-35, US-36, AC-55 · **Depends:** T-85, T-52 · **DoD:** integration tests: counts render with correct singular and plural; pressing a note button three times returns it to unmarked; marks show on the keys and survive a reload (AC-52); no guess changes a mark; the Enter that submits the winning guess does not start a new game and the next Enter does (AC-55); a length switch after one guess asks to confirm; note buttons and keys are at least 44 × 44 px on a touch viewport.

### ✅ T-87 · WordCode help, stats, accessibility and release

`CodeHelpModal` with the FR-136 content and a decorative two-guess example that follows the selected length. `CodeStatsModal` with overall and per-length views, recent games, the empty state and scoped reset actions. Announce each guess with the A11Y-23 wording, and give each note button a label that includes its mark. Add WordCode to the catalogue. Run axe, deploy, and fill the R4 addendum in `ACCEPTANCE.md`.
**Req:** FR-136, A11Y-23, US-38, AC-57 · **Depends:** T-86 · **DoD:** tests assert the exact A11Y-23 announcement, once per guess, and a note button label such as "P, ruled out"; the help example has 4, 5 or 6 tiles to match the length; with fixture stats every value matches a hand-computed expectation; axe reports zero serious or critical issues on WordCode in both themes and both palettes (AC-57); `check:contrast` passes with any new note-mark token; Home shows the WordCode card and `#/code` opens it (AC-45); the deployed site plays WordCode; every R4 row in `ACCEPTANCE.md` is ticked with evidence.

---

## Phase 18 — WordShuffle, release R5 (T-88 … T-91)

Adds WordShuffle (SPEC §20). Rationale in ADR-032.

### ✅ T-88 · WordShuffle engine

Pure code in `src/engine/shuffle/`. Lengths 4, 5 and 6 with no guess limit (FR-137). `createPuzzle(lists, recent, random)` draws a target with its own ring buffer per length and a scramble that differs from the target and is not in the guess list, drawing another target when no such order exists (FR-138, EC-49). `buildAnagramIndex(words)` and `anagramsOf(index, word)` give every guess-list word with the same letters. `shuffleReducer` handles tray input, ignoring a letter that is not left in the tray (FR-139, EC-46), Backspace, submit in the FR-140 order, hints that fix the leftmost unfixed letter of the target, up to 2 (FR-142), reshuffle (FR-143), and give up (FR-144). Any anagram that keeps the hinted letters solves (FR-141, EC-47); one that moves a hinted letter is rejected (EC-48).
**Req:** FR-137, FR-138, FR-139, FR-140, FR-141, FR-142, FR-143, FR-144, NFR-19, EC-46, EC-47, EC-48, EC-49, AC-53, AC-54 · **Depends:** T-74 · **DoD:** with target `LISTEN`, `SILENT` solves and the other anagrams are listed (AC-53); after one hint, an anagram that moves the hinted letter returns `hint-moved` (AC-54, EC-48); a typed letter not left in the tray changes nothing (EC-46); 1,000 seeded puzzles per length have a scramble that differs from the target and is not a word, and a fixture where every order is a word draws another target (EC-49); a third hint does nothing; reshuffle keeps the multiset of tray letters; 100% branch coverage and the engine purity lint cover `src/engine/shuffle/**`.

### ✅ T-89 · WordShuffle storage and providers

Schemas and runtime guards for `wordgames:v1:shuffle:{prefs,stats,session,meta}`. A `recordGame` reducer, idempotent by game id, with overall and per-length stats: played, solved, given up, solved without hints, average hints per solve, streaks, and the last 50 games (FR-146). `ShuffleStatsProvider` and `ShuffleGameProvider` in `src/state/shuffle/` persist the target, scramble, tray, answer row and hints, and record each finished puzzle once (FR-147).
**Req:** FR-146, FR-147, AC-56 · **Depends:** T-88 · **DoD:** unit tests for a solve, a solve with hints, a give up that resets the streak, the averages, the 50-game cap and double-record idempotency; leaving mid-puzzle and returning restores the tray, the answer row and the hints exactly; a session whose target has left the answer list is discarded; resetting WordShuffle stats leaves every other game's stats byte-identical (AC-56).

### ✅ T-90 · WordShuffle view

`ShuffleView` in `src/components/shuffle/`: the answer row with hinted letters fixed in place, the tray of letter buttons, and **Hint**, **Reshuffle** and **Give up** buttons. A length selector. **Give up**, a new puzzle and a length change after any input ask to confirm through `ConfirmDialog` (FR-144, FR-147). `ShuffleResultPanel` with the FR-145 content and `useEnterToContinue` armed on mount.
**Req:** FR-145, US-37, AC-55 · **Depends:** T-89, T-52 · **DoD:** integration tests: typing and tapping tray letters build the same answer; Backspace returns a letter to the tray; a hint fixes a letter in the answer row; give up asks to confirm and shows the target and every other anagram; the Enter that submits the solving answer does not start a new puzzle and the next Enter does (AC-55); tray buttons are at least 44 × 44 px on a touch viewport, and the 6-letter tray fits at 320 px.

### ✅ T-91 · WordShuffle help, stats, accessibility and release

`ShuffleHelpModal` explaining the tray, reshuffle, hints and that any valid anagram wins (FR-147), with a decorative example. `ShuffleStatsModal` with overall and per-length views, recent games, the empty state and scoped reset actions. Label each tray button with its letter and remaining count, announce hints, reshuffles and solves, and label the answer row with hinted letters marked (A11Y-24). Add WordShuffle to the catalogue. Run axe, deploy, and fill the R5 addendum in `ACCEPTANCE.md`.
**Req:** FR-147, A11Y-24, US-38, AC-57 · **Depends:** T-90 · **DoD:** tests assert the tray button labels, the answer-row label and one announcement per hint, reshuffle and solve; the help dialog never opens by itself; with fixture stats every value matches a hand-computed expectation, and average hints per solve shows `—` with no solves; axe reports zero serious or critical issues on WordShuffle in both themes and both palettes (AC-57); Home shows the WordShuffle card and `#/shuffle` opens it (AC-45); the deployed site plays all six games; every R5 row in `ACCEPTANCE.md` is ticked with evidence.

---

## Phase 19 — WordDodge, release R6 (T-92 … T-95)

Adds WordDodge (SPEC §21). Rationale in ADR-039.

### ✅ T-92 · WordDodge engine

Pure code in `src/engine/dodge/`. Lengths 4, 5 and 6 with no guess limit (FR-148). `chooseReply(guess, candidates)` groups the candidates by `evaluateGuess`, keeps the largest group, and breaks a tie by fewer hits and then the smaller pattern (FR-149). `dodgeReducer` handles typing, `SUBMIT_GUESS` (narrowing the candidates and going to `revealing`), `REVEAL_COMPLETE` (won when the reply is all green), and `GIVE_UP` (FR-152). `restoreGame` replays a saved game's guesses against the answers (FR-153).
**Req:** FR-148, FR-149, FR-152, FR-153, NFR-19, AC-58 · **Depends:** T-74 · **DoD:** tie-break cases, a repeated-letter case and the empty-list throw are unit tests; a game narrows to one word and wins on the guess that is that word; a give up before the first guess does nothing; a replay with a changed answer list returns null; on the real lists a sensible strategy wins within 12 guesses at 4, 5 and 6 letters; 100% branch coverage and the engine purity lint cover `src/engine/dodge/**`.

### ✅ T-93 · WordDodge storage and providers

Schemas and runtime guards for `wordgames:v1:dodge:{prefs,stats,session}`, with no meta key. A `recordGame` reducer, idempotent by game id, with overall and per-length stats: played, won, streaks, the guesses distribution in grouped rows, average and fewest guesses, solve times, and the last 50 games (FR-155). `DodgeStatsProvider` and `DodgeProvider` in `src/state/dodge/` persist the guesses and the row being typed, replay them on restore, and record each finished game once (FR-153).
**Req:** FR-153, FR-155, AC-56 · **Depends:** T-92 · **DoD:** unit tests for a win, a give up that ends the streak, the averages, the grouped distribution, the 50-game cap, double-record idempotency and hostile input; leaving mid-game and returning restores the rows and the words left; a game that no longer replays or is of another length is discarded; resetting WordDodge stats leaves every other game's stats byte-identical (AC-56).

### ✅ T-94 · WordDodge view

`DodgeView` in `src/components/dodge/`: the shared `Board` and `Keyboard` with a board that grows and scrolls to its newest row, the words-left count, **Give up**, and a length selector. **Give up**, a new game and a length change after a guess ask to confirm through `ConfirmDialog` (FR-152, FR-153). `DodgeResultPanel` with the FR-154 content and `useEnterToContinue` armed on mount.
**Req:** FR-150, FR-151, FR-152, FR-154, US-39, AC-55 · **Depends:** T-93, T-52 · **DoD:** integration tests: a guess is coloured and the count falls; a rejected guess costs nothing; a game is won on the fourth guess with the fixture lists; give up asks and shows a word; the Enter that submits the winning guess does not start a new game and the next Enter does (AC-55).

### ✅ T-95 · WordDodge help, stats, accessibility and release

`DodgeHelpModal` explaining the adversary, the colours, the count and Give up (FR-156), with a decorative example. `DodgeStatsModal` with overall and per-length views, the grouped distribution, recent games, the empty state and scoped reset actions. Announce each guess after its reveal and the end of a game (A11Y-25). Add WordDodge to the catalogue. Run axe and fill the R6 addendum in `ACCEPTANCE.md`.
**Req:** FR-155, FR-156, A11Y-25, US-39, AC-57 · **Depends:** T-94 · **DoD:** tests assert one announcement per guess after its reveal and one for the end of a game; the help dialog never opens by itself; with fixture stats every value matches a hand-computed expectation and the averages show `—` with no wins; axe reports zero serious or critical issues on WordDodge in both themes and both palettes (AC-57); Home shows the WordDodge card and `#/dodge` opens it (AC-45); every R6 row in `ACCEPTANCE.md` is ticked with evidence.

---

## Dependency Summary

```
Phase 0 ──▶ Phase 1 ──▶ Phase 2 ──▶ Phase 4 ──▶ Phase 5 ──▶ Phase 6 ──▶ Phase 7 ──▶ Phase 8 ──▶ Phase 9 ──▶ Phase 10
              │            ▲           ▲
              └── Phase 3 ─┴───────────┘
```

Phase 2 (engine) and Phase 3 (storage) are independent of each other and can proceed in parallel; both must land before Phase 4.

Suite V1:

```
Phase 10 ──▶ T-50 ──┬──▶ Phase 11 (T-51 … T-57) ──┬──▶ Phase 13 ──▶ Phase 14
                    │                             │
                    └──▶ Phase 12 (T-58 … T-64) ──┘
```

T-50 (rename) comes first. After it, Phase 11 and Phase 12 can run in parallel; T-52 and T-61 have no dependencies and can start at any time. Phase 13 needs both.

Releases R2–R6:

```
Phase 14 ──▶ T-74 ──┬──▶ Phase 15 (R2 WordStack, T-75 … T-79)
                    │                  │
                    ├──▶ T-80 ─────────┴──▶ Phase 16 (R3 WordRange, T-81 … T-83)
                    │                                    │
                    ├──▶ T-84 ───────────────────────────┴──▶ Phase 17 (R4 WordCode, T-85 … T-87)
                    │                                                      │
                    ├──▶ T-88 ─────────────────────────────────────────────┴──▶ Phase 18 (R5 WordShuffle, T-89 … T-91)
                    │                                                                          │
                    └──▶ T-92 ─────────────────────────────────────────────────────────────────┴──▶ Phase 19 (R6 WordDodge, T-93 … T-95)
```

T-74 (game catalogue) comes first and is part of R2. The engines T-80, T-84, T-88 and T-92 depend only on T-74, so they can be built ahead of their phase. The releases still ship in order: R2, R3, R4, R5, R6. Each release task (T-79, T-83, T-87, T-91, T-95) adds its game to the catalogue, deploys, and fills that release's addendum in `ACCEPTANCE.md`. There are no feature flags.

## Out of Scope

No task in this roadmap builds anything listed in [`SPEC.md` §3 Non-Goals (Suite V1)](./SPEC.md#3-non-goals-suite-v1), or any idea in [Appendix A. Game Ideas Not Planned](./SPEC.md#appendix-a-game-ideas-not-planned). If a task seems to need one, stop and re-read those sections.
