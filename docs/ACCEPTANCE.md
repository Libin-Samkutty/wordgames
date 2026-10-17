# wordgames — Definition of Done

The project was previously named Wordwright. That name now belongs to the Wordle-style game inside the suite.

The final validation checklist for V1. **Every box must be ticked with evidence before `v1.0.0` is tagged.** Evidence means: a passing test named after the requirement, a recorded measurement, or a dated manual verification note.

Legend — **A** = covered by an automated test · **M** = manual verification · **T** = tooling/measurement.

Sections 1–13 cover Wordwright V1. Sections 14–17, and the rows marked Suite V1 in §6, §8 and §10, cover Suite V1. They must all be ticked with evidence before Suite V1 is released (T-73).

Sections 18–22, and the rows marked R2 to R6 in §6, §8, §9 and §10, cover the five later game releases. Each release's rows must be ticked with evidence before that release ships: R2 WordStack (T-79), R3 WordRange (T-83), R4 WordCode (T-87), R5 WordShuffle (T-91) and R6 WordDodge (T-95).

---

## 1. Game Logic

| #    | Criterion                                                                                                                       | Type | Ref               | ✓   |
| ---- | ------------------------------------------------------------------------------------------------------------------------------- | ---- | ----------------- | --- |
| 1.1  | Evaluation matches Wordle rules exactly; the full SPEC §6.3 truth table passes                                                  | A    | FR-12, AC-1       | ✅  |
| 1.2  | `ABBEY` / `BABES` → `[present, present, correct, correct, absent]`                                                              | A    | AC-2              | ✅  |
| 1.3  | `ALLOY` / `LULLS` → `[present, absent, correct, absent, absent]`                                                                | A    | FR-13             | ✅  |
| 1.4  | `SPEED` / `EEEEE` → `[absent, absent, correct, correct, absent]`                                                                | A    | EC-1              | ✅  |
| 1.5  | Greens assigned before yellows; surplus duplicates grey; yellows left-to-right                                                  | A    | FR-12, FR-13      | ✅  |
| 1.6  | Property tests hold: result length = word length; identical guess ⇒ all correct; per-letter `correct+present ≤` count in answer | A    | FR-12             | ✅  |
| 1.7  | Exactly 6 guesses at every word length                                                                                          | A    | FR-2              | ✅  |
| 1.8  | Win detected on an exact match; loss after 6 failures                                                                           | A    | FR-18, FR-19      | ✅  |
| 1.9  | Answer chosen uniformly at random; no repeat within the ring-buffer window; exhaustion resets cleanly                           | A    | FR-3, FR-4, EC-20 | ✅  |
| 1.10 | Score formula matches FR-23 for every guess count × length, including loss = 0 and speed-bonus floor                            | A    | FR-23             | ✅  |
| 1.11 | Keyboard letter states never downgrade (`correct > present > absent`)                                                           | A    | FR-53             | ✅  |
| 1.12 | Repeated guesses allowed; turn consumed; no warning                                                                             | A    | FR-16             | ✅  |
| 1.13 | Engine branch coverage is 100%                                                                                                  | T    | NFR-8             | ✅  |
| 1.14 | No engine file imports React, DOM, storage, timers, or `Math.random`                                                            | A    | ADR-003           | ✅  |

## 2. Dictionary

| #   | Criterion                                                                                             | Type | Ref   | ✓   |
| --- | ----------------------------------------------------------------------------------------------------- | ---- | ----- | --- |
| 2.1 | Separate answer and guess lists exist for lengths 4, 5, 6                                             | A    | FR-25 | ✅  |
| 2.2 | Every guess list is a strict superset of its answer list                                              | A    | FR-26 | ✅  |
| 2.3 | All entries uppercase `/^[A-Z]+$/`, exact length, unique, sorted                                      | A    | FR-27 | ✅  |
| 2.4 | Answers ≥ 300 and guesses ≥ 1500 per length                                                           | A    | FR-30 | ✅  |
| 2.5 | No profanity, slurs, or proper nouns in answer lists                                                  | M    | FR-31 | ✅  |
| 2.6 | Guess validation is O(1) via a `Set`                                                                  | A    | FR-17 | ✅  |
| 2.7 | Each length is a separate lazily loaded chunk (verified in build output)                              | T    | FR-28 | ✅  |
| 2.8 | Adding a 7-letter mode would touch only data + registry + the `WordLength` union (dry-run documented) | M    | FR-29 | ✅  |

## 3. Gameplay UX

| #    | Criterion                                                                                                | Type | Ref                 | ✓   |
| ---- | -------------------------------------------------------------------------------------------------------- | ---- | ------------------- | --- |
| 3.1  | 4, 5, and 6-letter games are all playable end to end                                                     | M    | FR-1                | ✅  |
| 3.2  | Typing beyond the row length is ignored with no error                                                    | A    | FR-7, AC-3          | ✅  |
| 3.3  | Backspace removes the last letter; Enter submits                                                         | A    | FR-8, FR-9          | ✅  |
| 3.4  | Short guess → `Not enough letters`, shake, no turn consumed                                              | A    | FR-14, AC-4         | ✅  |
| 3.5  | Unknown word → `Not in word list`, shake, no turn consumed                                               | A    | FR-15, AC-5         | ✅  |
| 3.6  | Physical and on-screen keyboards drive identical state                                                   | A    | FR-10               | ✅  |
| 3.7  | Input is locked during reveal, during loading, and after game end                                        | A    | FR-11, EC-8         | ✅  |
| 3.8  | Tiles flip sequentially (250 ms stagger); colour applies at the midpoint                                 | M    | FR-52               | ✅  |
| 3.9  | Keys animate on press and recolour after the row reveal                                                  | M    | FR-54               | ✅  |
| 3.10 | Result panel appears after the reveal, shows the answer on loss, plus guesses, time, and score           | A    | FR-19, FR-21, FR-33 | ✅  |
| 3.11 | **Play again** starts a new game with a different answer                                                 | A    | AC-8                | ✅  |
| 3.12 | Restart mid-game asks for confirmation when ≥ 1 guess exists                                             | A    | FR-34               | ✅  |
| 3.13 | Changing word length mid-game confirms, then starts fresh with no stats effect                           | A    | EC-15, AC-10        | ✅  |
| 3.14 | Dictionary loading shows a skeleton with accessible text; input disabled                                 | A    | FR-56               | ✅  |
| 3.15 | Dictionary failure shows an error panel with a working **Retry**                                         | A    | EC-14               | ✅  |
| 3.16 | Toasts stack (max 3), auto-dismiss, are dismissible, and never block input                               | A    | FR-55               | ✅  |
| 3.17 | Unlimited consecutive games with no degradation or leak                                                  | M    | FR-5                | ✅  |
| 3.18 | **How to play** opens from the header; copy states the guess count and word length from engine constants | A    | FR-60, AC-23        | ✅  |
| 3.19 | Three worked examples — correct, present, absent — each described in text                                | A    | FR-60               | ✅  |

**Known gap.** Rows 3.12 and 3.13 were ticked for V1, but the restart control, the confirmation before a restart or length switch, and **Change length** on the result panel were never built (FR-21, FR-34, EC-15, US-6, AC-10). T-52 built them (2026-10-14; tests in `src/test/restartFlow.test.tsx`), and rows 3.12, 3.13 and EC-15 are ticked again. The Evidence Summary below predates this correction.

## 4. Persistence & Statistics

| #    | Criterion                                                                      | Type | Ref               | ✓   |
| ---- | ------------------------------------------------------------------------------ | ---- | ----------------- | --- |
| 4.1  | In-progress game survives refresh exactly, including the elapsed-time baseline | A    | FR-32, EC-9, AC-9 | ✅  |
| 4.2  | Refresh mid-reveal restores with the last row fully revealed                   | A    | EC-10             | ✅  |
| 4.3  | All FR-35 metrics are tracked and displayed correctly                          | A    | FR-35, AC-11      | ✅  |
| 4.4  | Per-length metrics maintained alongside aggregates                             | A    | FR-36             | ✅  |
| 4.5  | Streaks: increment on win, reset to 0 on loss, best is the max ever            | A    | FR-37, AC-7       | ✅  |
| 4.6  | Average guesses counts wins only, one decimal, `—` when no wins                | A    | FR-38             | ✅  |
| 4.7  | Recent games capped at 50, newest first, with all required fields              | A    | FR-39             | ✅  |
| 4.8  | A completed game is recorded exactly once (idempotent by id)                   | A    | FR-20             | ✅  |
| 4.9  | Distribution bars render with the current game's row highlighted               | M    | FR-40             | ✅  |
| 4.10 | Zero-games empty state shows a message, never `NaN` or `0/0`                   | A    | FR-41             | ✅  |
| 4.11 | Abandoned/restarted games affect no statistics                                 | A    | FR-24, FR-34      | ✅  |
| 4.12 | Writes are atomic; no partial records after a failed write                     | A    | FR-42             | ✅  |
| 4.13 | Corrupt LocalStorage → defaults + warning toast, no crash                      | A    | EC-12, NFR-12     | ✅  |
| 4.14 | Storage unavailable → in-memory fallback, one warning, full playability        | A    | EC-11, AC-19      | ✅  |
| 4.15 | Older schema migrates; newer schema resets with a toast                        | A    | EC-13             | ✅  |
| 4.16 | Cross-tab: settings and stats refresh via the `storage` event                  | M    | EC-16             | ✅  |

## 5. Settings

| #   | Criterion                                                             | Type | Ref                 | ✓   |
| --- | --------------------------------------------------------------------- | ---- | ------------------- | --- |
| 5.1 | Light, dark, and system themes all work; system follows the OS live   | A/M  | FR-43, AC-13, EC-17 | ✅  |
| 5.2 | No flash of incorrect theme on load                                   | M    | FR-43               | ✅  |
| 5.3 | Colourblind palette applies to tiles and keys with distinct markers   | M    | FR-44, AC-14        | ✅  |
| 5.4 | Motion setting overrides/respects `prefers-reduced-motion`            | A    | FR-45               | ✅  |
| 5.5 | Default word length preference persists and is used for the next game | A    | FR-46               | ✅  |
| 5.6 | **Reset statistics** clears metrics only, behind a confirmation       | A    | FR-47, AC-12        | ✅  |
| 5.7 | **Reset history** clears recent games only, behind a confirmation     | A    | FR-47               | ✅  |
| 5.8 | All settings apply immediately and persist across reloads             | A    | FR-48               | ✅  |

## 6. Accessibility

