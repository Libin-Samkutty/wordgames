# wordgames — Product Requirements Document (SPEC)

**Version:** 2.1 · **Scope:** Suite V1 (Wordwright V1 + WordWeaver + suite shell), then releases R2–R5 (WordStack, WordRange, WordCode, WordShuffle) · **Status:** Draft for review

This is the single source of truth for _what_ the wordgames suite does. Version 1.0 specified Wordwright alone. Version 2.0 keeps every Wordwright requirement and ID unchanged, and adds the suite shell (§14), WordWeaver (§15–§16) and candidate future games (Appendix A). Version 2.1 adds four more games as later releases: WordStack (§17), WordRange (§18), WordCode (§19) and WordShuffle (§20). The project was previously named Wordwright; that name now belongs to the Wordle-style game inside the suite. Anything not stated here is out of scope. Requirements are identified (`FR-x`, `NFR-x`, `A11Y-x`, `EC-x`, `AC-x`) so tests, tasks, and reviews can cite them.

---

## 1. Vision

**wordgames** is a small suite of offline word games that share one shell, one set of word lists and one set of appearance settings. A Home screen lets the player pick a game. Suite V1 ships two:

- **Wordwright**: guess a hidden 4, 5 or 6-letter word in six tries with green/yellow/grey feedback.
- **WordWeaver**: turn a start word into an end word one letter at a time. Every rung must be a real word, and letters that already match the end word turn green.

Four more follow, one per release (§14.4):

- **WordStack** (R2): solve two or four Wordle boards at once with shared guesses.
- **WordRange** (R3): find a word by its alphabetical place, guided by before/after and a heat meter.
- **WordCode** (R4): deduce a word from bull and cow counts alone.
- **WordShuffle** (R5): unscramble a word; any valid anagram wins.

The qualities below were written for Wordwright and now apply to the whole suite.

A word-guessing game that feels as polished as the commercial original, but is entirely self-contained: it loads once, works forever offline, respects the player's device preferences, and keeps their history private on their own machine. Variable word length (4/5/6) is the differentiator — the same crisp loop at three difficulty flavours.

## 2. Goals

| #   | Goal                                               | Measure                                                                                     |
| --- | -------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| G1  | Faithful Wordle rules, including duplicate letters | Engine passes the full evaluation truth table (§6.3)                                        |
| G2  | Three word lengths, one shared engine              | Adding a 7-letter mode requires only data + one registry entry                              |
| G3  | Fully playable offline                             | App functions with network disabled after first load                                        |
| G4  | Production polish                                  | Animations, loading states, error handling, no dead ends                                    |
| G5  | Accessible to keyboard and screen-reader users     | A11Y-1…A11Y-9 satisfied; axe reports zero serious/critical issues                           |
| G6  | Trustworthy statistics                             | Stats survive refresh, migrate across schema versions, never corrupt                        |
| G7  | Maintainable                                       | `npm run verify` green; engine coverage 100% branches                                       |
| G8  | A second game without coupling the engines         | WordWeaver reuses shell, dictionary and UI parts; no shared game state or engine code paths |
| G9  | The rename costs existing players nothing          | Stats, streaks, settings and an in-progress game survive the move to `wordgames` (AC-27)    |

## 3. Non-Goals (Suite V1)

Explicitly **not** built:

- Any server, API, database, account, or sync
- Daily challenge, hard mode, timed/survival/practice modes, seeded or custom games, share links
- Sound effects, confetti, achievements, alternate themes beyond light/dark/system
- PWA install / service worker / offline caching layer
- Charts, heatmaps, or trend visualisations (raw stats only)
- Localisation, non-English dictionaries, user-supplied word lists
- Analytics, telemetry, cookies, third-party scripts
- Mobile native apps

Added for Suite V1:

- A router library or a plugin API (ADR-022). The game catalogue in FR-97 is a static list, not a plugin system (ADR-028).
- Daily, seeded or shared WordWeaver puzzles; custom start and end words
- WordWeaver hints other than **Give up**; 6-letter WordWeaver
- Combined cross-game statistics
- The ideas in Appendix A: Waffle-style grid, Jotto, timed unscramble, meaning-based Hot & Cold
- WordStack lengths other than 5, or more than four boards; WordRange lengths other than 5
- Numeric scores in any game except Wordwright

Rationale in [`DECISIONS.md`](./DECISIONS.md).

## 4. Personas & User Stories

**P1 — Casual player.** Wants a quick game on a phone, one-handed.
**P2 — Daily habit player.** Cares about streaks and stats.
**P3 — Keyboard/AT user.** Plays without a mouse, may use a screen reader.
**P4 — Puzzle player.** Prefers slower logic puzzles, likes trying a path, backing out and trying another.

| ID    | Story                                                                                                  | Priority |
| ----- | ------------------------------------------------------------------------------------------------------ | -------- |
| US-1  | As a player, I can start a game and guess words so I can play Wordle.                                  | Must     |
| US-2  | As a player, I can choose 4, 5, or 6 letters so I can vary difficulty.                                 | Must     |
| US-3  | As a player, I see colour feedback per letter so I can deduce the answer.                              | Must     |
| US-4  | As a player, I am told when my guess isn't a real word so I don't waste a turn.                        | Must     |
| US-5  | As a player, I can play again immediately after a win or loss.                                         | Must     |
| US-6  | As a player, I can restart mid-game if I want a fresh word.                                            | Must     |
| US-7  | As a player, I can see the answer after losing so the game feels resolved.                             | Must     |
| US-8  | As a returning player, my in-progress game survives an accidental refresh.                             | Must     |
| US-9  | As a habit player, I can view detailed statistics including streaks and distribution.                  | Must     |
| US-10 | As a habit player, I can see a log of my recent games.                                                 | Should   |
| US-11 | As a player, I can choose light, dark, or system theme.                                                | Must     |
| US-12 | As a player, I can reset my statistics and history.                                                    | Must     |
| US-13 | As a colourblind player, I can enable a high-distinction palette.                                      | Must     |
| US-14 | As a keyboard user, I can reach and operate every control without a mouse.                             | Must     |
| US-15 | As a screen-reader user, I hear my guess results announced.                                            | Must     |
| US-16 | As a motion-sensitive player, animations are reduced or removed.                                       | Must     |
| US-17 | As a player on a plane, everything works with no connection.                                           | Must     |
| US-18 | As a player, I see a clear message if something goes wrong instead of a blank screen.                  | Must     |
| US-19 | As a new player, I can learn the rules inside the game so I can start playing without looking them up. | Must     |
| US-20 | As a player, I can pick a game from a home screen.                                                     | Must     |
| US-21 | As a player, I can go back to the home screen without losing the game I'm in the middle of.            | Must     |
| US-22 | As a player, the browser Back button and bookmarks take me to the right screen.                        | Must     |
| US-23 | As a returning Wordwright player, my stats, streaks, settings and current game survive the rename.     | Must     |
| US-24 | As a desktop player, I can press Enter on the result screen to play again.                             | Must     |
| US-25 | As a puzzle player, I can build a ladder from the start word to the end word, one letter per rung.     | Must     |
| US-26 | As a puzzle player, I can see which letters of each rung already match the end word.                   | Must     |
| US-27 | As a puzzle player, I can undo my last rung when I hit a dead end.                                     | Must     |
| US-28 | As a puzzle player, I can give up and see a shortest ladder.                                           | Must     |
| US-29 | As a puzzle player, I can choose 4 or 5 letters in WordWeaver.                                         | Must     |
| US-30 | As a puzzle player, I can compare my result with par and track WordWeaver stats.                       | Must     |
| US-31 | As a new WordWeaver player, I can learn its rules inside the game.                                     | Must     |
| US-32 | As a player, I can solve two or four Wordle boards at once with shared guesses.                        | Must     |
| US-33 | As a multi-board player, I can see each board's letter states on the keyboard.                         | Must     |
| US-34 | As a player, I can find a word from its alphabetical range with hot/cold hints.                        | Must     |
| US-35 | As a player, I can deduce a word from bull and cow counts.                                             | Must     |
| US-36 | As a WordCode player, I can mark letters I've ruled out or confirmed.                                  | Should   |
| US-37 | As a player, I can unscramble a word, reshuffle the letters and take a hint.                           | Must     |
| US-38 | As a player, every game has its own rules, statistics and Enter to play again.                         | Must     |

## 5. Glossary

- **Answer** — the secret word for the current game.
- **Answer list** — curated, common, solvable words; the pool answers are drawn from.
- **Guess list** — the superset of words accepted as valid input (includes the answer list).
- **Guess** — a submitted word of exactly `wordLength` letters.
- **Evaluation** — array of `correct | present | absent`, one per letter of a guess.
- **Row** — one of 6 guess slots. **Tile** — one letter cell in a row.
- **Key state** — best-known evaluation for a letter on the on-screen keyboard.
- **Completed game** — a game that reached `won` or `lost`. Only completed games affect statistics.

Suite and WordWeaver terms:

- **Suite** — the wordgames app as a whole: shell, Home and both games.
- **Home** — the game picker screen at `#/`.
- **Ladder** — the sequence start word → rungs → end word in a WordWeaver game.
- **Rung** — a word the player submits in WordWeaver. Each rung differs from the word above it in exactly one position.
- **Start word / End word** — the fixed first and last words of a WordWeaver puzzle.
- **Ladder list** — the common words of a length (about 3,000) used to compute par and the give-up ladder. Sits between the answer list and the guess list (FR-75).
- **Neighbour** — two words of the same length that differ in exactly one position.
- **Par** — the fewest rungs needed to reach the end word, counting the end word itself. Equal to the shortest-path distance between start and end in the ladder graph (FR-76).
- **Move** — one accepted rung submission. Moves are never refunded, even when a rung is undone.
- **Optimal ladder** — a ladder whose length equals par.