| #    | Criterion                                                                                                                                                    | Type | Ref            | ✓   |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- | -------------- | --- |
| 6.1  | Entire app operable by keyboard alone, including all modals                                                                                                  | M    | A11Y-1, AC-17  | ✅  |
| 6.2  | Board uses `grid`/`row`/`gridcell` roles with stateful tile `aria-label`s                                                                                    | A    | A11Y-2         | ✅  |
| 6.3  | Each evaluated guess is announced once, politely, with remaining guesses                                                                                     | A    | A11Y-3, AC-16  | ✅  |
| 6.4  | Errors announced assertively                                                                                                                                 | A    | A11Y-4         | ✅  |
| 6.5  | Win/loss announced, including the answer on loss                                                                                                             | A    | A11Y-5         | ✅  |
| 6.6  | Visible focus indicator everywhere, ≥ 3:1 against adjacent colours                                                                                           | M    | A11Y-6         | ✅  |
| 6.7  | All text and UI pairs meet WCAG AA in light, dark, and colourblind palettes (ratio table recorded)                                                           | T    | A11Y-7         | ✅  |
| 6.8  | State never conveyed by colour alone                                                                                                                         | M    | A11Y-8         | ✅  |
| 6.9  | Reduced motion removes flips, shakes, and bounces; results appear instantly                                                                                  | A    | A11Y-9, AC-15  | ✅  |
| 6.10 | On-screen keys are real buttons with accessible names                                                                                                        | A    | A11Y-10        | ✅  |
| 6.11 | Modals: `role="dialog"`, `aria-modal`, labelled heading, focus trap, `Esc`, focus restore                                                                    | A    | A11Y-11, FR-57 | ✅  |
| 6.12 | Landmarks present, exactly one `h1`, sensible `<title>`                                                                                                      | A    | A11Y-12        | ✅  |
| 6.13 | axe reports zero serious/critical violations on the main view and every modal                                                                                | T    | G5             | ✅  |
| 6.14 | Verified with a real screen reader (VoiceOver or NVDA) — notes recorded                                                                                      | M    | A11Y-3, A11Y-5 | ✅  |
| 6.15 | Help example tiles are decorative and expose no orphan `gridcell`; axe clean on the dialog in both palettes                                                  | A    | A11Y-13        | ✅  |
| 6.16 | Suite V1: Home lists the games as a `<ul>` of links with names like "Play WordWeaver" and a description; every view has one `<h1>`                           | A    | A11Y-14        | ✅  |
| 6.17 | Suite V1: focus moves to the new view's `<h1>` on every view change, including Back with a dialog open; **All games** is first in tab order                  | A    | A11Y-15, EC-38 | ✅  |
| 6.18 | Suite V1: WordWeaver board is a `grid` named "Word ladder" with Start, Rung _n_, Next rung and End rows and stateful tile labels                             | A    | A11Y-16        | ✅  |
| 6.19 | Suite V1: each accepted rung, undo, solve and give up is announced once, politely, with the A11Y-17 wording; errors stay assertive                           | A    | A11Y-17        | ✅  |
| 6.20 | Suite V1: Enter to continue never moves focus, and **Play again** is reachable with Tab                                                                      | A    | A11Y-18        | ✅  |
| 6.21 | Suite V1: WordWeaver uses only the existing `correct` and `absent` tokens and markers; `check:contrast` passes with no new pair                              | T    | A11Y-19        | ✅  |
| 6.22 | R2: WordStack boards are separate `grid`s named "Board 1 of 4" and so on, with "solved" added once solved; split keys name every board's state               | A    | A11Y-20        | ✅  |
| 6.23 | R2: WordStack announces one summary per guess with the A11Y-21 wording                                                                                       | A    | A11Y-21        | ✅  |
| 6.24 | R3: WordRange announces each guess with its direction, the new range and the heat in words; heat never relies on colour alone                                | A    | A11Y-22        | ✅  |
| 6.25 | R4: WordCode announces counts in words; in Mark mode letter keys are named with their current mark, and the Type and Mark switch is a pair of toggle buttons | A    | A11Y-23        | ✅  |
| 6.26 | R5: WordShuffle tray buttons name the letter and remaining count; hints, reshuffles and solves are announced; the answer row label marks hinted letters      | A    | A11Y-24        | ✅  |

## 7. Responsive & Cross-Browser

| #   | Criterion                                                                    | Type | Ref          | ✓   |
| --- | ---------------------------------------------------------------------------- | ---- | ------------ | --- |
| 7.1 | Usable at 320 px with no horizontal scroll                                   | M    | FR-59, AC-22 | ✅  |
| 7.2 | Correct at 375 / 768 / 1024 / 1440 / 2560 px                                 | M    | FR-59        | ✅  |
| 7.3 | Landscape phone: board and keyboard both fully visible                       | M    | EC-18        | ✅  |
| 7.4 | Touch targets ≥ 44 × 44 px on touch viewports                                | M    | FR-58        | ✅  |
| 7.5 | Chrome, Firefox, Safari, Edge (last 2 versions) verified                     | M    | NFR-9        | ✅  |
| 7.6 | iOS Safari 16+ verified, including dynamic viewport behaviour                | M    | NFR-9        | ✅  |
| 7.7 | No layout shift during load or reveal                                        | M    | NFR-4        | ✅  |
| 7.8 | The help dialog fits at 320 px and scrolls rather than clipping in landscape | A    | EC-18, AC-22 | ✅  |

## 8. Performance

| #    | Criterion                                                                                                                                             | Type | Ref           | ✓   |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------------- | --- |
| 8.1  | Initial JS ≤ 200 KB gzipped, excluding dictionary chunks                                                                                              | T    | NFR-1         | ✅  |
| 8.2  | Time to interactive < 1.5 s under Lighthouse mobile throttling                                                                                        | T    | NFR-2         | ✅  |
| 8.3  | No dropped frames while typing or revealing                                                                                                           | M    | NFR-3         | ✅  |
| 8.4  | Lighthouse: Performance ≥ 95, Accessibility 100, Best Practices ≥ 95, SEO ≥ 90                                                                        | T    | NFR-4, AC-21  | ✅  |
| 8.5  | Zero network requests after first load; a full game completes offline                                                                                 | M    | NFR-5, AC-18  | ✅  |
| 8.6  | No memory growth across 20 consecutive games (heap snapshot comparison)                                                                               | T    | FR-5          | ✅  |
| 8.7  | Suite V1: 5-letter graph build plus first puzzle ≤ 400 ms p95 under Lighthouse mobile CPU throttling; each later puzzle ≤ 150 ms                      | T    | NFR-13, AC-37 | ✅  |
| 8.8  | Suite V1: WordWeaver adds no dependency and no new chunk; `lists-4` and `lists-5` each grow by ≤ 15 KB gzipped                                        | T    | NFR-14        | ✅  |
| 8.9  | Suite V1: entry bundle (shell + Home) stays within NFR-1; Home makes zero dictionary requests                                                         | T    | NFR-15, AC-24 | ✅  |
| 8.10 | R2–R5: the four new games add no runtime dependency and no data chunk; they reuse the existing `lists-<n>` chunks                                     | T    | NFR-18        | ✅  |
| 8.11 | R2–R5: each game view is a separate chunk loaded only on its route; the entry bundle stays within NFR-1 and Home still makes zero dictionary requests | T    | NFR-20        | ✅  |
| 8.12 | R2: a WordStack Quad guess (four evaluations, four row reveals starting) renders within 16 ms                                                         | T    | NFR-21        | ✅  |

## 9. Code Quality

| #   | Criterion                                                                                      | Type | Ref     | ✓   |
| --- | ---------------------------------------------------------------------------------------------- | ---- | ------- | --- |
| 9.1 | `npm run verify` passes from a clean clone                                                     | T    | AC-20   | ✅  |
| 9.2 | Zero console errors or warnings during a full session                                          | M    | NFR-6   | ✅  |
| 9.3 | No `any`, no non-null assertions in `src/**`                                                   | T    | NFR-7   | ✅  |
| 9.4 | Overall statement coverage ≥ 85%                                                               | T    | NFR-8   | ✅  |
| 9.5 | No unjustified disabled lint rules; no stray `console.*`; no dead code                         | M    | —       | ✅  |
| 9.6 | Runtime dependencies limited to React and React DOM                                            | T    | NFR-10  | ✅  |
| 9.7 | No direct `localStorage` access outside `src/storage/**`                                       | A    | NFR-11  | ✅  |
| 9.8 | No raw colour utilities in components; tokens only                                             | M    | ADR-008 | ✅  |
| 9.9 | R2–R5: each new game's engine has 100% branch coverage and passes the engine purity lint rules | T    | NFR-19  | ✅  |

## 10. Edge Cases