Terms for the later games:

- **Game catalogue** — the static, ordered list of shipped games that drives Home and routing (FR-97).
- **Release** — one deploy that adds one game: R2 WordStack, R3 WordRange, R4 WordCode, R5 WordShuffle.
- **Board** — in WordStack, one Wordle grid with its own answer. **Mode** — Duo (2 boards) or Quad (4 boards).
- **Range / bound** — in WordRange, the alphabetical interval the secret lies in, and the guesses at its two ends.
- **Heat** — in WordRange, how close a guess is to the secret by position in the sorted guess list.
- **Bull / cow** — in WordCode, a letter in the right place / a letter in the word but in the wrong place.
- **Tray / scramble / hint** — in WordShuffle, the available letters, their shuffled order, and a letter fixed in its correct place.

---

## 6. Gameplay Rules

_§6 and §7 describe **Wordwright**. WordWeaver rules are in §15–§16. Settings in §7.4 are split between the suite and each game by FR-67._

### 6.1 Setup

- **FR-1** Word length is 4, 5, or 6; default 5.
- **FR-2** Every game allows exactly **6 guesses**, regardless of word length.
- **FR-3** The answer is chosen uniformly at random from the answer list for the active length.
- **FR-4** Answers do not repeat until the pool for that length is exhausted (a "recently used" ring buffer of `min(50, floor(pool/4))` words is skipped); when exhausted the buffer resets.
- **FR-5** Games are unlimited; a new game can be started at any time.

### 6.2 Input

- **FR-6** Accepted input is A–Z only, case-insensitive, normalised to uppercase.
- **FR-7** Typing appends a letter to the current row until it holds `wordLength` letters; further letters are ignored (no error).
- **FR-8** Backspace/Delete removes the last letter of the current row.
- **FR-9** Enter submits the current row.
- **FR-10** Input is accepted from the physical keyboard and the on-screen keyboard; both drive the same state.
- **FR-11** Input is blocked while a reveal animation is playing, while the dictionary is loading, and after the game ends.

### 6.3 Evaluation (the critical algorithm)

Two-pass, count-based:

```
evaluate(guess, answer):
  result = ['absent'] * n
  pool   = multiset of answer letters

  # Pass 1 — exact matches consume their letter first
  for i in 0..n-1:
    if guess[i] == answer[i]:
      result[i] = 'correct'
      pool.remove(guess[i])

  # Pass 2 — present only while unconsumed copies remain, left to right
  for i in 0..n-1:
    if result[i] != 'correct' and pool.contains(guess[i]):
      result[i] = 'present'
      pool.remove(guess[i])

  return result
```

- **FR-12** Greens are assigned before yellows. A letter is yellow only if an unmatched copy remains in the answer.
- **FR-13** Surplus copies of a letter are grey, and yellows are assigned **left to right**.

**Truth table (must be covered by tests):**

| Answer      | Guess   | Expected     |
| ----------- | ------- | ------------ |
| `CRANE`     | `CRANE` | G G G G G    |
| `CRANE`     | `SLOTH` | ⬛⬛⬛⬛⬛   |
| `ABBEY`     | `BABES` | Y Y G G ⬛   |
| `ALLOY`     | `LULLS` | Y ⬛ G ⬛ ⬛ |
| `SPEED`     | `ERASE` | Y ⬛ ⬛ Y Y  |
| `SPEED`     | `EEEEE` | ⬛ ⬛ G G ⬛ |
| `GEESE`     | `EEEEE` | ⬛ G G ⬛ G  |
| `BOOKS`     | `OOZES` | Y G ⬛ ⬛ G  |
| `LOLLY` (5) | `LILLY` | G ⬛ G G G   |
| `MAMA` (4)  | `AMMA`  | Y Y G G      |