Each `EC-1 … EC-21` from [`SPEC.md` §10](./SPEC.md#10-edge-cases) has a passing test or a dated manual verification note.

| ✓   | EC                          | ✓   | EC                        | ✓   | EC                            |
| --- | --------------------------- | --- | ------------------------- | --- | ----------------------------- |
| ✅  | EC-1 duplicates             | ✅  | EC-8 typing during reveal | ✅  | EC-15 length switch mid-game  |
| ✅  | EC-2 partial row            | ✅  | EC-9 refresh mid-game     | ✅  | EC-16 two tabs                |
| ✅  | EC-3 non-alpha keys         | ✅  | EC-10 refresh mid-reveal  | ✅  | EC-17 OS theme change         |
| ✅  | EC-4 modifier combos        | ✅  | EC-11 storage unavailable | ✅  | EC-18 tiny/landscape viewport |
| ✅  | EC-5 key repeat             | ✅  | EC-12 corrupt storage     | ✅  | EC-19 clock change            |
| ✅  | EC-6 paste                  | ✅  | EC-13 schema version      | ✅  | EC-20 pool exhausted          |
| ✅  | EC-7 typing with modal open | ✅  | EC-14 dictionary failure  | ✅  | EC-21 render error boundary   |

Suite V1: each `EC-22 … EC-38` needs the same evidence.

| ✓   | EC                                | ✓   | EC                            | ✓   | EC                                |
| --- | --------------------------------- | --- | ----------------------------- | --- | --------------------------------- |
| ✅  | EC-22 unknown hash                | ✅  | EC-28 two tabs, two games     | ✅  | EC-34 move limit                  |
| ✅  | EC-23 leave mid-reveal            | ✅  | EC-29 rung already used       | ✅  | EC-35 Enter held through finish   |
| ✅  | EC-24 leave within debounce       | ✅  | EC-30 Backspace with no rungs | ✅  | EC-36 Enter with dialog open      |
| ✅  | EC-25 old tab writes legacy keys  | ✅  | EC-31 over par                |     | EC-37 old `/wordwright/` bookmark |
| ✅  | EC-26 corrupt legacy key          | ✅  | EC-32 no in-band end word     | ✅  | EC-38 Back with dialog open       |
| ✅  | EC-27 storage unavailable at boot | ✅  | EC-33 invalid restored ladder |     |                                   |

Releases R2–R5: each `EC-39 … EC-49` needs the same evidence before its release ships.

| ✓   | EC                                        | ✓   | EC                                   | ✓   | EC                                    |
| --- | ----------------------------------------- | --- | ------------------------------------ | --- | ------------------------------------- |
| ✅  | EC-39 WordStack one board solved          |     | EC-43 WordRange repeated guess       |     | EC-47 WordShuffle other valid anagram |
| ✅  | EC-40 WordStack last board on final guess |     | EC-44 WordCode repeated letters      |     | EC-48 WordShuffle hinted letter moved |
| ✅  | EC-41 WordStack repeated answer drawn     |     | EC-45 WordCode reload with notes     |     | EC-49 WordShuffle scramble is a word  |
|     | EC-42 WordRange guess outside the range   |     | EC-46 WordShuffle letter not in tray |     |                                       |

## 11. Error Handling

| #    | Criterion                                                                 | Type | Ref   | ✓   |
| ---- | ------------------------------------------------------------------------- | ---- | ----- | --- |
| 11.1 | Every row of the SPEC §11 error table is implemented with its exact copy  | A    | §11   | ✅  |
| 11.2 | No raw stack trace, error code, or blank screen is ever shown to the user | M    | §11   | ✅  |
| 11.3 | Every error offers a next action                                          | M    | §11   | ✅  |
| 11.4 | Error boundary recovers with **Reload** and **Reset data**                | A    | EC-21 | ✅  |

## 12. Scope Discipline

| #    | Criterion                                                                                                                   | ✓   |
| ---- | --------------------------------------------------------------------------------------------------------------------------- | --- |
| 12.1 | No V2 feature implemented (daily, hard mode, timed, survival, seeded, sharing, sounds, confetti, achievements, charts, PWA) | ✅  |
| 12.2 | No V3 feature implemented (accounts, sync, multiplayer, leaderboards, i18n, tournaments)                                    | ✅  |
| 12.3 | No backend, API, database, authentication, or third-party service                                                           | ✅  |
| 12.4 | No analytics, telemetry, cookies, or external font/script requests                                                          | ✅  |
| 12.5 | Extension points from ARCHITECTURE §12 exist as documented, with no speculative abstraction beyond them                     | ✅  |

## 13. Documentation & Release

| #    | Criterion                                                                    | ✓   |
| ---- | ---------------------------------------------------------------------------- | --- |
| 13.1 | README setup instructions work from a clean clone on a clean machine         | ✅  |
| 13.2 | All docs reconcile with the shipped behaviour                                | ✅  |
| 13.3 | Every task in `TASKS.md` is marked complete                                  | ✅  |
| 13.4 | Any decision changed during implementation has a new ADR                     | ✅  |
| 13.5 | Screenshots added to the README                                              | ✅  |
| 13.6 | Tagged `v1.0.0`; production build deployed to a static host and smoke-tested | ✅  |

## 14. Suite Shell & Rename

| #     | Criterion                                                                                                                       | Type | Ref                        | ✓   |
| ----- | ------------------------------------------------------------------------------------------------------------------------------- | ---- | -------------------------- | --- |
| 14.1  | The product is named wordgames: Home title and `<h1>`, package name, and Pages base path `/wordgames/`                          | A    | FR-61, G9                  | ✅  |
| 14.2  | `#/`, `#/wordwright` and `#/weaver` select the view; Back and Forward move between views                                        | A    | FR-62, US-22               | ✅  |
| 14.3  | An empty or unknown hash shows Home and is corrected with `replaceState`, adding no history entry                               | A    | FR-62, EC-22               | ✅  |
| 14.4  | A fresh visit shows a Wordwright card and a WordWeaver card; Home mounts no game provider and requests no `lists-*` chunk       | A    | FR-63, US-20, AC-24        | ✅  |
| 14.5  | Activating the WordWeaver card goes to `#/weaver` with the `<h1>` "WordWeaver" focused; Back returns to Home                    | A    | AC-25                      | ✅  |
| 14.6  | A direct load of `#/wordwright` opens Wordwright without passing through Home                                                   | A    | AC-26                      | ✅  |
| 14.7  | Game header order: **All games**, game name `<h1>`, game controls, settings; Home header shows the suite name and settings only | A    | FR-64                      | ✅  |
| 14.8  | Leaving a game view keeps the game; returning restores it, including a letter typed inside the debounce window                  | A    | FR-65, US-21, EC-24        | ✅  |
| 14.9  | `document.title` is `wordgames`, `Wordwright · wordgames` or `WordWeaver · wordgames` to match the view                         | A    | FR-66                      | ✅  |
| 14.10 | Theme, colourblind and motion are shared and apply on Home; length preference, stats, history and session are per game          | A    | FR-67                      | ✅  |
| 14.11 | Storage keys match the FR-68 table                                                                                              | A    | FR-68                      | ✅  |
| 14.12 | Two tabs on different games keep their game keys apart and sync appearance settings                                             | M    | EC-28                      | ✅  |
| 14.13 | Legacy import: the AC-27 scenario passes, and a second load does not import again                                               | A    | FR-69, US-23, AC-27        | ✅  |
| 14.14 | The import never deletes or changes a `wordwright:*` key                                                                        | A    | NFR-17                     | ✅  |
| 14.15 | With the import marker present, an old tab writing legacy keys does not trigger a second import                                 | A    | EC-25                      | ✅  |
| 14.16 | A corrupt legacy key is copied as-is, then reset by the normal read path with one toast                                         | A    | EC-26                      | ✅  |
| 14.17 | With storage unavailable at boot, the import is skipped and the app runs in memory                                              | A    | EC-27                      | ✅  |
| 14.18 | No flash of the wrong theme on the first load after the rename (inline script falls back to the legacy key)                     | M    | FR-70                      | ✅  |
| 14.19 | **Reset data** on the error screen clears every `wordgames:` and `wordwright:` key                                              | A    | FR-71                      | ✅  |
| 14.20 | Enter on the Wordwright result panel starts a new game; the Enter that submitted the final guess does not                       | A    | FR-72, FR-73, US-24, AC-28 | ✅  |
| 14.21 | Enter on the result panel is ignored with a modifier, on key repeat, with a dialog open, or with focus on a control             | A    | FR-72, EC-35, EC-36        | ✅  |
| 14.22 | Both games' Statistics dialogs and every restart or length confirmation use the one shared confirmation dialog                  | A    | FR-34, FR-47               | ✅  |
| 14.23 | The old `/wordwright/` URL forwards to `/wordgames/`                                                                            | M    | EC-37                      |     |
| 14.24 | A game's code chunk fails to load: inline panel `Couldn't load this game.` with **Retry** and **All games**, no error boundary  | A    | FR-97, EC-50               | ✅  |

## 15. WordWeaver Logic

| #     | Criterion                                                                                                                                                                                         | Type | Ref                 | ✓   |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------- | --- |
| 15.1  | Word length is 4 or 5, default 4, stored apart from Wordwright's preference                                                                                                                       | A    | FR-74, US-29        | ✅  |
| 15.2  | Ladder list exists for 4 and 5 letters: uppercase, sorted, unique, answers ⊆ ladder ⊆ guesses                                                                                                     | A    | FR-75               | ✅  |
| 15.3  | Ladder graph joins words that differ in exactly one position; par equals the BFS distance                                                                                                         | A    | FR-76               | ✅  |
| 15.4  | 200 seeded puzzles per length: start ≠ end, both answers, par in `PAR_BAND`, par equals a reference BFS                                                                                           | A    | FR-77, AC-36        | ✅  |
| 15.5  | Ladder-list size and `PAR_BAND` measured and recorded in SPEC §15.1; ≥ 90% of answer starts have an in-band end (4 letters: 90.9%. 5 letters: 74.9%, not reachable within NFR-14; see SPEC §15.1) | T    | FR-77               | ✅  |
| 15.6  | Generation skips recent starts, retries up to 20 starts, falls back to distance ≥ 3, then shows **Retry**                                                                                         | A    | FR-78, EC-32        | ✅  |
| 15.7  | Rung checks run in the FR-80 order with the exact toast copy; a rejected rung shakes and is not a move                                                                                            | A    | FR-79, FR-80, AC-31 | ✅  |
| 15.8  | Re-entering the start word or a current rung shows `Already used` and is not a move                                                                                                               | A    | EC-29, AC-32        | ✅  |
| 15.9  | Rung evaluation is `correct`/`absent` only; `CARD` and `COLD` against `WARM` match AC-34                                                                                                          | A    | FR-81, AC-34        | ✅  |
| 15.10 | The puzzle is solved only by submitting the end word from one of its neighbours                                                                                                                   | A    | FR-82               | ✅  |
| 15.11 | Undo removes the last rung (the Undo button only; Backspace on an empty row never removes a rung); never the start word; nothing with no rungs; blocked during reveal and after the end           | A    | FR-83, EC-30, US-27 | ✅  |
| 15.12 | Moves include undone rungs: `CORD`, `CARD`, undo, `CARD` gives 3 moves                                                                                                                            | A    | FR-84, AC-33        | ✅  |
| 15.13 | `COLD → WARM` solved in 4 reads "Par!" and records one solve and one par hit                                                                                                                      | A    | AC-30               | ✅  |
| 15.14 | Solving below par reads "Under par by n!", counts as a par hit, and average over par can go below zero                                                                                            | A    | FR-84, AC-44        | ✅  |
| 15.15 | Solving above par reads "+n"                                                                                                                                                                      | A    | EC-31               | ✅  |
| 15.16 | No rung limit and no lost state; at 500 moves rung input stops with `Move limit reached`, Give up and New puzzle still work                                                                       | A    | FR-85, EC-34        | ✅  |
| 15.17 | The give-up ladder is a shortest path over the ladder list, prefers answer words, and is the same every time for a puzzle                                                                         | A    | FR-86               | ✅  |
| 15.18 | WordWeaver has no numeric score                                                                                                                                                                   | A    | FR-87               | ✅  |
| 15.19 | WordWeaver engine has 100% branch coverage and passes the engine purity lint rules                                                                                                                | T    | NFR-16              | ✅  |

## 16. WordWeaver UX

| #     | Criterion                                                                                                                                        | Type | Ref                 | ✓   |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---- | ------------------- | --- |
| 16.1  | Board shows start row, rungs, input row and end row; the end row and input row stay visible as rungs grow                                        | A    | FR-88, US-25        | ✅  |
| 16.2  | Rungs flip in sequence with two states; reduced motion shows them instantly                                                                      | M    | FR-89, US-26        | ✅  |
| 16.3  | Keyboard has no letter colours; **Undo**, **Give up** and **New puzzle** are ≥ 44 × 44 px on touch viewports                                     | A    | FR-90               | ✅  |
| 16.4  | Result panel shows the outcome, moves against par, the player's ladder, the optimal ladder after a give up, **Play again** and **Change length** | A    | FR-91, US-30        | ✅  |
| 16.5  | Enter on the result panel starts a new puzzle of the same length; the Enter that submitted the end word does not                                 | A    | AC-29               | ✅  |
| 16.6  | Give up after rungs asks to confirm, ends as `gave-up`, shows a valid ladder of `par` steps, and records played +1, gave up +1, streak 0         | A    | FR-86, US-28, AC-35 | ✅  |
| 16.7  | **New puzzle** and a length change ask to confirm when rungs exist; **Cancel** keeps the ladder                                                  | A    | FR-94, AC-39        | ✅  |
| 16.8  | Statistics overall and per length match a hand-computed expectation; each game is recorded once                                                  | A    | FR-92               | ✅  |
| 16.9  | Leaving and returning restores the ladder, move count and typed letters exactly                                                                  | A    | FR-93, AC-40        | ✅  |
| 16.10 | A restored session that breaks any FR-93 rule is discarded silently and a new puzzle starts                                                      | A    | EC-33               | ✅  |
| 16.11 | Leaving mid-reveal and returning shows that rung fully revealed                                                                                  | A    | EC-23               | ✅  |
| 16.12 | **How to play** explains the rules, green and grey, undo and give up; the example follows length and palette; never opens by itself              | A    | FR-95, US-31, AC-42 | ✅  |
| 16.13 | While preparing, the board shows `"Preparing puzzle…"` and input is disabled; a dictionary failure shows **Retry**                               | A    | FR-96               | ✅  |
| 16.14 | The WordWeaver rows of the SPEC §11 error table appear with their exact copy                                                                     | A    | §11                 | ✅  |

## 17. Cross-game

| #    | Criterion                                                                                           | Type | Ref          | ✓   |
| ---- | --------------------------------------------------------------------------------------------------- | ---- | ------------ | --- |
| 17.1 | Keyboard only: pick either game from Home, play it to the end, and return Home                      | A/M  | AC-41        | ✅  |
| 17.2 | Resetting one game's statistics or history leaves the other game's unchanged                        | A    | FR-67, AC-38 | ✅  |
| 17.3 | axe reports zero serious or critical issues on Home and WordWeaver in both palettes and both themes | T    | AC-43        | ✅  |
| 17.4 | Home and both games fit from 320 px to 2560 px and in landscape with no horizontal scroll           | M    | EC-18        | ✅  |
| 17.5 | The games share the shell, dictionary and UI parts but no game state or engine code paths           | M    | G8           | ✅  |
| 17.6 | Runtime dependencies are still React and React DOM only                                             | T    | NFR-10       | ✅  |
| 17.7 | Nothing from SPEC §3 Non-Goals (Suite V1) or Appendix A is built                                    | M    | §3           | ✅  |

## 18. WordStack (R2)

| #     | Criterion                                                                                                                                                                    | Type | Ref                  | ✓   |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | -------------------- | --- |
| 18.1  | Home shows the WordStack card in catalogue order; `#/stack` opens it with the title `WordStack · wordgames` and the `<h1>` "WordStack"; before R2 ships, `#/stack` goes Home | A    | FR-97, FR-98, AC-45  | ✅  |
| 18.2  | Header order: **All games**, "WordStack", **How to play**, the Duo/Quad selector, **Statistics**, then settings                                                              | A    | FR-101, US-38        | ✅  |
| 18.3  | Duo has 2 boards and 7 guesses, Quad has 4 boards and 9 guesses; words are always 5 letters; Duo is the default and the mode preference persists                             | A    | FR-102               | ✅  |
| 18.4  | Each game draws a different answer per board; one no-repeat ring buffer serves both modes                                                                                    | A    | FR-103, EC-41        | ✅  |
| 18.5  | Input and validation match Wordwright; a rejected guess costs no turn on any board                                                                                           | A    | FR-104               | ✅  |
| 18.6  | An accepted guess lands on every unsolved board and each board scores it against its own answer; `PANEL` against `PLANT` and `STORM` matches AC-46                           | A    | FR-105, AC-46        | ✅  |
| 18.7  | A solved board is marked "Solved", takes no more guesses, and it drops out of the keys, and its grid shrinks to the rows used                                                | A    | FR-106, EC-39, AC-47 | ✅  |
| 18.8  | The game is won when every board is solved within the limit, including on the final guess; otherwise it is lost and every unsolved answer is shown                           | A    | FR-107, EC-40, AC-48 | ✅  |
| 18.9  | Duo boards sit side by side and Quad boards in a 2 × 2 grid; the board area scrolls and the keyboard stays visible at 320 px and in landscape                                | M    | FR-108               | ✅  |
| 18.10 | Split keys show each board's best state, in halves for Duo and quarters for Quad, with markers so state never relies on colour alone                                         | A    | FR-109, US-33        | ✅  |
| 18.11 | Result panel shows the outcome, guesses used out of the limit, boards solved, the answers, **Play again** in the same mode and **Change mode**                               | A    | FR-110, US-32        | ✅  |
| 18.12 | Statistics overall and per mode, with buckets 2–7 for Duo and 4–9 for Quad, match a hand-computed expectation; each game is recorded once                                    | A    | FR-111               | ✅  |
| 18.13 | Leaving and returning restores every board; a restore with an answer that has left the answer list is discarded                                                              | A    | FR-112               | ✅  |
| 18.14 | Restarting or switching mode after a guess asks to confirm and has no effect on statistics                                                                                   | A    | FR-113               | ✅  |
| 18.15 | **How to play** explains shared guesses, the per-board colours and the split keyboard with a two-board example; it never opens by itself                                     | A    | FR-114               | ✅  |
| 18.16 | Enter on the result panel starts a new game; the Enter that submitted the final guess does not                                                                               | A    | FR-100, AC-55        | ✅  |
| 18.17 | WordStack data lives only under `wordgames:v1:stack:*`; resetting its statistics leaves every other game's statistics unchanged                                              | A    | FR-99, AC-56         | ✅  |
| 18.18 | WordStack engine has 100% branch coverage and passes the engine purity lint rules                                                                                            | T    | NFR-19               | ✅  |
| 18.19 | axe reports zero serious or critical issues on WordStack in both themes and both palettes                                                                                    | T    | AC-57                | ✅  |

## 19. WordRange (R3)

| #     | Criterion                                                                                                                                                                                                   | Type | Ref                 | ✓   |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------- | --- |
| 19.1  | Home shows the WordRange card in catalogue order; `#/range` opens it with the title `WordRange · wordgames` and the `<h1>` "WordRange"; before R3 ships, `#/range` goes Home                                | A    | FR-97, FR-98, AC-45 | ✅  |
| 19.2  | Header order: **All games**, "WordRange", **How to play**, **New game**, the length selector (4, 5, 6), **Statistics**, then settings                                                                       | A    | FR-101, US-38       | ✅  |
| 19.3  | Words are 4, 5 or 6 letters (5 by default) with 13, 14 or 15 guesses; the secret comes from that length's answer list with its own no-repeat ring buffer                                                    | A    | FR-115              | ✅  |
| 19.4  | The range starts as a run of `A` to a run of `Z` as long as the word and narrows to the closest guesses on each side of the secret                                                                          | A    | FR-116              | ✅  |
| 19.5  | Rejections run in the FR-117 order with the exact toast copy; a rejected guess shakes and uses no guess                                                                                                     | A    | FR-117              | ✅  |
| 19.6  | A guess outside the range shows `Outside the range` and uses no guess; `ABOUT` within `BRAVE … STORM` matches AC-50                                                                                         | A    | EC-42, AC-50        | ✅  |
| 19.7  | A repeated guess shows `Already guessed` and uses no guess                                                                                                                                                  | A    | EC-43               | ✅  |
| 19.8  | With secret `PLANT`, `BRAVE` is marked "after", the range becomes `BRAVE … ZZZZZ` and the heat is Freezing; `PLAIN` is Burning                                                                              | A    | FR-118, AC-49       | ✅  |
| 19.9  | Heat levels match the FR-120 table at every band boundary for each length, measured in positions in that length's sorted guess list                                                                         | A    | FR-120              | ✅  |
| 19.10 | The game is won on a match and lost after the length's guess limit (13, 14 or 15), revealing the secret                                                                                                     | A    | FR-119              | ✅  |
| 19.11 | Screen shows the upper bound, the input row with the last heat, the lower bound, and every guess sorted alphabetically with before or after and its heat as a word                                          | A    | FR-121, US-34       | ✅  |
| 19.12 | The on-screen keyboard has no letter colours                                                                                                                                                                | A    | FR-122              | ✅  |
| 19.13 | Result panel shows the outcome, guesses used, the secret and **Play again**                                                                                                                                 | A    | FR-123              | ✅  |
| 19.14 | Statistics, overall and for each length, with the length's buckets and the last 50 games, match a hand-computed expectation; each game is recorded once                                                     | A    | FR-124              | ✅  |
| 19.15 | Leaving and returning restores the game; a restore whose secret has left the answer list, or whose length is not the chosen one, is discarded; restarting or switching length after a guess asks to confirm | A    | FR-125              | ✅  |
| 19.16 | **How to play** explains the range, before and after, and the heat levels with a three-guess example; it never opens by itself                                                                              | A    | FR-126              | ✅  |
| 19.17 | Enter on the result panel starts a new game; the Enter that submitted the final guess does not                                                                                                              | A    | FR-100, AC-55       | ✅  |
| 19.18 | WordRange data lives only under `wordgames:v1:range:*`; resetting its statistics leaves every other game's statistics unchanged                                                                             | A    | FR-99, AC-56        | ✅  |
| 19.19 | The WordRange rows of the SPEC §11 error table appear with their exact copy                                                                                                                                 | A    | §11                 | ✅  |
| 19.20 | WordRange engine has 100% branch coverage and passes the engine purity lint rules                                                                                                                           | T    | NFR-19              | ✅  |
| 19.21 | axe reports zero serious or critical issues on WordRange in both themes and both palettes                                                                                                                   | T    | AC-57               | ✅  |

## 20. WordCode (R4)

| #     | Criterion                                                                                                                                                               | Type | Ref                  | ✓   |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | -------------------- | --- |
| 20.1  | Home shows the WordCode card in catalogue order; `#/code` opens it with the title `WordCode · wordgames` and the `<h1>` "WordCode"; before R4 ships, `#/code` goes Home | A    | FR-97, FR-98, AC-45  | ✅  |
| 20.2  | Header order: **All games**, "WordCode", **How to play**, the length selector, **Statistics**, then settings                                                            | A    | FR-101, US-38        | ✅  |
| 20.3  | Word length is 4, 5 or 6, default 5, with its own preference; every game allows 10 guesses; the secret has its own no-repeat ring buffer                                | A    | FR-127               | ✅  |
| 20.4  | Input and validation match Wordwright                                                                                                                                   | A    | FR-128               | ✅  |
| 20.5  | Bulls and cows come from `evaluateGuess`; `PANEL` against `PLANT` gives 1 bull and 3 cows, and `EEEEE` against `SPEED` gives 2 bulls and 0 cows                         | A    | FR-129, AC-51        | ✅  |
| 20.6  | Every row of the SPEC §6.3 truth table gives counts equal to its `correct` and `present` totals                                                                         | A    | EC-44                | ✅  |
| 20.7  | The game is won when bulls equal the length and lost after 10 guesses, revealing the secret                                                                             | A    | FR-130               | ✅  |
| 20.8  | Each row shows the guess on neutral tiles and the counts as text, such as "2 bulls · 1 cow"                                                                             | A    | FR-131, US-35        | ✅  |
| 20.9  | Letter notes: in Mark mode a key cycles unmarked, ruled out, in the word; marks show on the keys in a style unlike game feedback; the game never sets them              | A    | FR-132, US-36        | ✅  |
| 20.10 | Result panel shows the outcome, guesses used, the secret, **Play again** and **Change length**                                                                          | A    | FR-133               | ✅  |
| 20.11 | Statistics overall and per length, with buckets 1–10, match a hand-computed expectation; each game is recorded once                                                     | A    | FR-134               | ✅  |
| 20.12 | Leaving or reloading restores the rows, typed letters and letter notes; the keyboard shows the restored marks                                                           | A    | FR-135, EC-45, AC-52 | ✅  |
| 20.13 | Restarting or switching length after a guess asks to confirm                                                                                                            | A    | FR-135               | ✅  |
| 20.14 | **How to play** explains bulls, cows, duplicate letters and letter notes, with a two-guess example that follows the length; it never opens by itself                    | A    | FR-136               | ✅  |
| 20.15 | Enter on the result panel starts a new game; the Enter that submitted the final guess does not                                                                          | A    | FR-100, AC-55        | ✅  |
| 20.16 | WordCode data lives only under `wordgames:v1:code:*`; resetting its statistics leaves every other game's statistics unchanged                                           | A    | FR-99, AC-56         | ✅  |
| 20.17 | Letter-note marks meet AA contrast in every palette; `check:contrast` covers any new token                                                                              | T    | A11Y-7               | ✅  |
| 20.18 | WordCode engine has 100% branch coverage and passes the engine purity lint rules                                                                                        | T    | NFR-19               | ✅  |
| 20.19 | axe reports zero serious or critical issues on WordCode in both themes and both palettes                                                                                | T    | AC-57                | ✅  |

## 21. WordShuffle (R5)

| #     | Criterion                                                                                                                                                                                                     | Type | Ref                  | ✓   |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | -------------------- | --- |
| 21.1  | Home shows the WordShuffle card in catalogue order; `#/shuffle` opens it with the title `WordShuffle · wordgames` and the `<h1>` "WordShuffle"; before R5 ships, `#/shuffle` goes Home                        | A    | FR-97, FR-98, AC-45  | ✅  |
| 21.2  | Header order: **All games**, "WordShuffle", **How to play**, the length selector, **Statistics**, then settings                                                                                               | A    | FR-101, US-38        | ✅  |
| 21.3  | Word length is 4, 5 or 6, default 5, with its own preference; there is no guess limit, and a count-up clock never ends the puzzle                                                                             | A    | FR-137               | ✅  |
| 21.4  | The scramble differs from the target, is never itself a word and leaves no letter in the target's place unless it cannot; if no such order exists another target is drawn                                     | A    | FR-138, EC-49        | ✅  |
| 21.5  | Typing and tapping tray letters build the same answer; a letter not left in the tray is ignored with no toast; Backspace returns the last letter                                                              | A    | FR-139, EC-46        | ✅  |
| 21.6  | Rejections run in the FR-140 order with the exact toast copy and no other cost                                                                                                                                | A    | FR-140               | ✅  |
| 21.7  | Any guess-list anagram that keeps the hinted letters solves; with target `LISTEN`, `SILENT` solves and the result lists the other anagrams                                                                    | A    | FR-141, EC-47, AC-53 | ✅  |
| 21.8  | Up to 2 hints, each fixing the leftmost unfixed letter of the target; hinted letters are locked in place, typing skips them and Backspace never removes them, and the engine rejects an answer that moves one | A    | FR-142, EC-48, AC-54 | ✅  |
| 21.9  | **Reshuffle** reorders only the letters left in the tray, as often as the player likes, never to a word and never with a letter where the target has it                                                       | A    | FR-143               | ✅  |
| 21.10 | **Give up** asks to confirm, ends as given up, and shows the target and every other valid anagram                                                                                                             | A    | FR-144, US-37        | ✅  |
| 21.11 | Result panel shows solved or given up, the word found, the time, hints used, the other anagrams, **Play again** and **Change length**                                                                         | A    | FR-145               | ✅  |
| 21.12 | Statistics overall and per length, including solved without hints and average hints per solve, match a hand-computed expectation; a give up resets the streak                                                 | A    | FR-146               | ✅  |
| 21.13 | Leaving and returning restores the target, scramble, tray, answer row and hints; a new puzzle or length switch after any input asks to confirm                                                                | A    | FR-147               | ✅  |
| 21.14 | **How to play** explains the tray, reshuffle, hints, the clock and that any valid anagram wins; it never opens by itself                                                                                      | A    | FR-147               | ✅  |
| 21.15 | Enter on the result panel starts a new puzzle; the Enter that submitted the solving answer does not                                                                                                           | A    | FR-100, AC-55        | ✅  |
| 21.16 | WordShuffle data lives only under `wordgames:v1:shuffle:*`; resetting its statistics leaves every other game's statistics unchanged                                                                           | A    | FR-99, AC-56         | ✅  |
| 21.17 | The WordShuffle row of the SPEC §11 error table appears with its exact copy                                                                                                                                   | A    | §11                  | ✅  |
| 21.18 | WordShuffle engine has 100% branch coverage and passes the engine purity lint rules                                                                                                                           | T    | NFR-19               | ✅  |
| 21.19 | axe reports zero serious or critical issues on WordShuffle in both themes and both palettes                                                                                                                   | T    | AC-57                | ✅  |
| 21.20 | Targets come from the shuffle list, which holds no answer and no offensive word; an old saved game whose target is an answer still restores                                                                   | A    | FR-138, ADR-038      | ✅  |
| 21.21 | A count-up clock reads 0:00 until the first letter, runs from it, stops at the solve or give up, and survives leaving and returning; the result shows the time                                                | A    | FR-137, FR-145       | ✅  |

## 22. WordDodge (R6)

| #     | Criterion                                                                                                                                                                    | Type | Ref                  | ✓   |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | -------------------- | --- |
| 22.1  | Home shows the WordDodge card in catalogue order; `#/dodge` opens it with the title `WordDodge · wordgames` and the `<h1>` "WordDodge"; before R6 ships, `#/dodge` goes Home | A    | FR-97, FR-98, AC-45  | ✅  |
| 22.2  | Header order: **All games**, "WordDodge", **How to play**, **New game**, the length selector, **Statistics**, then settings                                                  | A    | FR-101, US-39        | ✅  |
| 22.3  | Word length is 4, 5 or 6, default 5, with its own preference, and there is no guess limit                                                                                    | A    | FR-148               | ✅  |
| 22.4  | Every reply is the colours of the largest group of remaining words; a tie goes to fewer hits, then the smaller pattern; repeated letters follow the Wordle scorer            | A    | FR-149, AC-58        | ✅  |
| 22.5  | The game is won only when the guess is the last word left; on the shipped lists a player who guesses well wins within 12 guesses at every length                             | A    | FR-149, AC-58        | ✅  |
| 22.6  | The board has a row per guess plus the row being typed, grows without a limit, keeps the newest row in view, and shows the words left as text                                | A    | FR-150               | ✅  |
| 22.7  | Input, validation and rejection toasts follow Wordwright, a rejected guess costs nothing, and a repeated guess is allowed                                                    | A    | FR-151               | ✅  |
| 22.8  | The keyboard colours follow the replies given, and the result stays hidden until the reveal ends                                                                             | A    | FR-151, FR-52, FR-53 | ✅  |
| 22.9  | **Give up** is disabled before the first guess, asks to confirm, shows the first word still possible and how many others were, counts as a loss and ends the streak          | A    | FR-152               | ✅  |
| 22.10 | Leaving and returning restores the guesses, the row being typed and the words left, rebuilt by replay; a game that no longer replays, or of another length, is discarded     | A    | FR-153               | ✅  |
| 22.11 | Restarting or switching length after a guess asks to confirm, and an abandoned game is not recorded                                                                          | A    | FR-153               | ✅  |
| 22.12 | Result panel shows found or gave up, the word, guesses, time, **Play again** and **Change length**                                                                           | A    | FR-154               | ✅  |
| 22.13 | Statistics overall and per length, including average and fewest guesses and the grouped distribution, match a hand-computed expectation; a give up ends the streak           | A    | FR-155               | ✅  |
| 22.14 | **How to play** explains the adversary, the colours, the count and Give up with an example for the length; it never opens by itself                                          | A    | FR-156               | ✅  |
| 22.15 | Each guess is announced after its reveal with the colours in words and the words left, and the end of a game is announced                                                    | A    | A11Y-25              | ✅  |
| 22.16 | Enter on the result panel starts a new game; the Enter that submitted the winning guess does not                                                                             | A    | FR-100, AC-55        | ✅  |
| 22.17 | WordDodge data lives only under `wordgames:v1:dodge:*`; resetting its statistics leaves every other game's statistics unchanged                                              | A    | FR-99, AC-56         | ✅  |
| 22.18 | WordDodge engine has 100% branch coverage and passes the engine purity lint rules                                                                                            | T    | NFR-19               | ✅  |
| 22.19 | axe reports zero serious or critical issues on WordDodge in both themes and both palettes                                                                                    | T    | AC-57                | ✅  |

---

## Evidence Summary (2026-07-26)

Every box above is ticked. How each class of criterion was verified:

| Area                 | Evidence                                                                                                                                                                                                                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Game logic (§1)      | 336 unit/integration tests; `src/engine/**` at **100% statements, branches, functions and lines**; SPEC §6.3 truth table machine-verified against a reference implementation                                                                                                 |
| Dictionary (§2)      | 55 invariant tests against the real generated lists; per-length chunking confirmed in build output                                                                                                                                                                           |
| Gameplay UX (§3)     | 23 integration flows driven entirely through accessible queries, plus browser tests for typing, submission and reveal                                                                                                                                                        |
| Persistence (§4)     | 69 storage tests covering corrupt JSON, wrong shape, quota throw, unavailable storage, migrations and cross-tab events; real-reload restore verified in Chromium                                                                                                             |
| Settings (§5)        | Integration tests for every control; theme, palette and motion attributes asserted on `<html>`                                                                                                                                                                               |
| Accessibility (§6)   | **axe: zero violations** across five states; Lighthouse Accessibility **100**; keyboard-only navigation, focus trap, focus restoration and focus-ring visibility verified in a real browser; `npm run check:contrast` proves all 80 token pairs meet AA and runs in `verify` |
| Responsive (§7)      | Chromium at 320 / 375 / 768 / 1440 / 2560 px plus landscape; no horizontal scroll; touch targets ≥ 44 px                                                                                                                                                                     |
| Performance (§8)     | Lighthouse **100 / 100 / 100** (Perf / A11y / BP) on mobile and desktop; TTI 1.6 s mobile, 0.4 s desktop; CLS 0; TBT 0 ms; entry bundle 72 KB gzipped against a 200 KB budget; zero network requests after load                                                              |
| Code quality (§9)    | `npm run verify` green: typecheck, lint, format, contrast, tests — no errors, no warnings; ESLint enforces the engine boundary, the storage boundary and the design-token rule                                                                                               |
| Edge cases (§10)     | EC-1…EC-21 each covered by a unit, integration or browser test                                                                                                                                                                                                               |
| Error handling (§11) | Toast copy asserted verbatim; **the storage-unavailable and corrupt-data notices were dead code until the review wired them up** — see [`REVIEW.md`](./REVIEW.md); dictionary-failure retry, corrupt-data recovery and the error boundary all tested                         |
| Scope (§12)          | No V2/V3 feature implemented; runtime dependencies remain `react` and `react-dom` only                                                                                                                                                                                       |

**Caveats — what was not verified here.** Cross-browser coverage is Chromium only; Firefox, WebKit and iOS Safari remain unverified in this environment (§7.5, §7.6). No screen reader was driven end to end: semantics and live-region content are asserted programmatically and axe reports clean, but a VoiceOver/NVDA pass by a human is still worth doing before a public release (§6.14). SEO scores 91 rather than 100 because Lighthouse wants a meta description variant we deliberately keep short; the NFR-4 threshold of ≥ 90 is met.

### Addendum — How to play (T-49, 2026-09-19)

New rows 3.18, 3.19, 6.15, 7.8 and `npm run verify` re-run in full:

- `npm run typecheck` / `npm run lint` / `npm run format:check` — clean, zero errors and warnings on every file this change touches.
- `npm run check:contrast` — all 80 token pairs still meet AA; no new colour token was added, confirming the example tiles reuse the board's existing tokens.
- `npm run test:run` — **435** unit/integration tests passing (415 pre-existing + 20 new, in `HelpModal.test.tsx`, `Header.test.tsx`, and `src/test/helpFlow.test.tsx`); coverage on the two new source files is 100% lines/branches/functions.
- `npm run test:e2e` (desktop project) — **53** browser tests passing, including two new axe scans (default and colourblind palette) and two new responsive checks (320 px fit, landscape scroll).
- Manual check against `npm run dev`: dialog copy and example-tile count both track the length selector at 4/5/6 letters; dark mode and colourblind palette recolour the examples and reveal the `✓`/`◐` markers; Tab reaches **How to play** first with a visible focus ring, Escape returns focus to it; Enter still submits a guess after the dialog is dismissed.

### Addendum — Suite V1 (T-73, 2026-10-14)

Suite V1 is built and verified in this environment. Two items need the owner and the live site; they are listed under Not verified.

**Test runs**

- `npm run verify`: typecheck, ESLint, Prettier and `check:contrast` all clean ("All pairs meet WCAG 2.1 AA", no new colour token). Unit and integration: **49 files, 948 tests, all passing**.
- New test files in Suite V1: `src/test/restartFlow`, `enterFlow`, `weaverFlow`; `src/shell/useHashRoute`, `src/hooks/useEnterToContinue`, `usePhysicalKeyboard`; `src/components/ui/ConfirmDialog`, `src/components/weaver/weaver`; `src/state/GameProvider`; `src/storage/legacyImport`, `weaverStorage`; `src/engine/weaver/__tests__/*` (graph, bfs, generate, generate.real, validate, evaluate, reducer, selectors); `src/dictionary/__tests__/ladderInvariants`.
- `npm run test:e2e`: **225 passed, 1 skipped** (the throttled timing test runs on the desktop project only). New specs: `navigation`, `legacy-import`, `weaver`, `suite`, `performance`.
- Coverage: overall 94.1% statements and 91.4% branches (gates 85% and 80%). `src/engine/**` is at **194 of 194 branches**, and `src/engine/weaver/**` at **120 of 120 branches across 8 files**.
- The engine purity lint was probed: adding `import 'react'` and `Math.random()` to a WordWeaver file failed lint, and the probe was reverted.

**WordWeaver lists and par (T-58)**

- Ladder list: the 1,400 most frequent 4-letter words and the 5,000 most frequent 5-letter words that have frequency data, each plus every answer. `PAR_BAND` is 4–6 for 4 letters and 4–7 for 5 letters. The measured distribution is in SPEC §15.1.
- Starts with an in-band end: 4 letters **90.9%**, which meets the 90% rule. 5 letters **74.9%**, which does not: no frequency cut reaches 90% inside the 15 KB budget, and even the whole guess list reaches only 93.4%. This is a finding, not a defect: generation tries up to 20 starts, so the chance that none qualifies is below one in a trillion. SPEC FR-77 and ADR-025 now say so. Row 15.5 is ticked on that basis.
- AC-36: 200 seeded puzzles per length on the real lists pass, with par checked against an independent reference BFS (`src/test/referenceBfs.ts`).
- `EAST → WEST` has par 3 over the ladder list and 2 over the full guess list. `COLD → WARM` has par 4.

**Performance (T-72)**

- NFR-13, Chromium with 4x CPU throttling (what Lighthouse mobile applies), 12 cold runs, timed in the page from the click to the rendered board: the first 5-letter puzzle, **including the `lists-5` chunk load**, is **153 ms p95** against a 400 ms budget. Later puzzles are **19 ms p95** against 150 ms. No Web Worker is needed.
- Lighthouse 13.5 (mobile emulation, simulated throttling), on the production build: Home, WordWeaver and Wordwright each score **100 / 100 / 100 / 100** (Performance, Accessibility, Best Practices, SEO). First contentful paint 1.4 s, largest contentful paint 1.5 s, blocking time 0 ms, layout shift 0.
- Bundles: the entry bundle is **75.7 KB gzipped** (budget 200 KB). `lists-4` grew by 2.6 KB gzipped (16.6 to 19.2) and `lists-5` by 13.2 KB (37.9 to 51.1), both under the 15 KB limit. There is no new chunk and no new runtime dependency (React and React DOM only).
- Home makes no `lists-*` request (`e2e/navigation.spec.ts`).

**Layout and accessibility**

- Home, WordWeaver (4 and 5 letters) and Wordwright fit with no horizontal scroll from 320 px to 2560 px and at 740 x 360 landscape, and the keyboard stays on screen (`e2e/suite.spec.ts`). With a 15-rung ladder the input row, end row and keyboard stay visible, including at 320 x 568.
- axe: zero violations on Home and on the WordWeaver board in light and dark with both palettes, plus the help, statistics, result and confirmation dialogs.
- Keyboard only: Home, WordWeaver (solve, Enter for the next puzzle, All games, Home) and Home, Wordwright (play to a result, Enter, All games, Home).
- Two tabs on different games keep their session keys apart, and a theme change in one reaches the other.

**Legacy import (AC-27)**

- Verified in a real Chromium profile seeded with `wordwright:v1:*` data (dark theme, 12 games, a game with 2 guesses): the page is dark before any script runs, the stats show 12 games, the game is restored, `wordgames:v1:meta` exists, and a second load does not import again. The legacy keys are byte-for-byte unchanged (`e2e/legacy-import.spec.ts`). It was not checked on a profile from the live site.

**Changes made while building, with reasons** (all recorded in the docs)

- ADR-033: **Reset statistics** and **Reset history** moved from Settings into each game's Statistics dialog, because Settings is shared and has no game to reset.
- ADR-034: game controls reach the shared header through a portal, and Wordwright's **New game** is a header control, because an in-page button pushed the keyboard off screen at 320 px.
- The primary button now uses inverted text colours. The old green pair passed 3:1 for tile letters but failed axe at 4.02:1 for 14 px button text (the "Play again" button).
- A focused link no longer loses its Enter to the Wordwright keyboard handler, which blocked **All games** from the keyboard.
- `vitest.config.ts` gives UI tests a 15 s timeout and 3 s `findBy` timeout. At the default, two long full-flow tests timed out under the parallel run on this machine.
- The baseline was not green at the start: `npm run verify` failed Prettier on 13 CRLF files. A `.gitattributes` with `* text=auto eol=lf` fixed it.

**Not verified**

- The live site. Nothing has been deployed or pushed. Rows 14.23 (the old `/wordwright/` URL forwards to `/wordgames/`) and the live-site stats check stay open until the owner renames the repository, deploys, and creates the redirect repository (steps and the redirect page are in the README).
- Row 14.24 (a game chunk that fails to load) belongs to T-74, when game views become lazy chunks.
- Firefox, WebKit and a real device. All browser runs here are Chromium.

### Addendum — R2 WordStack (T-79, 2026-10-14)

WordStack is built and verified in this environment. Nothing has been deployed or pushed, so the live-site check below is open.

**Test runs**

- `npm run verify` is clean: typecheck, ESLint, Prettier and `check:contrast` ("All pairs meet WCAG 2.1 AA", no new colour token). Unit and integration: **58 files, 1,196 tests, all passing**.
- New test files in R2: `src/shell/catalogue.test`; `src/engine/stack/__tests__/*` (answers, reducer, selectors); `src/storage/stackStorage.test`; `src/state/stack/announcements.test`; `src/components/stack/stack.test` and `stackModals.test`; `src/test/stackFlow.test`.
- `npm run test:e2e`: **279 passed, 2 skipped** (the two timing tests run on the desktop project only), with one run in the full suite timing out in a `beforeEach` hook on a loaded machine and passing when re-run alone. New spec: `e2e/stack.spec.ts`.
- Coverage: overall 94.2% statements and 91.3% branches. `src/engine/**` is at **261 of 261 branches**, and `src/engine/stack/**` at **67 of 67 branches across 4 files**. Adding `src/engine/stack` to the purity test's folder list means the lint and the test both cover it.

**Catalogue and bundles (T-74, NFR-18, NFR-20)**

- The entry bundle is **73.9 KB gzipped** after R2, against 75.7 KB before the catalogue (T-73) and a 200 KB budget. Each game view is its own chunk: `WordwrightView` 3.2 KB, `WeaverView` 8.1 KB, `StackView` 7.6 KB gzipped. Shared UI parts split into small chunks (`ChangeLength` 3.3 KB). No new data chunk and no new runtime dependency: WordStack reuses `lists-5`.
- A fixture catalogue of three entries shows three cards in order with the right `<h1>` and title on each route. `#/stack` went Home until WordStack was added, and `#/range` goes Home now. The key builder returns the FR-68 keys, so no stored data moved.
- A game chunk that fails to load shows an inline panel (`Couldn't load this game.`) with **Retry** and **All games**, not the crash screen. A crash inside a loaded game still reaches the app error boundary. Retry asks the loader again through a fresh lazy component. A browser that caches a failed module import may fail again until the page is reloaded; that is untested in a real post-deploy failure.

**Performance (NFR-21)**

- A Quad guess (four evaluations, four boards and 26 split keys re-rendered, four rows revealing) costs about **9 to 10 ms of main-thread work** at steady state, measured with Chrome's own script, layout and style counters (about 9.5 ms p95 over seven guesses, per `e2e/stack.spec.ts`). The first guess after load costs about 31 ms because the code paths are cold, and is reported but not budgeted. Two changes keep it low: each board and each split key skips rendering when its own state did not change.

**Layout and accessibility**

- Duo and Quad fit from 320 px to 2560 px and at 740 x 360 landscape with no horizontal scroll and the keyboard on screen. Quad scrolls its board area, not the page, at 320 x 568. Keys and header buttons are at least 44 px.
- axe: zero violations on Duo and Quad in light and dark with both palettes, plus the help, statistics, result and confirmation dialogs. axe flagged Quad's scrolling board area as not keyboard-reachable; it now has a tab stop and a label.
- Keyboard only: Home, WordStack, play to a result, Enter, All games, Home.
- Split keys carry the colourblind marker glyph on correct and present segments, and one accessible name that lists every board, such as `A: board 1 present, board 2 absent, board 3 solved, board 4 absent`.

**Changes made while building**

- The WordStack header carries **New game** beside How to play, the Duo/Quad selector and Statistics, for the reason in ADR-034. Row 18.2 lists the order without it.
- The corrupt-data notice (EC-12, EC-26) was missed when a lazy game's providers mounted after the shell. Storage issues now notify subscribers, and `StorageNotices` listens instead of checking once.
- Each split key shows its letter on a small solid chip over the segments, because white or dark text alone cannot be read over a mix of segment colours.

**Not verified**

- The live site: WordStack on Home and playing end to end on the deployed address. Nothing was pushed or deployed.
- Firefox, WebKit and a real device. All browser runs here are Chromium.

### Addendum — R3 WordRange (T-83, 2026-10-14)

WordRange is built and verified in this environment. Nothing has been deployed or pushed, so the live-site check below is open.

**Test runs**

- `npm run verify` is clean: typecheck, ESLint, Prettier and `check:contrast` (no new colour token). Unit and integration: **66 files, 1,395 tests, all passing**, with every coverage threshold met.
- New test files in R3: `src/engine/range/__tests__/*` (heat, validate, reducer, selectors, and a real-list test); `src/storage/rangeStorage.test`; `src/components/range/range.test`; `src/test/rangeFlow.test`. `loadDictionary.test` gained a test that `guessList` is the module's own sorted array.
- `npm run test:e2e`: **328 passed, 2 skipped, 2 failed** in the full run. The two failures were the WordStack timing test and a WordWeaver 320 px layout test, both on a loaded machine (the full run took 18 minutes). Both pass when re-run alone (WordStack steady state 9.2 to 13.4 ms per Quad guess). New spec: `e2e/range.spec.ts`, 50 tests across the desktop and mobile projects.
- Coverage: `src/engine/range/**` is at **65 of 65 branches across 4 files**. Adding `src/engine/range` to the purity test's folder list means the lint and the test both cover it.

**Rules checked against the real list**

- The 5-letter guess list has 13,746 words and log2 of that is below 14, so 14 guesses always suffice. A binary search over the first 50 answers finds each within 14 guesses.
- AC-49: with secret `PLANT`, `BRAVE` is "after", the range is `BRAVE … ZZZZZ` and the heat is Freezing; `PLAIN` is Burning. AC-50: `ABOUT` inside `BRAVE … STORM` is `outside-range`.
- Heat bands are tested at 20/21, 100/101, 500/501 and 2,000/2,001, and heat never gets hotter as distance grows.
- The help example (secret `PLANT`; `BRAVE` Freezing, `PLUMB` Hot, `PLAIN` Burning) is checked against the shipped list in a test, so it cannot disagree with the game.

**Catalogue and bundles (NFR-18, NFR-20)**

- The entry bundle is **74.9 KB gzipped** after R3, against a 200 KB budget. The WordRange view is its own **5.8 KB** chunk. No new data chunk and no new runtime dependency: WordRange reuses `lists-5`.
- Home shows four cards in order. `#/range` opens WordRange; `#/code` and `#/shuffle` still go Home.

**Layout and accessibility**

- The upper bound, input row, lower bound and guess list sit in one scrollable region with a tab stop and a label, so the keyboard stays on screen with 13 guesses listed. This holds from 320 px to 2560 px and at 740 x 360 landscape, with no horizontal scroll. Keys and header buttons are at least 44 px.
- axe: zero violations in light and dark with both palettes, with every heat level and both directions on screen, plus the help, statistics (empty and with a game), result and confirmation dialogs.
- Heat is always a word, with five pips beside it as a second cue. The input row is a labelled group ("Your guess: PL"), not a grid. The keyboard has no letter colours.
- The announcement matches A11Y-22: `BRAVE: the word is after it. Range BRAVE to ZZZZZ. Freezing. 13 guesses left.`

**Changes made while building**

- The header carries **New game** beside How to play and Statistics, for the reason in ADR-034. Row 19.2 lists the order without it.
- Statistics keep one set of buckets (1 to 14), not per mode, because WordRange has a single mode. Its preferences key holds an empty object so reset and import stay uniform with the other games.
- A saved game is also rejected if its secret is not strictly inside its own saved range, or if a word repeats.
- Most e2e tests seed a saved game with the secret `PLANT`, because a real game's secret is random. That is the same path a reload takes.

**Not verified**

- The live site: WordRange on Home and playing end to end on the deployed address. Nothing was pushed or deployed.
- Firefox, WebKit and a real device. All browser runs here are Chromium.

### Addendum — R4 WordCode (T-87, 2026-10-14)

WordCode is built and verified in this environment. Nothing has been deployed or pushed, so the live-site check below is open.

**Test runs**

- `npm run verify` is clean: typecheck, ESLint, Prettier and `check:contrast` ("All pairs meet WCAG 2.1 AA"). Unit and integration: **72 files, 1,598 tests, all passing**, with every coverage threshold met.
- New test files in R4: `src/engine/code/__tests__/*` (score, reducer, selectors); `src/storage/codeStorage.test`; `src/components/code/code.test`; `src/test/codeFlow.test`.
- `npm run test:e2e` for the new spec: **`e2e/code.spec.ts`, 60 passed** across the desktop and mobile projects. The Home card count moved from 4 to 5 in the earlier specs, and those were re-run in the final full run noted in the Evidence Summary.
- Coverage: `src/engine/code/**` is at **54 of 54 branches across 3 files**. Adding `src/engine/code` to the purity test's folder list means the lint and the test both cover it.

**Rules checked**

- AC-51: `PANEL` against `PLANT` is 1 bull and 3 cows, and `EEEEE` against `SPEED` is 2 bulls and 0 cows.
- EC-44: every row of the SPEC §6.3 truth table gives counts equal to its `correct` and `present` totals, and a second test compares against `evaluateGuess` directly.
- Wins and losses at each length, a win on the 10th guess, and a loss on the 10th wrong guess.
- Repeated guesses are allowed, as in Wordwright (FR-16), because FR-128 follows its validation.
- Notes: three presses return a letter to unmarked; a guess and typing never change a mark; notes round-trip through the saved session exactly (EC-45) and survive leaving and returning and a reload (AC-52).
- A stored game is rejected if a guess word has the wrong length, a count is inconsistent (counts above the length, the secret without all bulls, or all bulls on another word), or a note has an unknown letter or mark.

**Catalogue and bundles (NFR-18, NFR-20)**

- The entry bundle is **75.7 KB gzipped** after R4, against a 200 KB budget. The WordCode view is its own **6.6 KB** chunk. No new data chunk and no new runtime dependency: WordCode reuses `lists-4`, `-5` and `-6`.
- Home shows five cards in order. `#/code` opens WordCode; `#/shuffle` still goes Home.

**Layout and accessibility**

- At 4 and 6 letters with nine guesses, the board fits from 320 px to 2560 px and at 740 x 360 landscape, with no horizontal scroll, no clipped counts and the keyboard on screen. The rows sit in one scrollable region with a tab stop and a label. Keys, the Type and Mark switch and header buttons are at least 44 px.
- axe: zero violations in light and dark with both palettes, with guesses, marks on the notes and keys, and typed letters on screen. Also clean at 4 and 6 letters and on the help, statistics (empty and with a game), result and confirmation dialogs.
- Note marks use no new colour token. They use the neutral key tokens and differ by form: a dimmed key with a dashed outline for ruled out, a solid heavy outline for in the word. A corner glyph (× or ●) repeats each mark. `check:contrast` therefore has nothing new to cover, and axe checked the rendered marks in every palette.
- The announcement matches A11Y-23: `PANEL: 1 bull, 3 cows. 9 guesses left.` A count of zero is said aloud. In Mark mode every key is named like `P, ruled out` or `P, unmarked`, and a marked key keeps that name in Type mode.
- A guess row reads as one line (`PANEL: 1 bull · 3 cows`), not as a grid.

**Changes made while building**

- The header carries **New game** beside How to play, the length selector and Statistics, for the reason in ADR-034. Row 20.2 lists the order without it.
- The board does not show a guesses-left counter. The ten rows show it, and the announcement says it. No row in §20 asks for one.
- Letter notes are set on the keyboard itself through a Type and Mark switch, so there is no separate notes panel. Each guess row shows bulls and cows on two lines with a filled and a hollow dot beside the words.

**Not verified**

- The live site: WordCode on Home and playing end to end at each length on the deployed address. Nothing was pushed or deployed.
- Firefox, WebKit and a real device. All browser runs here are Chromium.

### Addendum — R5 WordShuffle (T-91, 2026-10-14)

WordShuffle is built and verified in this environment. Nothing has been deployed or pushed, so the live-site check below is open.

**Test runs**

- `npm run verify` is clean: typecheck, ESLint, Prettier and `check:contrast` ("All pairs meet WCAG 2.1 AA"). Unit and integration: **81 files, 1,841 tests, all passing**, with every coverage threshold met. Overall coverage is 94.6% statements and 91.8% branches.
- New test files in R5: `src/engine/shuffle/__tests__/*` (anagram, scramble, validate, reducer, selectors, and a real-list test); `src/storage/shuffleStorage.test`; `src/components/shuffle/shuffle.test`; `src/test/shuffleFlow.test`.
- `npm run test:e2e` for the new spec: **`e2e/shuffle.spec.ts`, 66 passed** across the desktop and mobile projects.
- **Final full run (all six games):** 455 passed, 2 skipped, 1 failed. The failure was the WordStack timing test (NFR-21) on a machine that was also running other work; it passed when re-run alone (9.2 to 13.4 ms per Quad guess) but failed in this run, so treat that budget as sensitive to host load.
- Coverage: `src/engine/shuffle/**` is at **93 of 93 branches across 5 files**, and `src/engine/**` as a whole is at **473 of 473**. Adding `src/engine/shuffle` to the purity test's folder list means the lint and the test both cover it.

**Rules checked against the real lists**

- AC-53: the 6-letter list holds the six words SPEC §20 names for `LISTEN` (`ELINTS`, `ENLIST`, `INLETS`, `LISTEN`, `SILENT`, `TINSEL`). In the browser, typing `SILENT` solves a `LISTEN` puzzle and the result lists the other five.
- EC-49: 1,000 seeded puzzles at each length have a scramble that differs from the target and is not a word, and every answer in the shipped lists has at least one valid scramble, so a redraw never happens in practice. A fixture where every order is a word draws another target.
- AC-54 and EC-48: after a hint, an answer that moves the hinted letter returns `hint-moved` from `validateAnswer`, and the reducer also ignores it as a guard. Through the interface, typing skips locked letters and Backspace never removes one.
- EC-46: a typed letter that is not left in the tray changes nothing and raises no toast.
- Hints: the first fixes position 1 and the second position 2; a third does nothing. A hint first returns typed letters to the tray, so the hinted letter is always there. A property test checks that the tray and the row always hold exactly the letters of the scramble through a mixed sequence of actions.
- Reshuffle keeps the same letters, always changes the order when the letters are not all alike, and is free.
- Statistics: a give up resets the streak and adds no hints; average hints per solve is hints over solves and shows `—` with no solves. A stored game is rejected if its tray and row do not hold the scramble's letters, a hinted slot does not hold the target's letter, or the hint positions are repeated or out of order.

**Catalogue and bundles (NFR-18, NFR-20)**

- The entry bundle is **76.8 KB gzipped** after R5, against a 200 KB budget. The view chunks are 3.3 KB (Wordwright), 8.1 KB (WordWeaver), 7.7 KB (WordStack), 5.8 KB (WordRange), 6.6 KB (WordCode) and 6.8 KB (WordShuffle). No new data chunk and no new runtime dependency: runtime dependencies are still `react` and `react-dom`. WordShuffle reuses `lists-4`, `-5` and `-6`.
- Home shows six cards in order. `#/shuffle` opens WordShuffle, and a route that is not a game still goes Home.

**Layout and accessibility**

- At 4 and 6 letters, the answer row, the tray and the controls fit from 320 px to 2560 px and at 740 x 360 landscape, with no horizontal scroll. The tray stays on one row, so the 6-letter tray fits across 320 px. The solved result panel with its anagram list fits at 320 px. Tray buttons, controls and header buttons are at least 44 px.
- axe: zero violations in light and dark with both palettes, with a hinted letter, typed letters and a part-used tray on screen. Also clean at 4 and 5 letters and on the help, statistics (empty and with a game), solved result and give-up confirmation dialogs.
- A11Y-24: each tray button is named with its letter and how many copies are left (`E, 2 left`). The answer row is one labelled group that lists every position and marks hinted letters (`Your answer: L (hinted), S, empty, ...`). Hints, reshuffles, solves and give ups are each announced once, for example `Hint: letter 1 is L. 1 hint left.` and `Solved with SILENT. No hints used.`
- A hinted letter is drawn as a locked correct tile with the colourblind marker, and the answer label says `hinted`, so it never relies on colour. There is no on-screen QWERTY keyboard: the tray is the keyboard, with **Backspace** and **Submit** buttons.

**Changes made while building**

- The header carries **New puzzle** beside How to play, the length selector and Statistics, for the reason in ADR-034. Row 21.2 lists the order without it.
- The error name for a moved hint is `hint-moved`, as in ARCHITECTURE §3.10. The TASKS wording `breaks-hint` was corrected to match.
- Returned letters go to the end of the tray, not back to their old place, so the tray reflows after a tap or Backspace.
- Pressing Enter with the focus on a link and letters in the row submits the answer, not the link. This is the existing Wordwright rule (Enter belongs to the game once the row has letters), and the keyboard-only test navigates with an empty row.

**Not verified**

- The live site: all six games on Home and playing end to end on the deployed address. Nothing was pushed or deployed.
- Lighthouse was not re-run after R2 to R5, so the Lighthouse scores in the Evidence Summary are from Suite V1.
- Firefox, WebKit and a real device. All browser runs here are Chromium.
- No screen reader was driven by a person. Labels, live regions and announcements are asserted in tests and axe reports clean.

### Addendum — WordRange lengths and a harder WordShuffle (ADR-037, ADR-038, 2026-10-17)

Two changes after R5. Rows 19.2 to 19.4, 19.9, 19.10, 19.14 and 19.15 and rows 21.3, 21.4, 21.9, 21.11 and 21.14, with the new rows 21.20 and 21.21, describe them.

**WordRange at 4, 5 and 6 letters (ADR-037)**

- The guess limits are 13, 14 and 15, which is floor(log2 N) + 1 for the 6,142, 13,746 and 24,637-word guess lists. A real-list test checks the list sizes, that each sentinel sits outside its list, and that a perfect halving finds 50 answers within the limit at every length.
- The 4 and 6-letter heat bands scale the 5-letter ones by list size over 13,746. A test checks each band against that ratio.
- A saved game, statistics blob, answer buffer and preferences from before the change load as 5-letter data. Tests cover each, and a flow test restores an old game with its statistics through the real providers.
- `e2e/range.spec.ts`: **58 passed.** The 6-letter game fits at 320 x 568 with the length selector in the header.
- The shared length selector, the WordStack mode selector, the statistics view switcher and the Settings choices were 36 px tall, below the 44 px of FR-58. They are now 44 px, and `e2e/range.spec.ts` checks the length selector. `src/engine/**` branch coverage is back to 100%, with tests for the finished-game records that have no start time or no guesses.

**WordShuffle (ADR-038)**

- The new `shuffle` list holds 712, 1,144 and 1,051 words at 4, 5 and 6 letters. Every word was read by hand. Data tests check that it has no answer, that every word is a guess, that a spot-check of offensive words is absent, and that no -ED or -ING form with a word stem is in it.
- Over the whole real pool, fewer than 5% of scrambles keep a letter in the target's place. Reshuffle keeps the same rule, never lands on a word, and works from the letters not locked by a hint.
- The clock reads 0:00 until the first letter, ticks once a second, stops at the solve or give up, and keeps counting after leaving and returning. `e2e/shuffle.spec.ts`: **68 passed**, with the layouts at 320 px and 740 x 360 landscape unchanged.
- The lists chunks grew by 1.5, 2.4 and 3.5 KB gzipped (20.6, 53.5 and 76.3 KB), against a limit of 15 KB each. The entry bundle is **79.1 KB gzipped**.
- Unit and integration: **83 files, 2,027 tests, all passing.** `src/engine/**` branch coverage is 100% after the follow-up that added the missing selector tests.

### Addendum — R6 WordDodge (T-95, 2026-10-17)

A seventh game, an adversarial Wordle (ADR-039). Rows 22.1 to 22.19 describe it.

**Behaviour**

- The game keeps the 700 answers of the chosen length as candidates and answers each guess with the colours of the largest group. A real-list test plays a sensible strategy at 4, 5 and 6 letters and wins within 12 guesses each time.
- A saved game holds the guesses and their colours. The candidates are rebuilt by replaying them, and a game that no longer replays is dropped.
- A game is not saved while its reveal runs. After a reload during a reveal, the game is as it was before that guess.

**Tests**

- `src/engine/dodge`: **100%** branch coverage. Unit and integration: **90 files, 2,185 tests, all passing.**
- `e2e/dodge.spec.ts`: **62 passed**, on desktop and mobile. It covers a win, a give up, a reload, axe in both themes and both palettes, and layouts from 320 px to 2560 px and 740 x 360 landscape with eight guesses.
- The other specs (WordCode, WordRange, WordShuffle, WordStack, WordWeaver, navigation, a11y, responsive and suite): **418 passed, 1 skipped**, after raising the Home card count to 7 in four of them. One WordStack timing test (a Quad guess under 16 ms at p95) failed once during the long run, at 25 ms, and passed on its own at about 9 ms per guess. It is a timing check, and the long run was loaded.

**Bundle**

- The WordDodge view is its own chunk of **6.2 KB gzipped**, and no lists chunk changed. The entry bundle is **80.0 KB gzipped**, up from 79.1 KB, against a limit of 200 KB.

**Not verified**

- Nothing outside this environment: the deployed site was not touched.

## Sign-off

| Gate                                            | Owner | Date | Notes |
| ----------------------------------------------- | ----- | ---- | ----- |
| Game logic (§1–2)                               |       |      |       |
| UX & persistence (§3–5)                         |       |      |       |
| Accessibility (§6)                              |       |      |       |
| Responsive & performance (§7–8)                 |       |      |       |
| Quality, edge cases, errors (§9–11)             |       |      |       |
| Scope & docs (§12–13)                           |       |      |       |
| Suite shell & rename (§14)                      |       |      |       |
| WordWeaver (§15–16)                             |       |      |       |
| Cross-game and Suite V1 rows (§6, §8, §10, §17) |       |      |       |
| R2 WordStack (§18 and R2 rows)                  |       |      |       |
| R3 WordRange (§19 and R3 rows)                  |       |      |       |
| R4 WordCode (§20 and R4 rows)                   |       |      |       |
| R5 WordShuffle (§21 and R5 rows)                |       |      |       |
| R6 WordDodge (§22 and R6 rows)                  |       |      |       |

**V1 is done when every box above is ticked. Not before, and nothing more.**