_Worked example — `ALLOY` / `LULLS`: index 2 is an exact `L` (green, consumes one of the answer's two `L`s). Pass 2 walks left to right: index 0 `L` takes the one remaining unmatched `L` → yellow; index 3 `L` finds none left → grey; `U` and `S` are absent → `[present, absent, correct, absent, absent]`. Tests must assert the exact array, not prose._

### 6.4 Validation

- **FR-14** Submitting fewer than `wordLength` letters → error toast `"Not enough letters"`, row shakes, no turn consumed.
- **FR-15** Submitting a word absent from the guess list → toast `"Not in word list"`, row shakes, no turn consumed.
- **FR-16** Repeated guesses are permitted (matches the original game); no warning, turn is consumed.
- **FR-17** Validation is a case-insensitive lookup in an O(1) `Set` built once per length.

### 6.5 Win / Loss

- **FR-18** Win when a submitted guess equals the answer → status `won`, reveal, then a result banner after the flip completes.
- **FR-19** Loss after 6 non-matching guesses → status `lost`, result banner reveals the answer in plain text.
- **FR-20** On completion the game record is written to statistics exactly once (idempotent by game id).
- **FR-21** The result panel offers **Play again** (same length) and **Change length**.
- **FR-22** Solve time is measured from the first keystroke of the game to submission of the winning guess, in milliseconds, using a monotonic clock (`performance.now()` offset from `Date.now()` at mount).

### 6.6 Scoring

- **FR-23** Score for a completed game:

```
if lost:  score = 0
else:
  base        = (7 - guessesUsed) * 100          # 600 for a 1-guess win … 100 for a 6-guess win
  lengthMult  = { 4: 1.0, 5: 1.2, 6: 1.5 }[wordLength]
  speedBonus  = max(0, 120 - floor(solveMs / 1000)) * 2   # 0…240, wall-clock seconds
  score       = round(base * lengthMult) + speedBonus
```

- **FR-24** Total score is the sum of all completed-game scores. Abandoned/restarted games score nothing and are not recorded.

---

## 7. Functional Requirements by Area

### 7.1 Dictionary

- **FR-25** Two lists per word length, bundled in the app: `answers-<n>` (curated, common) and `guesses-<n>` (large, permissive). Both live in one generated module, `lists-<n>.ts`. WordWeaver adds a third export to the 4 and 5-letter modules, the ladder list (FR-75).
- **FR-26** The guess list is a superset of the answer list; a build-time/test assertion enforces this.
- **FR-27** All entries are uppercase A–Z, exactly `n` characters, unique, and sorted. A test asserts these invariants for every list.
- **FR-28** Lists are loaded per length through dynamic `import()` so each length is a separate chunk; loaded chunks are cached in memory for the session.
- **FR-29** Adding a new length requires: add two data modules, add one entry to the dictionary registry, extend the `WordLength` union, plus one `HELP_EXAMPLES` entry (FR-60) — the `Record<WordLength, …>` type makes that last one a compile error until it is added, rather than a silently blank dialog.
- **FR-30** Minimum sizes: answers ≥ 300, guesses ≥ 1500 per length (real English words only).
- **FR-31** No profanity or slurs in the answer list.

### 7.2 Game session

- **FR-32** The in-progress game (answer, guesses, evaluations, start time, length) is persisted to LocalStorage after every state change and restored on load.
- **FR-33** A restored game with a schema/length mismatch, or whose answer is no longer in the list, is discarded silently and a fresh game starts.
- **FR-34** Restarting or switching length abandons the current game with no statistical effect. If ≥1 guess has been made, a confirmation dialog is shown first.

### 7.3 Statistics

- **FR-35** Persisted aggregate metrics: games played, games won, current streak, best streak, guess distribution (buckets 1–6), total guesses (for averaging), total score, total solve time, fastest solve, plus the derived-on-read win %, average guesses, average solve time.
- **FR-36** The same bucket of metrics is also maintained **per word length** (used by the UI's length filter and by V2 analytics).
- **FR-37** Current streak increments on a win and resets to 0 on a loss; best streak is the max ever observed. Streaks are counted across all lengths.
- **FR-38** Average guesses counts **wins only** (`totalGuessesInWins / gamesWon`), displayed to one decimal; `—` when `gamesWon == 0`.
- **FR-39** Recent games: last 50 completed games, newest first, each storing `{ id, playedAt, wordLength, answer, guessesUsed, won, solveMs, score }`.
- **FR-40** The statistics panel shows the guess distribution as horizontal bars with the current game's row highlighted.
  - Added later (ADR-035): the panel has an **All / 4 / 5 / 6 letters** switch that scopes every figure, the best score from a single win, the most-used first guess (from the last 50 games, shown once one word has been used twice), and each game record may carry `opener`.
  - Every WordGames statistics dialog highlights the row or rows of the game just won, when it falls in the chosen view (ADR-035).
- **FR-41** Empty state: with 0 games played, the panel shows a friendly "No games yet" message rather than zeros and `NaN`.
- **FR-42** Stats are written atomically: read → transform → serialise → write; a failed write must never leave a partial record.

### 7.4 Settings

- **FR-43** Theme: `light | dark | system` (default `system`), applied by toggling a `dark` class on `<html>`; `system` subscribes to `prefers-color-scheme` changes live.
- **FR-44** Colourblind mode: boolean (default off) swapping green/yellow for a blue/orange palette with distinct tile glyph markers.
- **FR-45** Motion: `system | reduced | full` (default `system`, honouring `prefers-reduced-motion`).
- **FR-46** Default word length preference persists and is used for the next new game.
- **FR-47** **Reset statistics** clears aggregate + per-length metrics and the distribution. **Reset history** clears the recent-games log only. Both require a confirmation dialog naming exactly what will be deleted, and both are irreversible. The two actions live in each game's own Statistics dialog, so a reset reaches only that game's data (FR-67). The shared Settings dialog has no destructive actions.
- **FR-48** Settings changes apply immediately, with no page reload, and persist.

### 7.5 UI behaviour

- **FR-49** Layout: header (title, help button, length selector, stats button, settings button) → board → keyboard. Vertically centred, board scales to available space.
- **FR-50** The board renders 6 rows × `wordLength` tiles at all times, including empty rows.
- **FR-51** Tile states: `empty`, `filled` (letter typed, pre-submission — border emphasis, pop animation), `correct`, `present`, `absent`.
- **FR-52** Flip reveal: each tile flips sequentially with a 250 ms stagger, 500 ms per flip; colour applies at the midpoint. Input is locked until the row finishes.
- **FR-53** Keyboard keys adopt the best state seen so far, precedence `correct > present > absent`; a key never downgrades.
- **FR-54** Keys animate on press (physical or pointer) and transition colour after the row reveal completes.
- **FR-55** Toasts appear top-centre, stack up to 3, auto-dismiss after 2 s (errors 3 s), are dismissible, and never block input.
- **FR-56** Loading state: while a dictionary chunk loads, the board area shows a skeleton/spinner with accessible text `"Loading dictionary…"`; input is disabled.
- **FR-57** Modals (stats, settings, confirmations) trap focus, close on `Esc` and backdrop click, and restore focus to the invoking control.
- **FR-58** All interactive targets are ≥ 44 × 44 CSS px on touch viewports.
- **FR-59** The app renders correctly from 320 px to 2560 px wide, and in landscape on short viewports (≤ 480 px tall) without the keyboard being cut off.
- **FR-60** A **How to play** dialog, opened from a header control, states the guess count and the active word length from the engine constants and shows three worked tile examples (correct, present, absent), each with a plain-language sentence. Example words follow the selected length. The dialog is never opened by the app itself (ADR-020).

---

## 8. Non-Functional Requirements

| ID     | Requirement                                                                                                                                                                                                                                                                                             |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-1  | Initial JS payload ≤ 200 KB gzipped, excluding lazily loaded dictionary chunks.                                                                                                                                                                                                                         |
| NFR-2  | Time to interactive < 1.5 s on a mid-tier mobile device (Lighthouse mobile throttling).                                                                                                                                                                                                                 |
| NFR-3  | Guess evaluation + render < 16 ms; typing never drops a frame.                                                                                                                                                                                                                                          |
| NFR-4  | Lighthouse: Performance ≥ 95, Accessibility 100, Best Practices ≥ 95, SEO ≥ 90.                                                                                                                                                                                                                         |
| NFR-5  | Zero network requests after first load (verified in DevTools with the app running).                                                                                                                                                                                                                     |
| NFR-6  | Zero console errors or warnings during a full play session.                                                                                                                                                                                                                                             |
| NFR-7  | TypeScript `strict` with no `any`, no non-null assertions in `src/**` (test fixtures excepted).                                                                                                                                                                                                         |
| NFR-8  | Test coverage: 100% branches in `src/engine/**`; ≥ 85% statements overall.                                                                                                                                                                                                                              |
| NFR-9  | Supported browsers: last 2 versions of Chrome, Firefox, Safari, Edge; iOS Safari 16+.                                                                                                                                                                                                                   |
| NFR-10 | No runtime dependency beyond React, React DOM, and (dev) tooling.                                                                                                                                                                                                                                       |
| NFR-11 | All state mutations flow through the engine reducer or a storage repository — no ad-hoc `localStorage` calls in components.                                                                                                                                                                             |
| NFR-12 | The app must not crash on corrupted LocalStorage; it degrades to defaults.                                                                                                                                                                                                                              |
| NFR-13 | WordWeaver graph build plus first puzzle ≤ 400 ms p95 for 5 letters under Lighthouse mobile CPU throttling; each later puzzle ≤ 150 ms. If missed, generation moves to a Web Worker (no new dependency). Reference on desktop Node: 4 letters build 7 ms + BFS 6 ms; 5 letters build 45 ms + BFS 16 ms. |
| NFR-14 | WordWeaver adds no runtime dependency and no new data chunk. It reuses the `lists-4` and `lists-5` chunks, which gain a third export, the ladder list (FR-75); each chunk grows by no more than 15 KB gzipped.                                                                                          |
| NFR-15 | The entry bundle (shell + Home) stays within NFR-1, and Home triggers zero dictionary requests.                                                                                                                                                                                                         |
| NFR-16 | The WordWeaver engine follows the same purity lint rules and 100% branch coverage as the Wordwright engine (ADR-003, NFR-8).                                                                                                                                                                            |
| NFR-17 | The legacy storage import (FR-69) never deletes or modifies `wordwright:*` keys in this release.                                                                                                                                                                                                        |
| NFR-18 | WordStack, WordRange, WordCode and WordShuffle add no runtime dependency and no data chunk; they reuse the existing `lists-<n>` chunks.                                                                                                                                                                 |
| NFR-19 | Each game's engine follows the WordWeaver rule (NFR-16): purity lint and 100% branch coverage.                                                                                                                                                                                                          |
| NFR-20 | Each game's view is code-split and loaded only on its route, so the entry bundle stays within NFR-1 as games are added, and Home still triggers no dictionary requests (NFR-15).                                                                                                                        |
| NFR-21 | A WordStack Quad guess (four evaluations and four row reveals starting) renders within NFR-3's 16 ms budget.                                                                                                                                                                                            |

---

## 9. Accessibility Requirements

| ID      | Requirement                                                                                                                                                                                                                                                      |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A11Y-1  | Every action is reachable and operable by keyboard alone; logical tab order; no keyboard traps outside intentional modal traps.                                                                                                                                  |
| A11Y-2  | Board is `role="grid"` with `role="row"`/`role="gridcell"` children; each tile exposes `aria-label` like `"Row 2, letter 3: A, correct position"`.                                                                                                               |
| A11Y-3  | A polite `aria-live` region announces each evaluated guess in words (e.g. `"CRANE: C correct, R absent, A present, N absent, E correct. 4 guesses remaining."`).                                                                                                 |
| A11Y-4  | Errors are announced via an assertive live region as well as visually.                                                                                                                                                                                           |
| A11Y-5  | Game end is announced (`"You won in 4 guesses"` / `"Game over, the word was CRANE"`).                                                                                                                                                                            |
| A11Y-6  | Visible focus indicator on all focusable elements, ≥ 3:1 contrast against adjacent colours, never removed.                                                                                                                                                       |
| A11Y-7  | Text and UI contrast meets WCAG 2.1 AA (4.5:1 text, 3:1 large text/UI). Tile text on all five states verified.                                                                                                                                                   |
| A11Y-8  | Colour is never the only signal: colourblind mode plus optional tile markers; state is always in the `aria-label`.                                                                                                                                               |
| A11Y-9  | `prefers-reduced-motion: reduce` (or the reduced setting) removes flips, shakes, bounces, and confetti-like motion; transitions become instant colour swaps.                                                                                                     |
| A11Y-10 | On-screen keyboard keys are real `<button>`s with `aria-label`s (`"Backspace"`, `"Enter"`, letter + state).                                                                                                                                                      |
| A11Y-11 | Modals use `role="dialog" aria-modal="true"` with a labelled heading.                                                                                                                                                                                            |
| A11Y-12 | The page has a sensible `<title>`, one `<h1>`, and landmark regions (`header`, `main`, `footer`).                                                                                                                                                                |
| A11Y-13 | Help examples are decorative: the tiles are hidden from assistive technology and the meaning is carried by the sentence beneath, so no orphan `gridcell` semantics appear outside the board's grid.                                                              |
| A11Y-14 | Home lists the games as a `<ul>` of links, each with an accessible name such as "Play WordWeaver" and a one-line description. Every view has exactly one `<h1>`.                                                                                                 |
| A11Y-15 | On a view change, focus moves to the new view's `<h1>` (`tabindex="-1"`). In a game view, "All games" is the first item in tab order.                                                                                                                            |
| A11Y-16 | The WordWeaver board is a `grid` named "Word ladder". Rows are labelled Start, Rung _n_, Next rung and End. Tiles read like "Rung 2, letter 3: A, matches end word" or "…, does not match".                                                                      |
| A11Y-17 | A polite live region announces each accepted rung (`"CARD: 2 of 4 letters match"`), undo (`"Removed CARD"`), solve (`"Solved in 5 moves. Par 4."`) and give up (`"Gave up. One shortest ladder: COLD, CORD, CARD, WARD, WARM"`). Errors stay assertive (A11Y-4). |
| A11Y-18 | Enter to continue (FR-72) never moves focus, and **Play again** stays reachable with Tab.                                                                                                                                                                        |
| A11Y-19 | WordWeaver reuses the existing `correct` and `absent` tile tokens and glyph markers in both palettes, so no new colour pairs are introduced.                                                                                                                     |
| A11Y-20 | WordStack boards are separate `grid`s named "Board 1 of 4" and so on, with "solved" added once solved. Split keyboard keys carry every board's state in their label, for example "A: board 1 present, board 2 absent, board 3 solved, board 4 absent".           |
| A11Y-21 | WordStack announces one summary per guess: `"CRANE. Board 1: 2 correct, 1 present. Board 2: solved. 6 guesses left."`                                                                                                                                            |
| A11Y-22 | WordRange announces each guess with its direction, the new range and the heat in words: `"BRAVE: the word is after it. Range BRAVE to ZZZZZ. Freezing. 13 guesses left."` Heat never relies on colour alone.                                                     |
| A11Y-23 | WordCode announces counts in words (`"PANEL: 1 bull, 3 cows. 9 guesses left."`). In Mark mode every letter key is named with its current mark, and a marked key keeps that name in Type mode. The Type and Mark switch is a pair of toggle buttons.              |
| A11Y-24 | WordShuffle tray letters are buttons labelled with the letter and remaining count. Hints, reshuffles and solves are announced, and the answer row is labelled with hinted letters marked.                                                                        |

---

## 10. Edge Cases

| ID    | Case                                                                                  | Expected behaviour                                                                                                                       |
| ----- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| EC-1  | Duplicate letters in guess and/or answer                                              | Per §6.3 algorithm; verified by truth table                                                                                              |
| EC-2  | Enter with an empty or partial row                                                    | `"Not enough letters"`, shake, no turn used                                                                                              |
| EC-3  | Non-alphabetic keys (digits, symbols, arrows, F-keys)                                 | Ignored, no toast                                                                                                                        |
| EC-4  | Modifier combos (`Ctrl+R`, `Cmd+C`, `Alt+Tab`)                                        | Never intercepted; browser behaviour preserved                                                                                           |
| EC-5  | Key repeat from a held key                                                            | Treated as normal input, capped by row length                                                                                            |
| EC-6  | Paste into the page                                                                   | Ignored in V1 (no text input element to paste into)                                                                                      |
| EC-7  | Typing while a modal is open                                                          | Goes to the modal, not the board                                                                                                         |
| EC-8  | Typing during reveal animation                                                        | Buffered? No — ignored, to keep state predictable                                                                                        |
| EC-9  | Refresh mid-game                                                                      | Game restored exactly, including elapsed time baseline                                                                                   |
| EC-10 | Refresh mid-reveal                                                                    | Restored with the last submitted row already fully revealed                                                                              |
| EC-11 | LocalStorage unavailable (Safari private mode, quota)                                 | App runs on an in-memory fallback; one warning toast: `"Progress can't be saved in this browser mode"`                                   |
| EC-12 | Corrupted / hand-edited LocalStorage JSON                                             | Discarded, defaults used, one warning toast; app never crashes                                                                           |
| EC-13 | Stats schema from an older version                                                    | Migrated by the migration chain; unknown newer version → reset to defaults with a toast                                                  |
| EC-14 | Dictionary chunk fails to load                                                        | Error state with a **Retry** button; the game does not start until it succeeds                                                           |
| EC-15 | Word length changed mid-game with guesses made                                        | Confirmation dialog; on confirm the game is abandoned (no stats effect)                                                                  |
| EC-16 | Two tabs open on the same origin                                                      | Last write wins; a `storage` event refreshes settings and stats in the other tab; the in-progress game is not synced                     |
| EC-17 | System theme changes while the app is open (`system` mode)                            | Theme updates live                                                                                                                       |
| EC-18 | Very narrow (320 px) or short (landscape phone) viewport                              | Board and keyboard both remain fully visible; tiles shrink, no horizontal scroll                                                         |
| EC-19 | Extremely long session / clock change                                                 | Solve time uses a monotonic clock; never negative, capped and flagged if > 24 h                                                          |
| EC-20 | Answer pool exhausted by the no-repeat rule                                           | Ring buffer resets; play continues                                                                                                       |
| EC-21 | A rendering error inside the app                                                      | Error boundary shows a recovery screen with **Reload** and **Reset data**                                                                |
| EC-22 | Unknown or malformed hash (`#/foo`, `#weaver`)                                        | Home is shown and the URL is corrected with `history.replaceState` (no extra history entry)                                              |
| EC-23 | Player leaves a game view mid-reveal                                                  | On return, the game is restored with that row fully revealed (EC-10 rule)                                                                |
| EC-24 | Player leaves a game view within the session-save debounce window                     | The last keystroke is kept: the session is flushed on unmount (FR-65)                                                                    |
| EC-25 | Import marker exists but an old tab still writes `wordwright:*` keys                  | New keys win; the import never runs again                                                                                                |
| EC-26 | A legacy key holds corrupt JSON                                                       | Copied as-is; the normal read path resets that slice with one toast (EC-12)                                                              |
| EC-27 | Storage unavailable at boot                                                           | Import skipped; the app runs in memory (EC-11)                                                                                           |
| EC-28 | Two tabs open on different games                                                      | Per-game keys stay independent; shared appearance settings sync through `storage` events (EC-16)                                         |
| EC-29 | WordWeaver rung repeats the start word or an earlier rung                             | `"Already used"`, shake, no move                                                                                                         |
| EC-30 | Undo with no rungs, or Backspace on an empty row                                      | Nothing happens, no toast                                                                                                                |
| EC-31 | Player reaches the end word in more moves than par                                    | Solved; the result shows `+n` over par                                                                                                   |
| EC-32 | No end word falls inside the par band                                                 | Fallback chain in FR-78                                                                                                                  |
| EC-33 | Restored WordWeaver session is invalid under the current word lists                   | Discarded silently; a fresh puzzle starts (FR-93)                                                                                        |
| EC-34 | 500th move reached                                                                    | Rung input disabled with toast `"Move limit reached"`; Give up still works                                                               |
| EC-35 | Enter held down through the final submission                                          | Key repeats are ignored; no automatic Play again (FR-73)                                                                                 |
| EC-36 | Enter pressed while a dialog is open over the result panel                            | Goes to the dialog, not Play again                                                                                                       |
| EC-37 | Old bookmark to `/wordwright/` after the rename                                       | A redirect page at the old path forwards to `/wordgames/` (T-73)                                                                         |
| EC-38 | Browser Back while a dialog is open                                                   | The dialog closes and focus moves to the new view's `<h1>`                                                                               |
| EC-39 | WordStack guess solves one board but not the others                                   | That board freezes as solved; the next guess goes to the remaining boards only                                                           |
| EC-40 | WordStack final allowed guess solves the last board                                   | Won                                                                                                                                      |
| EC-41 | WordStack answer draw would repeat a board's answer                                   | Redrawn; answers within a game are always different                                                                                      |
| EC-42 | WordRange guess before the lower bound or after the upper bound                       | `"Outside the range"`, shake, no guess used. A guess equal to a bound is an earlier guess, so it gets `"Already guessed"` (FR-117 order) |
| EC-43 | WordRange guess repeated                                                              | `"Already guessed"`, shake, no guess used                                                                                                |
| EC-44 | WordCode guess or secret with repeated letters                                        | Counts follow FR-12 and FR-13 (FR-129)                                                                                                   |
| EC-45 | WordCode reload with letter notes set                                                 | Notes restored with the session                                                                                                          |
| EC-46 | WordShuffle typed letter not left in the tray                                         | Ignored, no toast                                                                                                                        |
| EC-47 | WordShuffle answer is a valid anagram other than the drawn target                     | Solved (FR-141)                                                                                                                          |
| EC-48 | WordShuffle answer would move a hinted letter                                         | Not possible through the UI (locked letters); the engine rejects it as a guard (FR-140)                                                  |
| EC-49 | WordShuffle scramble would itself be a word                                           | Reordered, or another target drawn (FR-138)                                                                                              |
| EC-50 | A game's code chunk fails to load (for example after a deploy while the tab was open) | Inline panel `Couldn't load this game.` with **Retry** and an **All games** link; no error boundary                                      |

---

## 11. Error Handling

| Condition                | Surface                          | Message                                            | Recovery                       |
| ------------------------ | -------------------------------- | -------------------------------------------------- | ------------------------------ |
| Short guess              | Toast (assertive)                | `Not enough letters`                               | Keep typing                    |
| Unknown word             | Toast (assertive)                | `Not in word list`                                 | Try another word               |
| Dictionary load failure  | Inline panel                     | `Couldn't load the word list.`                     | **Retry** button               |
| Storage unavailable      | Toast (polite, once per session) | `Progress can't be saved in this browser mode`     | Continue in memory             |
| Corrupt saved data       | Toast (polite)                   | `Saved data was reset because it couldn't be read` | Continue with defaults         |
| Unexpected render error  | Full-screen error boundary       | `Something went wrong` + digest                    | **Reload** / **Reset data**    |
| Rung changes ≠ 1 letter  | Toast (assertive)                | `Change exactly one letter`                        | Edit the rung                  |
| Rung already in ladder   | Toast (assertive)                | `Already used`                                     | Try another word               |
| Move limit reached       | Toast (assertive)                | `Move limit reached`                               | **Give up** / **New puzzle**   |
| Puzzle generation fails  | Inline panel                     | `Couldn't create a puzzle.`                        | **Retry** button               |
| Game code failed to load | Inline panel                     | `Couldn't load this game.`                         | **Retry** / **All games**      |
| Repeated range guess     | Toast (assertive)                | `Already guessed`                                  | Try another word               |
| Guess outside range      | Toast (assertive)                | `Outside the range`                                | Pick a word between the bounds |

Principles: never a raw stack trace in the UI; never a silent failure; every error has a next action; errors are announced to assistive tech.

---

## 12. Acceptance Criteria (Given / When / Then)

- **AC-1** Given a 5-letter game, when I submit a valid 5-letter word, then each tile flips in sequence and shows the correct state per §6.3.
- **AC-2** Given the answer `ABBEY`, when I guess `BABES`, then the evaluation is exactly `[present, present, correct, correct, absent]`.
- **AC-3** Given a 4-letter word, when I type a 5th letter, then nothing happens and no error appears.
- **AC-4** Given a partial row, when I press Enter, then I see `Not enough letters`, the row shakes, and my remaining guesses are unchanged.
- **AC-5** Given the word `ZZZZZ` is not in the guess list, when I submit it, then I see `Not in word list` and no turn is consumed.
- **AC-6** Given I guess the answer on turn 3, then the game ends as won, the result panel shows my score and time, and stats record a 3-guess win exactly once.
- **AC-7** Given I use all 6 guesses without success, then the game ends as lost, the answer is displayed, and my current streak becomes 0.
- **AC-8** Given a completed game, when I press **Play again**, then a new answer is chosen (different from the previous one) and the board resets.
- **AC-9** Given an in-progress game with 2 guesses, when I reload the page, then the same board, answer, and elapsed-time baseline are restored.
- **AC-10** Given I switch from 5 to 6 letters mid-game, then I am asked to confirm, and on confirm a fresh 6-letter game starts with no stats change.
- **AC-11** Given 10 completed games, when I open statistics, then played/won/win %/streaks/average guesses/distribution/total score/average & fastest solve all match a hand-computed expectation.
- **AC-12** Given I reset statistics, when I confirm, then all metrics return to zero and the empty state is shown; settings are untouched.
- **AC-13** Given theme `system` and OS dark mode, then the app renders dark; toggling the OS setting updates it live without reload.
- **AC-14** Given colourblind mode on, then correct/present tiles use the blue/orange palette and carry distinct markers, verified at AA contrast.
- **AC-15** Given `prefers-reduced-motion: reduce`, then no flip, shake, or bounce animation runs; results appear instantly.
- **AC-16** Given a screen reader, when a guess is evaluated, then the result and remaining guesses are announced once, in order.
- **AC-17** Given keyboard-only navigation, then I can open stats, change every setting, close modals with `Esc`, and return focus to the trigger.
- **AC-18** Given the network is disabled after first load, then a full game can be played end to end with zero failed requests.
- **AC-19** Given LocalStorage is blocked, then the app still plays a full game and shows the storage warning exactly once.
- **AC-20** Given `npm run verify`, then typecheck, lint, format check, and all tests pass with no warnings.
- **AC-21** Given a Lighthouse mobile run on the production build, then the NFR-4 thresholds are met.
- **AC-22** Given a 320 px-wide viewport, then the board and keyboard fit with no horizontal scrolling and all targets remain ≥ 44 px.
- **AC-23** Given a 4-letter game, when I open **How to play**, then the copy says "6 tries" and "valid 4 letter word" and each example row shows 4 tiles.

**Suite shell and rename**

- **AC-24** Given a fresh visit to `/wordgames/`, then Home shows a Wordwright card and a WordWeaver card, and no `lists-*` chunk is requested.
- **AC-25** Given Home, when I activate the WordWeaver card, then the URL ends in `#/weaver`, the `<h1>` reads "WordWeaver" and has focus, and browser Back returns to Home.
- **AC-26** Given a direct load of `#/wordwright`, then Wordwright opens without passing through Home.
- **AC-27** Given legacy `wordwright:v1:*` keys holding dark theme, 12 completed games and a game in progress with 2 guesses, when the renamed app loads, then the page is dark before first paint, Wordwright stats show 12 games, the 2-guess game is restored, and `wordgames:v1:meta` exists. A second load does not import again, and the legacy keys are unchanged.

**Enter to continue**

- **AC-28** Given I win Wordwright by pressing physical Enter, when the result panel appears, then no new game starts. When I press Enter again, a new game starts.
- **AC-29** Given I solve a WordWeaver puzzle by pressing physical Enter on the end word, when the result panel appears, then no new puzzle starts. When I press Enter again, a new puzzle of the same length starts.

**WordWeaver** (fixture: start `COLD`, end `WARM`, par 4)

- **AC-30** When I submit `CORD`, `CARD`, `WARD`, `WARM`, then the game is solved with 4 moves, par 4, the result reads "Par!", and stats record one solve and one par hit.
- **AC-31** Given my last rung is `CORD`, when I submit `CARE` (two letters changed), then I see `Change exactly one letter`, the row shakes, and the move count is unchanged.
- **AC-32** Given my last rung is `CORD`, when I submit `COLD`, then I see `Already used` and the move count is unchanged.
- **AC-33** Given rungs `CORD` and `CARD` (2 moves), when I tap **Undo**, then `CARD` is removed and moves stay at 2. When I submit `CARD` again, moves become 3.
- **AC-34** Given end word `WARM`, then rung `CARD` evaluates to exactly `[absent, correct, correct, absent]`, and the start row `COLD` to `[absent, absent, absent, absent]`.
- **AC-35** Given 2 rungs, when I give up and confirm, then the game ends as `gave-up`, the result shows a ladder with `par` steps where every step changes one letter and every word is in the ladder list, and stats show played +1, gave up +1 and current streak 0.
- **AC-36** Given `seededRandom` and the real 4- and 5-letter lists, then 200 generated puzzles per length each have start ≠ end, both words in the answer list, par inside `PAR_BAND`, and par equal to an independent reference BFS over the ladder list.
- **AC-37** Given a production build under Lighthouse mobile CPU throttling, then 5-letter generation meets NFR-13.

**Cross-game**

- **AC-38** Given 10 completed Wordwright games, when I reset WordWeaver statistics, then Wordwright statistics are unchanged.
- **AC-39** Given a WordWeaver game with at least one rung, when I press **New puzzle** or switch length, then I am asked to confirm, and **Cancel** keeps the ladder untouched.
- **AC-40** Given a WordWeaver game in progress, when I go Home and come back, then the ladder, move count and typed letters are restored exactly.
- **AC-41** Given keyboard-only navigation, then I can pick either game, play it to the end, and return Home.
- **AC-42** Given WordWeaver at 4 letters, when I open **How to play**, then the example shows 4 tiles; at 5 letters it shows 5.
- **AC-43** Given axe scans of Home and WordWeaver in both palettes and both themes, then there are zero serious or critical issues.
- **AC-44** Given a puzzle where a guess-list word outside the ladder list gives a shorter path, when I solve it in fewer moves than par, then the result reads "Under par by n!", stats record a par hit, and average over par can go below zero.

**More games (R2–R5)**

- **AC-45** Given the release that ships a game, then Home shows its card in catalogue order, its route opens it with the right title and `<h1>`, and routes for games not yet shipped go Home.
- **AC-46** Given WordStack Duo with answers `PLANT` and `STORM`, when I guess `PANEL`, then board 1 shows `[correct, present, present, absent, present]` and board 2 shows `[absent, absent, absent, absent, absent]`.
- **AC-47** Given WordStack Duo where my third guess solves board 1, when I make a fourth guess, then it appears only on board 2 and board 1 drops out of the keys, which now split across board 2 only, and board 1 shows only the three rows it used.
- **AC-48** Given WordStack Quad, when 9 guesses pass with two boards unsolved, then the game is lost and both unsolved answers are shown.
- **AC-49** Given WordRange with secret `PLANT`, when I guess `BRAVE`, then it is marked "after", the range becomes `BRAVE … ZZZZZ` and the heat is Freezing. When I guess `PLAIN`, the heat is Burning.
- **AC-50** Given WordRange range `BRAVE … STORM`, when I guess `ABOUT`, then I see `Outside the range` and the guess count is unchanged.
- **AC-51** Given WordCode with secret `PLANT`, when I guess `PANEL`, then the row shows "1 bull · 3 cows". At engine level, secret `SPEED` and guess `EEEEE` give 2 bulls and 0 cows.
- **AC-52** Given WordCode with letters marked in the notes, when I reload, then the marks are restored and the keyboard shows them.
- **AC-53** Given WordShuffle with target `LISTEN`, when I submit `SILENT`, then the puzzle is solved and the result lists the other valid anagrams.
- **AC-54** Given WordShuffle with one hint taken, then one letter of the target is locked in its place, typing fills only the other positions, Backspace never removes it, and the engine rejects any submission that moves it.
- **AC-55** Given any of the four new games, when I finish a game with physical Enter and press Enter again, then the first press does not restart and the second does (FR-100).
- **AC-56** Given 5 completed games in each game, when I reset one game's statistics, then every other game's statistics are unchanged.
- **AC-57** Given axe scans of each new game in both themes and both palettes, then there are zero serious or critical issues.

---

## 13. Traceability

Every requirement above maps to at least one task in [`TASKS.md`](./TASKS.md) and one checklist item in [`ACCEPTANCE.md`](./ACCEPTANCE.md). Changes to this document require updating both, in the same pull request.

---

## 14. Suite Shell & Navigation

The shell wraps both games. It owns the URL, Home, the header frame, shared settings and the storage layout. Rationale in ADR-021 to ADR-024 and ADR-027.

### 14.1 Name and views

- **FR-61** The product is named **wordgames**. That name is used for the page title on Home, the Home `<h1>`, the package name and the GitHub Pages base path `/wordgames/`. "Wordwright" and "WordWeaver" are the names of the games inside it.
- **FR-62** There are three views, chosen by the URL hash: `#/` (Home), `#/wordwright` and `#/weaver`. An empty or unknown hash shows Home, and the URL is corrected with `history.replaceState` so no extra history entry is created. Back and Forward move between views (ADR-022).
- **FR-63** Home shows one card per game with its name, a one-line description and a link to its view. Home loads no dictionary chunk and mounts no game provider.
- **FR-64** In a game view the header shows, in order: an **All games** link back to `#/`, the game name as the `<h1>`, the game's controls (How to play, length selector, statistics), then settings. On Home the header shows the suite name and settings only. Wordwright's **New game** button (US-6, FR-34) is one of those controls: placed in the header, it costs no vertical space, so the board and keyboard still fit at 320 px and in short landscape (AC-22, EC-18).
- **FR-65** Leaving a game view does not abandon the game. The game's session is written immediately when the view unmounts, skipping the debounce, and restored when the player returns. No confirmation is shown.
- **FR-66** `document.title` is `wordgames` on Home, `Wordwright · wordgames` and `WordWeaver · wordgames` in the games.

### 14.2 Settings and storage

- **FR-67** Appearance settings (theme, colourblind, motion) are shared by the whole suite and apply on Home too. Default word length, statistics, history and the in-progress session belong to each game. Resetting one game's statistics or history never touches the other game.
- **FR-68** Storage keys:

| Key                                                  | Contents                                                                  |
| ---------------------------------------------------- | ------------------------------------------------------------------------- |
| `wordgames:v1:settings`                              | `{ theme, colorblind, motion }`                                           |
| `wordgames:v1:meta`                                  | `{ schemaVersion, importedFrom, importedAt }`                             |
| `wordgames:v1:wordwright:{prefs,stats,session,meta}` | Existing Wordwright shapes, unchanged. `prefs` is `{ defaultWordLength }` |
| `wordgames:v1:weaver:{prefs,stats,session,meta}`     | WordWeaver shapes (§16). `meta` is `{ recentStarts: { 4: [], 5: [] } }`   |

- **FR-69** Legacy import. Before the first render, if `wordgames:v1:meta` is absent and any `wordwright:v1:*` key exists, the app copies the old data across:
  - `wordwright:v1:settings` is split into the shared settings and Wordwright `prefs`.
  - `stats`, `session` and `meta` are copied as-is to the matching `wordgames:v1:wordwright:*` keys.
  - `wordgames:v1:meta` is written **last**, so an interrupted import runs again on the next load.
  - Legacy keys are left in place (NFR-17). The import runs at most once, never throws, and on any failure continues with defaults.
- **FR-70** The inline theme script in `index.html` reads `wordgames:v1:settings` and falls back to `wordwright:v1:settings`, so a returning player never sees a flash of the wrong theme on the first load after the rename.
- **FR-71** **Reset data** on the error screen (EC-21) clears every `wordgames:` and `wordwright:` key.

_The shared confirmation dialog required by FR-34 and FR-47 is built once for the suite and used by both games (T-52)._

### 14.3 Enter to continue

- **FR-72** While a game's result panel is shown, pressing physical **Enter** starts the next game, the same as activating **Play again**. This applies to both games. The keypress is ignored when a modifier key is held, when `event.repeat` is true, when a dialog is open, or when focus is on a button, link or text field (the focused control keeps its normal Enter behaviour, so nothing fires twice).
- **FR-73** The Enter listener is attached only once the result panel has mounted, which happens after the final reveal completes. Together with ignoring key repeats, this means the Enter press that submitted the winning guess or final rung can never also start a new game. Focus is never moved to **Play again** automatically.

### 14.4 More games (releases R2–R5)

Four more games ship after Suite V1, one per release, in this order: **R2 WordStack** (§17), **R3 WordRange** (§18), **R4 WordCode** (§19), **R5 WordShuffle** (§20). Each release is a normal deploy; there are no feature flags.

- **FR-97** The suite keeps one static **game catalogue**: an ordered, read-only list with each game's id, name, one-line description, route and lazily loaded view (ADR-028). Home renders one card per catalogue entry, in catalogue order. A game is added to the catalogue in the release that ships it. Until then its route is unknown and goes Home (EC-22).
- **FR-98** Routes for the new games are `#/stack`, `#/range`, `#/code` and `#/shuffle`. Page titles follow FR-66, for example `WordStack · wordgames`.
- **FR-99** Every game stores its data under `wordgames:v1:<gameId>:{prefs,stats,session,meta}`, following FR-68. Statistics, history and session are never shared between games.
- **FR-100** Enter to continue (FR-72, FR-73) and leaving without abandoning (FR-65) apply to every game in the catalogue. In games with no reveal animation (WordRange, WordCode, WordShuffle), the result panel mounts after the keydown that ended the game has been handled, so FR-73\'s protection still holds; each of those games tests it explicitly.
- **FR-101** Every game's header follows FR-64. Its game controls are How to play, a selector where the game has one (word length, or board count for WordStack), and Statistics. Every game has its own How to play dialog, never opened automatically (ADR-020), and its examples follow A11Y-13.

---

## 15. WordWeaver Gameplay Rules

WordWeaver is a word ladder. The player sees a start word and an end word of the same length and builds a ladder between them. Each rung changes exactly one letter of the word above it and must be a real word. Letters that already match the end word in the same position turn green.

Example: `EAST → VAST → VEST → WEST`.

### 15.1 Setup and puzzle generation

- **FR-74** Word length is 4 or 5; default 4. The WordWeaver length preference is stored separately from Wordwright's.
- **FR-75** Word lists. WordWeaver uses three lists per length, all from the existing `lists-<n>` module:
  - **answer list**: where start and end words come from.
  - **ladder list** (new): the common words, ranked by the same word-frequency data as the answer list: the 1,400 most frequent 4-letter words and the 5,000 most frequent 5-letter words, each plus every answer. It is a superset of the answer list and a subset of the guess list. Par and the give-up ladder use only these words. The sizes were fixed by measurement (§15.1, T-58).
  - **guess list**: every word the player may type as a rung.
- **FR-76** The **ladder graph** for a length has one node per ladder-list word. Two words are joined when they differ in exactly one position. **Par** is the shortest-path distance from start to end in this graph, counted in edges. That equals the number of rungs needed, including the end word.
  - Why: over the full guess list, obscure words make par feel unfair. `EAST → WEST` has par 2 there, through `WAST`. With the ladder list, par is what a player can reach with everyday words. Without `WAST`, par for `EAST → WEST` is expected to be 3, for example through `VAST` and `VEST` (the example above) or `PAST` and `PEST`.
  - Players may still type any guess-list word, so a player who knows a rare word can finish **under par** (FR-84).
- **FR-77** A puzzle is a start word S and an end word E, both from the answer list, with S ≠ E, E reachable from S in the ladder graph, and `PAR_BAND[length].min ≤ par ≤ PAR_BAND[length].max`. `PAR_BAND` is an engine constant, **4 letters: 4–6, 5 letters: 4–7**. The bands and the ladder-list size were fixed by the measurement task (T-58, table below). The rule is the smallest frequency cut-off where at least 90% of answer-list starts have one or more in-band ends, within the 15 KB gzip budget of NFR-14. 4 letters meets it at 1,400 words. 5 letters cannot: the best cut that fits the budget, 5,000 words, gives 74.9%. That is enough for generation, because FR-78 tries up to 20 starts. The measurement is repeated whenever the lists are regenerated.
- **FR-78** Generation uses the injected random source (ADR-003):
  1. Pick S at random from the answer list, skipping any start used in the last 20 puzzles of that length.
  2. Run one breadth-first search from S over the ladder graph.
  3. Collect the answer-list words whose distance falls inside `PAR_BAND` and pick E at random from them.
  4. If none qualify, pick another S. Try up to 20 starts.
  5. If still none, accept any reachable answer-list word at distance ≥ 3.
  6. If that also fails, show the "Couldn't create a puzzle." panel with **Retry** (EC-32).

_Baseline par distribution over the **full guess list**, 200 random starts × 700 answers (October 2026 lists). T-58 repeats this over the ladder list:_

| Length | Par 3 | Par 4 | Par 5 | Par 6 | Par 7 | Par 8+ | Unreachable | Inside band |
| ------ | ----- | ----- | ----- | ----- | ----- | ------ | ----------- | ----------- |
| 4      | 13.1% | 27.9% | 28.6% | 15.9% | 7.3%  | 2.8%   | 0.1%        | 72% (4–6)   |
| 5      | 1.1%  | 2.9%  | 6.1%  | 10.4% | 14.4% | 55.5%  | 9.1%        | 34% (4–7)   |

_Measured over the **ladder list** (T-58, `node scripts/measure-par.mjs`, October 2026 lists). Every answer is a start and every other answer an end, 700 × 699 pairs. "Unreachable" counts pairs with no ladder over the common words._

| Length | Ladder words | Par ≤ 3 | Par 4 | Par 5 | Par 6 | Par 7 | Par 8+ | Unreachable | Inside band | Starts with an in-band end |
| ------ | ------------ | ------- | ----- | ----- | ----- | ----- | ------ | ----------- | ----------- | -------------------------- |
| 4      | 1,400        | 8.2%    | 11.2% | 16.0% | 16.0% | 12.1% | 19.1%  | 17.4%       | 43.3% (4–6) | 90.9%                      |
| 5      | 5,000        | 1.0%    | 1.0%  | 1.7%  | 2.7%  | 3.7%  | 43.3%  | 46.5%       | 9.2% (4–7)  | 74.9%                      |

_How the sizes were chosen. For 4 letters the share of starts with an in-band end passes 90% at 1,400 words (89.7% at 1,300, 90.9% at 1,400, 97.4% at 3,000). For 5 letters it keeps rising with size but is only 60.6% at 3,000 words and 74.9% at 5,000, and 5,000 is the largest list that fits NFR-14 (the `lists-5` chunk grew by 13.2 KB gzipped; `lists-4` by 2.6 KB). For reference, the whole 13,746-word guess list reaches only 93.4% for 5 letters. Widening the 5-letter band does not help: the starts with no in-band end are mostly in small, disconnected groups of common words, so 4–10 gives the same 74.9% at 5,000 words. The ladder list takes ENABLE1 words that have frequency data, not only the `popular` subset: the 2,998 popular 5-letter words connect only 56.9% of starts._

_5-letter pairs are usually far apart, so drawing E from the in-band candidates (step 3) matters more than drawing pairs at random. The answer list alone (700 words) is too sparse to serve as the ladder list: only 0.1% of in-band 5-letter pairs have an optimal ladder made entirely of answer words, against 4.7% for 4 letters. Hence the separate ladder list._

### 15.2 Input and validation

- **FR-79** Input works as in Wordwright (FR-6 to FR-10): A–Z only, Backspace removes a letter, Enter submits, from the physical or on-screen keyboard.
- **FR-80** A submitted rung is checked in this order. A rejected rung shakes the row, shows the toast, and does not count as a move.
  1. Fewer letters than the word length → `Not enough letters`.
  2. Not in the guess list → `Not in word list`.
  3. Does not differ from the word above it in exactly one position → `Change exactly one letter`.
  4. Already in the ladder (the start word or any current rung) → `Already used`.

### 15.3 Evaluation

- **FR-81** `evaluateRung(rung, end)` marks position _i_ as `correct` when `rung[i] === end[i]`, otherwise `absent`. There is no `present` (yellow) state. The start row is evaluated the same way when the puzzle loads. The end row always shows all `correct`.

### 15.4 Completion, undo and give up

- **FR-82** The puzzle is solved when the player submits the end word itself as a rung. It must pass FR-80 like any other rung, so the end word can only be entered from one of its neighbours. Status becomes `solved`.
- **FR-83** **Undo** removes the most recent accepted rung. It is triggered only by the **Undo** button. Backspace on an empty input row does nothing and never removes a rung (ADR-036). The start word cannot be removed. With no rungs, undo does nothing and shows no toast (EC-30). Undo is blocked during a reveal and after the game ends. An undone word may be used again later.
- **FR-84** Counting:
  - `moves` = every accepted rung submission in the game, **including rungs later undone**. Undo itself is not a move.
  - `ladderLength` = number of rungs in the finished ladder, including the end word.
  - `overPar = moves − par`. It is negative when the player beats par with a word outside the ladder list (FR-76).
  - A **par hit** is a solve with `moves ≤ par`.
- **FR-85** There is no rung limit and no lost state. As a safety cap, rung input is disabled once `moves` reaches 500; **Give up** and **New puzzle** still work (EC-34).
- **FR-86** **Give up** asks for confirmation when at least one rung has been played. It ends the game with status `gave-up` and reveals one optimal ladder from the start word. The ladder is a shortest path over the ladder graph. Among equal-length paths, one using the most answer-list words is preferred. Ties are broken deterministically (alphabetical order of neighbours) so the same puzzle always shows the same solution.
- **FR-87** WordWeaver has no numeric score. A result is judged by `moves` against `par`.

---

## 16. WordWeaver Functional Requirements

- **FR-88** Board layout, top to bottom: the start row (evaluated), accepted rungs, the input row, and the end row. The end row stays visible at the bottom of the board. The rung area scrolls when it overflows and keeps the input row in view.
- **FR-89** Accepted rungs reveal with the same sequential flip as FR-52, using two states. Reduced motion follows A11Y-9.
- **FR-90** The on-screen keyboard has the same layout as Wordwright's but no letter-state colours. **Undo**, **Give up** and **New puzzle** buttons sit next to the board and meet FR-58.
- **FR-91** The result panel shows:
  - "Solved!" or "Gave up"
  - moves and par, with "Par!" when `moves === par`, "Under par by n!" when below it, or "+n" when above it
  - the player's final ladder, and after a give up, the optimal ladder (FR-86)
  - **Play again** (same length) and **Change length**
- **FR-92** Statistics are kept overall and per length, and recorded once per game (idempotent by game id):
  - games played, solved, given up, and solve % (derived)
  - par hits
  - average over par, for solved games only, one decimal (can be negative), `—` when no games are solved
  - best against par: the best single solve, shown as `Par`, `−1` for one under par or `+2` for two over, `—` when no games are solved
  - current streak and best streak: a solve adds one, a give up resets to 0. Abandoned games (New puzzle, length change) are not recorded and do not affect streaks.
  - the last 50 games, newest first: `{ id, playedAt, length, start, end, par, moves, ladderLength, solved }`
  - added later (ADR-035): average and fastest solve time, a chart of solves by moves over par (par, +1, +2, +3, +4 or more), undos per solve, and the hardest par solved. Each record carries `solveMs`.
- **FR-93** The in-progress game (start, end, par, rungs, moves, current input, length, status) is saved after every change with the same debounce as Wordwright, and also on page hide and view unmount (FR-65). On restore it is discarded silently, and a new puzzle starts, if: the length doesn't match, start or end is no longer in the answer list, any rung is no longer in the guess list, or the ladder breaks the one-letter rule.
- **FR-94** **New puzzle** and a length change ask for confirmation when at least one rung has been played, using the shared confirmation dialog. Confirming abandons the game with no effect on statistics.
- **FR-95** WordWeaver has its own **How to play** dialog: the rules in short sentences, the meaning of green and grey, how undo and give up work, and a small worked example that follows the selected length and palette. It is never opened automatically (ADR-020). Examples follow A11Y-13.
- **FR-96** While the dictionary loads and the graph builds, the board area shows a skeleton with the accessible text `"Preparing puzzle…"` and input is disabled. A dictionary failure shows the EC-14 Retry panel.

---

## 17. WordStack (release R2)

Wordle on two or four boards at once. Every guess is played on every unsolved board, and the player must solve them all within the guess limit. Based on Dordle and Quordle. Rationale in ADR-029.

### 17.1 Rules

- **FR-102** Two modes: **Duo**, with 2 boards and 7 guesses, and **Quad**, with 4 boards and 9 guesses. The default is Duo, and the mode preference persists. Words are always 5 letters.
- **FR-103** Each game draws one answer per board from the 5-letter answer list, all different. Answers follow FR-4's no-repeat rule, with one ring buffer for WordStack shared by both modes.
- **FR-104** Input and validation follow Wordwright: FR-6 to FR-11 for input, and FR-14 to FR-17 for checking a guess. A rejected guess costs no turn on any board.
- **FR-105** An accepted guess is added to every unsolved board, and each board scores it against its own answer with the §6.3 algorithm (`evaluateGuess`). All boards reveal together.
- **FR-106** A board is solved when a guess equals its answer. A solved board takes no further guesses; its remaining rows stay empty and it is marked "Solved".
- **FR-107** The game is won when every board is solved within the guess limit. It is lost when the limit is reached with any board unsolved, and the result shows every unsolved answer.

### 17.2 Interface

- **FR-108** Layout: Duo shows the boards side by side. Quad shows a 2 × 2 grid. When the boards don't fit above the keyboard, the board area scrolls and the keyboard stays visible (FR-59).
- **FR-109** Each keyboard key is split into one segment per board: left and right halves for Duo, quarters for Quad. Each segment shows that board's best state for the letter, following FR-53. A solved board drops out of the keys, so they split across the open boards only, and are plain once one board is left. A solved board's grid shows only the rows it used.
- **FR-110** The result panel shows won or lost, guesses used out of the limit, how many boards were solved, the answers, and **Play again** (same mode) and **Change mode**.
- **FR-111** Statistics are kept overall and per mode, and recorded once per game (idempotent by game id):
  - games played, won, win % (derived), and current and best streak
  - the guess distribution for wins, with buckets 2–7 for Duo and 4–9 for Quad
  - the last 50 games, newest first: `{ id, playedAt, mode, answers, guessesUsed, boardsSolved, won }`
  - added later (ADR-035): average and fastest win time, losses with all boards but one solved ("so close"), boards solved per loss, the average guess on which the first board falls, and on the All view a chart of wins by guesses to spare. Each record carries `solveMs` and `boardSolveGuesses`.
- **FR-112** The in-progress game is saved and restored as in FR-32, FR-33 and FR-65. A restore is discarded if any answer has left the answer list.
- **FR-113** Restarting or switching mode with at least one guess played asks for confirmation through the shared dialog, and has no effect on statistics.
- **FR-114** The How to play dialog explains shared guesses, the per-board colours and the split keyboard, with a two-board example.

---

## 18. WordRange (release R3)

Find a secret word by its place in the dictionary. Each guess says whether the secret comes before or after it, and a heat meter says how close you are. Based on Betweenle and Alphaguess. Rationale in ADR-030.

### 18.1 Rules

- **FR-115** Words are 5 letters. Each game allows **14 guesses**, which is enough to binary-search the 13,746-word guess list. The secret is drawn from the 5-letter answer list with its own no-repeat ring buffer (FR-4 rule).
- **FR-116** The **range** is the open interval the secret must lie in. It starts as `AAAAA … ZZZZZ`, two sentinels that are not words. After each guess, the range narrows to the closest guesses on each side of the secret.
- **FR-117** A submitted guess is checked in this order. A rejected guess shakes the row, shows the toast and uses no guess.
  1. Fewer than 5 letters → `Not enough letters`.
  2. Not in the guess list → `Not in word list`.
  3. Already guessed → `Already guessed`.
  4. Not strictly inside the current range → `Outside the range`.
- **FR-118** An accepted guess that is not the secret is marked with where the secret lies: **after** it (the secret comes later alphabetically, so the guess becomes the lower bound) or **before** it (the guess becomes the upper bound).
- **FR-119** The game is won when a guess equals the secret. It is lost after 14 guesses without it, and the result reveals the secret.
- **FR-120** **Heat** measures the distance between the guess and the secret as positions in the sorted 5-letter guess list. Five levels, set as engine constants:

| Heat     | Distance (positions) |
| -------- | -------------------- |
| Burning  | 1–20                 |
| Hot      | 21–100               |
| Warm     | 101–500              |
| Cold     | 501–2,000            |
| Freezing | more than 2,000      |

### 18.2 Interface

- **FR-121** The screen shows, top to bottom: the upper-bound word, the input row with the heat level of the last guess, the lower-bound word, and a list of all guesses sorted alphabetically, each marked before or after with its heat. The heat level is always written as a word, not only shown as a colour.
- **FR-122** The on-screen keyboard has no letter colours.
- **FR-123** The result panel shows won or lost, guesses used, the secret, and **Play again**.
- **FR-124** Statistics, recorded once per game: played, won, win %, current and best streak, the guess distribution for wins (buckets 1–14), and the last 50 games `{ id, playedAt, secret, guessesUsed, won }`.
  - Added later (ADR-035): average guesses, average and fastest win time, the closest miss (fewest words left in the range after a loss), the share of games that reached Burning and the average guess it first did, and the most-used first guess. Each record carries `solveMs`, `firstBurningGuess`, `wordsLeft` (losses) and `opener`.
- **FR-125** The in-progress game is saved and restored as in FR-32 and FR-65. A restore is discarded if the secret has left the answer list. Restarting with at least one guess asks for confirmation.
- **FR-126** The How to play dialog explains the range, before and after, and the heat levels, with a three-guess example.

---

## 19. WordCode (release R4)

Bulls & Cows with words. Each guess reports only two numbers: letters in the right place (**bulls**) and letters in the word but in the wrong place (**cows**). There are no tile colours. Rationale in ADR-031.

### 19.1 Rules

- **FR-127** Word length is 4, 5 or 6, default 5, with its own length preference. Every game allows **10 guesses**. The secret is drawn from the answer list for that length with its own no-repeat ring buffer (FR-4 rule).
- **FR-128** Input and validation follow Wordwright (FR-6 to FR-11, FR-14 to FR-17).
- **FR-129** Bulls are the number of `correct` positions and cows the number of `present` positions in `evaluateGuess(guess, secret)`. Duplicate letters follow FR-12 and FR-13 exactly. For example, secret `SPEED` and guess `EEEEE` give 2 bulls and 0 cows. (`EEEEE` is not in the guess list, so this example is checked at engine level.)
- **FR-130** The game is won when bulls equal the word length. It is lost after 10 guesses, and the result reveals the secret.

### 19.2 Interface

- **FR-131** Each board row shows the guess letters on neutral tiles, followed by the bull and cow counts as text, for example "2 bulls · 1 cow".
- **FR-132** **Letter notes.** A Type and Mark switch above the on-screen keyboard sets what a letter key does. In Type, a key enters the letter. In Mark, a key cycles that letter through unmarked, ruled out and in the word. Marks show on the keys in a style that cannot be confused with game feedback, and are never colour alone. Marks are the player's own notes; the game never sets them. They are saved with the session.
- **FR-133** The result panel shows won or lost, guesses used, the secret, and **Play again** and **Change length**.
- **FR-134** Statistics are kept overall and per length, and recorded once per game: played, won, win %, current and best streak, the guess distribution for wins (buckets 1–10), and the last 50 games `{ id, playedAt, length, secret, guessesUsed, won }`.
  - Added later (ADR-035): average guesses, average and fastest win time, the average guess by which every letter was known, the share of games that used the notepad, and the most-used first guess. Each record carries `solveMs`, `lettersFoundAt`, `usedNotes` and `opener`.
- **FR-135** The in-progress game, including letter notes, is saved and restored as in FR-32, FR-33 and FR-65. Restarting or switching length with at least one guess asks for confirmation.
- **FR-136** The How to play dialog explains bulls, cows, duplicate letters and letter notes, with a two-guess example that follows the selected length.

---

## 20. WordShuffle (release R5)

Unscramble a word. The letters arrive shuffled, and any real word that uses exactly those letters wins. Rationale in ADR-032.

### 20.1 Rules

- **FR-137** Word length is 4, 5 or 6, default 5, with its own length preference. There is no guess limit and no timer.
- **FR-138** The target is drawn from the answer list for that length with its own no-repeat ring buffer (FR-4 rule). The scramble is a random ordering of its letters that differs from the target and is not itself in the guess list. If no such ordering exists, another target is drawn.
- **FR-139** The letters sit in a **tray**. The player builds an answer by typing or by tapping tray letters; each letter can be used as many times as it appears in the tray. A typed letter that isn't left in the tray is ignored with no toast. Backspace returns the last letter to the tray.
- **FR-140** A submitted answer is checked in this order. A rejected answer shakes the row, shows the toast and has no other cost.
  1. Not all letters used → `Not enough letters`.
  2. Moves a hinted letter (FR-142) → rejected. The UI cannot produce this, because hinted letters are locked; it is an engine guard with no toast.
  3. Not in the guess list → `Not in word list`.
- **FR-141** Any guess-list word that uses exactly the tray letters and keeps every hinted letter in place solves the puzzle, even when it isn't the drawn target. For example, the scramble of `LISTEN` is solved by any of `LISTEN`, `SILENT`, `ENLIST`, `INLETS`, `TINSEL` or `ELINTS`.
- **FR-142** **Hints.** Up to 2 per puzzle. Each hint fixes one more letter of the drawn target in its correct position, choosing the leftmost position not already fixed. A hinted letter is placed and locked in the answer row and taken out of the tray. Typed and tapped letters fill the remaining positions from left to right, skipping locked ones, and Backspace never removes a locked letter. Taking a hint first returns every unlocked letter in the answer row to the tray, so the hinted letter is always available and never collides with a typed one.
- **FR-143** **Reshuffle** reorders the letters left in the tray. It is free and unlimited.
- **FR-144** **Give up** asks for confirmation, ends the puzzle as given up, and shows the target plus every other valid anagram.

### 20.2 Interface

- **FR-145** The result panel shows solved or given up, the word found, hints used, the other valid anagrams, and **Play again** and **Change length**.
- **FR-146** Statistics are kept overall and per length, and recorded once per game:
  - played, solved, given up, solve % (derived)
  - solved without hints, and average hints per solve
  - current and best streak: a solve adds one, a give up resets to 0
  - the last 50 games `{ id, playedAt, length, target, found, hintsUsed, solved }`
  - added later (ADR-035): average and fastest solve time, a chart of solves by time (under 10 s, 30 s, 1 min, 2 min, longer), a chart of solves by hints used, and how often another anagram was found in puzzles that had several answers. Each record carries `solveMs` and `anagramCount`, and the recent list shows the word found.
- **FR-147** The in-progress puzzle (target, scramble, tray, answer row, hints) is saved and restored as in FR-32, FR-33 and FR-65. Starting a new puzzle or switching length after any input asks for confirmation. The How to play dialog explains the tray, reshuffle, hints and that any valid anagram wins.

---

## Appendix A. Game Ideas Not Planned

Version 2.0 listed four candidate games here. Version 2.1 adopts them as WordStack, WordRange, WordCode and WordShuffle (§17–§20). The variants below were considered and are not planned. Each would need its own SPEC section and ADR.

| Idea                                                                                                               | Why not now                                                                                              |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| **Waffle-style grid**: a grid of crossing words with shuffled letters, fixed by swapping tiles within a swap limit | Needs a crossword-grid generator and a drag or tap-to-swap interaction. WordShuffle covers unscrambling. |
| **Jotto**: each guess reports only the number of shared letters                                                    | WordCode's bulls and cows give the same deduction with clearer feedback.                                 |
| **Timed unscramble**: solve as many words as possible in 60 seconds                                                | Adds a timer and scoring model; WordShuffle is untimed by choice.                                        |
| **WordStack with 8 or 16 boards** (Octordle, Sedecordle)                                                           | Does not fit a phone screen alongside the keyboard.                                                      |

**Not feasible offline:** meaning-based Hot & Cold (like hotandcold.app or Semantle) ranks guesses by how close their meaning is to the secret word. That needs word embeddings, typically tens of megabytes of vectors or a server, which conflicts with NFR-1, NFR-5 and NFR-10. WordRange is the offline alternative.
