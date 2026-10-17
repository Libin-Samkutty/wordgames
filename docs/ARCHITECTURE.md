# wordgames — Architecture

**Scope:** Suite V1 implementation design: the shell, Wordwright and WordWeaver, plus the seven games in releases R2–R8 (WordStack, WordRange, WordCode, WordShuffle, WordDodge, WordHunt, WordHang). Companion to [`SPEC.md`](./SPEC.md) (what) and [`DECISIONS.md`](./DECISIONS.md) (why). The project was previously named Wordwright; that name now means the Wordle-style game. Sections marked _planned_ describe the suite work in TASKS Phases 11–18 and are not built yet.

---

## 1. System Overview

wordgames is a client-only SPA with three concentric layers:

```
┌──────────────────────────────────────────────────────────┐
│  React UI            components/ · hooks/ · shell/        │
│  ─ renders state, dispatches intents, owns animation      │
├──────────────────────────────────────────────────────────┤
│  Adapters            state/ · storage/ · dictionary/      │
│  ─ providers, LocalStorage repositories, lazy word lists  │
├──────────────────────────────────────────────────────────┤
│  Engine              engine/                              │
│  ─ pure TypeScript: rules, reducer, evaluation, scoring   │
└──────────────────────────────────────────────────────────┘
```

**The dependency rule:** arrows point inward only. `engine/` imports nothing from the outer layers — no React, no DOM, no `localStorage`, no timers. This makes rules testable in milliseconds and reusable by any future host (V2 daily challenge worker, V3 server validator).

### 1.1 Suite overview

The app is a suite: a Home screen and a set of games behind one shared shell (SPEC §14, ADR-021).

- **Shell** owns the URL hash, Home, the header frame, the shared appearance settings, toasts and the storage layout.
- **Home** (`#/`) lists the games. It loads no dictionary and mounts no game provider (FR-63, NFR-15).
- **Wordwright** (`#/wordwright`) is the existing Wordle-style game, unchanged in its rules.
- **WordWeaver** (`#/weaver`) is a word ladder: change one letter per rung to get from a start word to an end word (SPEC §15–§16).

Suite V1 (T-50 … T-73) ships Home, Wordwright and WordWeaver. Four more games follow, one per release and in this order (SPEC §14.4):

| Release | Game        | Route       | What it is                                                   | SPEC | ADR |
| ------- | ----------- | ----------- | ------------------------------------------------------------ | ---- | --- |
| R2      | WordStack   | `#/stack`   | Wordle on 2 (Duo) or 4 (Quad) boards at once, shared guesses | §17  | 029 |
| R3      | WordRange   | `#/range`   | Find a word by its alphabetical range, with a heat meter     | §18  | 030 |
| R4      | WordCode    | `#/code`    | Bulls and cows: two counts per guess, no tile colours        | §19  | 031 |
| R5      | WordShuffle | `#/shuffle` | Unscramble the letters; any valid anagram wins               | §20  | 032 |
| R6      | WordDodge   | `#/dodge`   | A Wordle that never picks a word and keeps the most possible | §21  | 039 |
| R7      | WordHunt    | `#/hunt`    | Find every common word hiding in six letters                 | §22  | 040 |
| R8      | WordHang    | `#/hang`    | Hangman: guess the word one letter at a time, six misses     | §23  | 041 |

There are no feature flags. A game enters the catalogue in the release that ships it, and until then its route goes Home (FR-97).

Each game has its own engine, reducer, providers, statistics and storage keys. The games share UI parts (`Modal`, `Button`, `Keyboard`, `Board`, `Tile`, tile tokens, `ConfirmDialog`), the dictionary loader and the storage machinery, by plain import. Suite V1 picks a game with a `switch` over a closed `GameId = 'wordwright' | 'weaver'` union (ADR-021). From T-74 the shell reads a static **game catalogue** instead: an ordered array of `{ id, name, description, route, View }` with each `View` loaded by `React.lazy` (ADR-028). It is not a plugin system: nothing registers at runtime and the games share no engine, provider or storage interface.

```
          ┌──────────── Shell (catalogue, routes, header, settings, toasts) ────────────┐
          │                                                                              │
 #/ ──▶ HomeView   #/wordwright   #/weaver      #/stack      #/range      #/code      #/shuffle    #/dodge    #/hunt    #/hang
                        │             │             │            │            │            │
                   engine/       engine/       engine/      engine/      engine/      engine/
                   (root)        weaver/       stack/       range/       code/        shuffle/     dodge/     hunt/     hang/
                        └─────────────┴──── dictionary/ · storage/ ──────┴────────────┘
```

WordStack and WordCode call the root engine's `evaluateGuess` directly; WordStack, WordRange and WordCode reuse `validateGuess`. All four new games draw answers with `pickAnswer` and their own ring buffer, and take randomness as an injected `RandomSource` (ADR-009).

---

## 2. Folder Structure

Everything in this tree matches the repository.

```
wordgames/
├── docs/
│   ├── SPEC.md  ARCHITECTURE.md  TASKS.md  ACCEPTANCE.md
│   ├── CONTRIBUTING.md  DECISIONS.md  REVIEW.md
│   └── screenshots/               # generated by e2e/screenshots.spec.ts
├── e2e/                           # Playwright specs (ADR-019)
│   ├── a11y.spec.ts  edge-cases.spec.ts
│   └── responsive.spec.ts  screenshots.spec.ts
├── public/
│   ├── favicon.svg
│   └── robots.txt
├── scripts/
│   ├── build-dictionaries.mjs     # generates src/dictionary/data (ADR-017)
│   └── check-contrast.mjs         # token contrast audit (A11Y-7)
├── src/
│   ├── engine/                    # Wordwright engine, pure (ADR-003)
│   │   ├── types.ts               # GameState, Evaluation, LetterState, WordLength …
│   │   ├── constants.ts           # WORD_LENGTHS, MAX_GUESSES, SCORE …
│   │   ├── evaluate.ts            # evaluateGuess() — the two-pass algorithm
│   │   ├── keyboardState.ts       # deriveKeyStates() with precedence merge
│   │   ├── validate.ts            # validateGuess() → Result<string, GuessError>
│   │   ├── score.ts               # scoreGame()
│   │   ├── createGame.ts          # createGame(), pickAnswer() w/ no-repeat buffer
│   │   ├── reducer.ts             # gameReducer(state, action) — the state machine
│   │   ├── selectors.ts           # isGameOver, currentRowIndex, boardRows …
│   │   ├── random.ts              # RandomSource interface + mulberry32 PRNG
│   │   ├── index.ts               # public barrel — the engine's API surface
│   │   ├── __tests__/             # incl. boundaries.test.ts (purity guard)
│   │   └── weaver/                # WordWeaver engine, pure (§3.6)
│   │       ├── types.ts           # WeaverLength, WeaverState, Rung, RungError …
│   │       ├── constants.ts       # WEAVER_LENGTHS = [4, 5], PAR_BAND,
│   │       │                      # RECENT_START_WINDOW = 20, MAX_MOVES = 500
│   │       ├── graph.ts           # buildLadderGraph() — wildcard buckets
│   │       ├── bfs.ts             # distancesFrom(), optimalLadder()
│   │       ├── generate.ts        # generatePuzzle() — FR-78 fallback chain
│   │       ├── validate.ts        # validateRung() — FR-80 order
│   │       ├── evaluate.ts        # evaluateRung() — green/grey only
│   │       ├── reducer.ts         # weaverReducer(state, action)
│   │       ├── selectors.ts       # overPar, isParHit, canUndo, result record …
│   │       ├── index.ts
│   │       └── __tests__/
│   │   ├── stack/                 # WordStack engine (§3.7)
│   │   │   ├── types.ts  constants.ts      # StackMode, STACK_MODES, StackState …
│   │   │   ├── answers.ts         # pickAnswers() — n distinct answers via pickAnswer
│   │   │   ├── reducer.ts  selectors.ts    # per-board key states, result record
│   │   │   └── index.ts  __tests__/
│   │   ├── range/                 # WordRange engine (§3.8)
│   │   │   ├── types.ts  constants.ts      # RANGE_MAX_GUESSES = 14, sentinels, HEAT_BANDS
│   │   │   ├── validate.ts        # validateRangeGuess() — FR-117 order
│   │   │   ├── heat.ts            # listIndex(), listDistance(), heatOf()
│   │   │   ├── reducer.ts  selectors.ts
│   │   │   └── index.ts  __tests__/
│   │   ├── code/                  # WordCode engine (§3.9)
│   │   │   ├── types.ts  constants.ts      # CODE_MAX_GUESSES = 10, NoteMark …
│   │   │   ├── score.ts           # scoreCode() — bulls/cows from evaluateGuess
│   │   │   ├── reducer.ts  selectors.ts
│   │   │   └── index.ts  __tests__/
│   │   ├── shuffle/               # WordShuffle engine (§3.10)
│   │   │   ├── types.ts  constants.ts      # MAX_HINTS = 2, ShuffleState …
│   │   │   ├── anagrams.ts        # anagramKey(), buildAnagramIndex()
│   │   │   ├── scramble.ts        # makeScramble(), shuffleLetters()
│   │   │   ├── validate.ts        # validateAnswer() — FR-140 order
│   │   │   ├── reducer.ts  selectors.ts
│   │   │   └── index.ts  __tests__/
│   │   ├── dodge/                 # WordDodge engine (§3.11)
│   │   │   ├── types.ts  constants.ts      # DodgeState, distribution rows …
│   │   │   ├── adversary.ts       # chooseReply() — largest group of candidates
│   │   │   ├── reducer.ts  selectors.ts    # restoreGame(), dodgeRows() …
│   │   │   └── index.ts  __tests__/
│   │   ├── hunt/                  # WordHunt engine (§3.12)
│   │   │   ├── types.ts  constants.ts      # HuntState, MIN_REQUIRED = 8 …
│   │   │   ├── puzzle.ts          # requiredFor(), buildPool(), createPuzzle()
│   │   │   ├── validate.ts        # validateWord() — FR-161 order
│   │   │   ├── reducer.ts  selectors.ts
│   │   │   └── index.ts  __tests__/
│   │   └── hang/                  # WordHang engine (§3.13)
│   │       ├── types.ts  constants.ts      # HangState, MAX_MISSES = 6
│   │       ├── reducer.ts         # GUESS_LETTER; win is checked before loss
│   │       ├── selectors.ts       # misses, maskedWord, letterStates, hangRecord
│   │       └── index.ts  __tests__/
│   ├── dictionary/
│   │   ├── data/
│   │   │   ├── lists-4.ts         # answers + guesses + ladder list
│   │   │   ├── lists-5.ts         # answers + guesses + ladder list
│   │   │   ├── lists-6.ts         # answers + guesses
│   │   │   └── README.md          # provenance & licensing
│   │   ├── registry.ts            # WordLength → () => Promise<RawLists>
│   │   ├── loadDictionary.ts      # cache + Set construction + error mapping
│   │   ├── types.ts               # RawLists, Dictionary, DictionaryLoadError
│   │   ├── index.ts
│   │   └── __tests__/             # data invariants + loader
│   ├── storage/                   # tests sit next to each module (*.test.ts)
│   │   ├── keys.ts                # suite layout §7.6: STORAGE_KEYS, gameKeys(gameId),
│   │   │                          # LEGACY_STORAGE_KEYS, isOwnedKey
│   │   ├── safeStorage.ts         # availability probe + in-memory fallback
│   │   ├── createRepository.ts    # generic typed read/write/clear/subscribe
│   │   ├── migrations.ts          # version chain (not wired into any repository, §7.4)
│   │   ├── schemas.ts             # runtime guards for each persisted shape
│   │   ├── statsRepository.ts     # aggregate + per-length + recent games
│   │   ├── settingsRepository.ts  # shared appearance settings
│   │   ├── prefsRepository.ts     # Wordwright prefs (default length)
│   │   ├── weaverSchemas.ts       # WordWeaver prefs, stats, session, meta shapes, guards, FR-93 restore check
│   │   ├── weaverRepositories.ts  # WordWeaver repositories, recordWeaverGame, resets, start ring buffer
│   │   ├── legacyImport.ts        # one-time wordwright:v1:* import (§7.7)
│   │   ├── resetData.ts           # resetAllData(): both namespaces (FR-71)
│   │   ├── sessionRepository.ts   # in-progress game + meta
│   │   └── index.ts
│   ├── state/
│   │   ├── GameProvider.tsx       # useReducer(gameReducer) + dictionary + persistence
│   │   ├── StatsProvider.tsx
│   │   ├── SettingsProvider.tsx
│   │   ├── ToastProvider.tsx
│   │   ├── StorageNotices.tsx     # one-time storage warnings (EC-11, EC-12)
│   │   ├── storageIssues.ts
│   │   ├── contexts.ts  gameContexts.ts   # context objects + typed useX() hooks
│   │   ├── index.ts
│   │   ├── weaver/                # WeaverProvider, WeaverStatsProvider, weaverContexts (useWeaver, useWeaverStats)
│   │   ├── stack/                 # StackProvider, StackStatsProvider, stackContexts (useStack, useStackStats)
│   │   ├── range/                 # RangeProvider, RangeStatsProvider, rangeContexts (useRange, useRangeStats)
│   │   ├── code/                  # CodeProvider, CodeStatsProvider, codeContexts (useCode, useCodeStats)
│   │   ├── shuffle/               # ShuffleProvider, ShuffleStatsProvider, shuffleContexts (useShuffle, useShuffleStats)
│   │   ├── dodge/                 # DodgeProvider, DodgeStatsProvider, dodgeContexts (useDodge, useDodgeStats)
│   │   ├── hunt/                  # HuntProvider, HuntStatsProvider, huntContexts (useHunt, useHuntStats)
│   │   └── hang/                  # HangProvider, HangStatsProvider, hangContexts (useHang, useHangStats)
│   ├── shell/                     # suite shell (§1.1, §6.4)
│   │   ├── catalogue.ts           # GAMES: ordered, read-only, lazy Views; defineGame, GameLoadError (ADR-028)
│   │   ├── GameFrame.tsx          # loads one catalogue game: Suspense fallback, load-failure panel (EC-50)
│   │   ├── routes.ts              # RouteView, parseHash(), routeHash(), routeTitle(), game names
│   │   ├── useHashRoute.ts        # useSyncExternalStore over `hashchange`; title, replaceState, focus
│   │   ├── HomeView.tsx           # <ul> of game cards (cards are local to the view until T-74)
│   │   └── AppShell.tsx           # header frame, routed view, footer, toasts, Settings
│   ├── components/
│   │   ├── layout/    ErrorBoundary.tsx  Header.tsx (frame + HeaderIconButton)
│   │   │              HeaderControls.tsx  headerSlot.ts (portal slot for a game's controls)
│   │   ├── board/     Board.tsx  Tile.tsx  tileAppearance.ts  BoardSkeleton.tsx
│   │   ├── keyboard/  Keyboard.tsx  Key.tsx
│   │   │              layout.ts (shared QWERTY rows)
│   │   ├── help/      HelpModal.tsx  ExampleTile.tsx (shared decorative tile)
│   │   ├── stats/     StatsModal.tsx  StatTile.tsx  ResetStatsSection.tsx (per-game reset actions)
│   │   ├── settings/  SettingsModal.tsx
│   │   ├── game/      WordwrightView.tsx  GameView.tsx  ResultPanel.tsx  LengthSelector.tsx
│   │   │              ChangeLength.tsx (shared by both result panels)  DictionaryError.tsx
│   │   ├── ui/        Modal.tsx  Button.tsx  ToastRegion.tsx  VisuallyHidden.tsx
│   │   │              ConfirmDialog.tsx
│   │   ├── weaver/    WeaverView, WeaverBoard, WeaverSkeleton, GenerationError, WeaverResultPanel,
│   │   │              WeaverHelpModal (+ helpExamples.ts), WeaverStatsModal
│   │   ├── stack/     StackView, StackBoards, StackKeyboard, SplitKey, ModeSelector, StackResultPanel,
│   │   │              help and stats dialogs
│   │   ├── range/     RangeView, RangeBoard (bounds, input row, sorted guess list), HeatBadge,
│   │   │              RangeResultPanel, help and stats dialogs
│   │   ├── code/      CodeView, CodeRows, CodeKeyboard (Type/Mark switch, note marks), CodeResultPanel,
│   │   │              help and stats dialogs
│   │   ├── shuffle/   ShuffleView, ShuffleBoard (answer row and tray), shuffleLabels,
│   │   │              result, help and stats dialogs
│   │   ├── dodge/     DodgeView (shared Board and Keyboard, words-left count, Give up),
│   │   │              DodgeResultPanel, help and stats dialogs
│   │   ├── hunt/      HuntView, HuntBoard (slots, word row, tray), huntLabels,
│   │   │              result, help and stats dialogs
│   │   ├── hang/      HangView, HangFigure (SVG), HangWord, HangKeyboard (letters only), hangLabels,
│   │   │              result, help and stats dialogs
│   │   └── index.ts
│   ├── hooks/
│   │   ├── usePhysicalKeyboard.ts
│   │   ├── useFocusTrap.ts
│   │   ├── useRevealTimeline.ts
│   │   ├── useEnterToContinue.ts  # §6.5
│   │   └── index.ts
│   ├── lib/
│   │   ├── clock.ts               # monotonic now()
│   │   ├── format.ts              # duration, percentage, average formatting
│   │   ├── cn.ts                  # class merge helper
│   │   ├── result.ts              # Result<T, E> discriminated union
│   │   └── index.ts
│   ├── styles/
│   │   ├── index.css              # Tailwind entry + @theme tokens
│   │   └── animations.css         # keyframes, reduced-motion overrides
│   ├── test/
│   │   ├── setup.ts               # jest-dom, matchMedia & storage mocks
│   │   ├── fixtures.ts            # deterministic dictionaries & stats
│   │   ├── renderWithProviders.tsx
│   │   └── gameFlow.test.tsx  helpFlow.test.tsx
│   ├── App.tsx                    # shared providers (Settings, Toast) + AppShell
│   ├── main.tsx                   # legacy import, then createRoot
│   └── vite-env.d.ts
├── index.html                     # inline pre-paint theme script
├── vite.config.ts  vitest.config.ts  playwright.config.ts
├── tsconfig*.json  eslint.config.js  .prettierrc.json  postcss.config.mjs
└── package.json
```

The suite keeps games in parallel folders (`engine/<game>/`, `state/<game>/`, `components/<game>/` for `weaver`, `stack`, `range`, `code` and `shuffle`) rather than a `src/games/*` layout. Wordwright stays at the root of each folder. Moving to per-game folders later is a pure file move (§12).

---

## 3. Engine Design

§3.1–§3.5 describe the Wordwright engine in `src/engine/`. The WordWeaver engine is in §3.6, and the four release R2–R5 engines are in §3.7–§3.10.

### 3.1 Core types

```ts
export const WORD_LENGTHS = [4, 5, 6] as const;
export type WordLength = (typeof WORD_LENGTHS)[number];

export type LetterState = 'correct' | 'present' | 'absent';
export type TileState = LetterState | 'empty' | 'filled';
export type Evaluation = readonly LetterState[];

export type GameStatus = 'idle' | 'loading' | 'playing' | 'won' | 'lost' | 'error';

export interface Guess {
  readonly word: string; // uppercase, length === wordLength
  readonly evaluation: Evaluation;
}

export interface GameState {
  readonly id: string; // uuid; idempotency key for stats
  readonly wordLength: WordLength;
  readonly answer: string;
  readonly guesses: readonly Guess[];
  readonly currentInput: string;
  readonly status: GameStatus;
  readonly startedAt: number | null; // set on first keystroke (FR-22)
  readonly finishedAt: number | null;
  readonly error: GameError | null;
}
```

### 3.2 The reducer state machine

`gameReducer(state, action): GameState` is pure, synchronous, and total — unknown actions return the same reference.

```
Actions
  START_GAME  { wordLength, answer, id, now }
  ADD_LETTER  { letter, now }        // sets startedAt if null
  REMOVE_LETTER
  SUBMIT_GUESS { now }               // validation happens in a guard, see below
  REVEAL_COMPLETE                    // unlocks input, applies won/lost
  RESTART     { answer, id }
  SET_ERROR / CLEAR_ERROR
```

Transitions:

```
idle ──START_GAME──▶ playing ──SUBMIT_GUESS──▶ playing (revealing)
                        │                          │
                        │                    REVEAL_COMPLETE
                        │                    ┌─────┴─────┐
                        ▼                    ▼           ▼
                     RESTART                won         lost
                                             └── RESTART ─┘
```

**Validation placement.** The reducer cannot import the dictionary (dependency rule) so `SUBMIT_GUESS` carries the outcome of a pure guard executed by the provider:

```ts
// engine/validate.ts — pure, dictionary injected
export function validateGuess(
  input: string,
  wordLength: WordLength,
  isAllowed: (word: string) => boolean,
): Result<string, GuessError>; // GuessError = 'too-short' | 'not-a-word'
```

The provider calls `validateGuess` with the loaded `Set.has`, dispatches `SUBMIT_GUESS` on success, or raises a toast on failure. The reducer stays dictionary-free and 100% unit-testable.

### 3.3 Evaluation

`evaluateGuess(guess, answer)` implements SPEC §6.3 exactly: a `Map<string, number>` count pool, greens first, then left-to-right yellows. O(n) time, no allocation beyond the result array. This is the most-tested function in the codebase (full truth table + property tests: result length always equals word length; a guess equal to the answer is all-correct; counts of `correct + present` for a letter never exceed its count in the answer).

### 3.4 Randomness is injected

```ts
export interface RandomSource {
  next(): number;
} // [0, 1)
export const systemRandom: RandomSource;
export function seededRandom(seed: number): RandomSource; // mulberry32
```

The engine never calls `Math.random()` directly. Tests inject a fixed sequence; **V2 seeded/daily games inject `seededRandom(dateToSeed(day))` with no engine change.**

### 3.5 No-repeat answer picking

`pickAnswer(pool, recentlyUsed, random)` filters out the recent ring buffer (`min(50, floor(pool.length / 4))` entries, persisted per length), picks uniformly from the remainder, and resets the buffer when the remainder is empty (EC-20).

### 3.6 WordWeaver engine

WordWeaver's rules live in `src/engine/weaver/`, beside the Wordwright engine and under the same rules: pure TypeScript, no React, DOM, storage, timers or `Math.random` (ADR-003, NFR-16). The existing ESLint boundary glob and the 100% coverage glob are both `src/engine/**/*.ts`, so they already cover the subfolder. `boundaries.test.ts` lists the folder explicitly (`GAME_ENGINE_DIRS`; add each game's folder as it lands), and `vitest.config.ts` excludes the types-only `weaver/types.ts`. Rules are in SPEC §15; rationale in ADR-025 and ADR-026.

**Types and constants** (`types.ts`, `constants.ts`).

```ts
export const WEAVER_LENGTHS = [4, 5] as const;
export type WeaverLength = Extract<WordLength, 4 | 5>; // so loadDictionary(4 | 5) is reused as-is

export const PAR_BAND = { 4: { min: 4, max: 6 }, 5: { min: 4, max: 7 } }; // fixed by T-58
export const RECENT_START_WINDOW = 20; // skip starts used in the last 20 puzzles (FR-78)
export const MAX_START_ATTEMPTS = 20; // starts tried before the fallback (FR-78)
export const FALLBACK_MIN_PAR = 3; // the fallback accepts any reachable answer at least this far
export const MAX_MOVES = 500; // safety cap (FR-85, EC-34)

export type RungState = Extract<LetterState, 'correct' | 'absent'>;
export type WeaverStatus = 'playing' | 'revealing' | 'solved' | 'gave-up';
export type RungError = 'too-short' | 'not-a-word' | 'not-one-letter' | 'already-used';
export type GenerateError = 'no-puzzle';
```

`WeaverState` holds `id, length, start, end, par, rungs (word + evaluation), moves, currentInput, status, startedAt, finishedAt` and `optimalLadder` (set by Give up, FR-93). There is no loading or error status: the provider tracks the dictionary separately and mounts the reducer once a puzzle exists.

**Word lists.** WordWeaver reads three lists per length (FR-75): the answer list (start and end words), the new **ladder list** (par and the give-up ladder) and the guess list (what a player may type). The ladder list is a third export of `lists-4.ts` and `lists-5.ts` (§8.4): 1,400 words for 4 letters, 5,000 for 5.

**Ladder graph** (`graph.ts`). `buildLadderGraph(words)` returns `{ words, index, neighbours }`, one node per ladder-list word. Adjacency uses wildcard buckets: each word is filed under one pattern per position, so `COLD` goes into `_OLD`, `C_LD`, `CO_D` and `COL_`. Words that share a bucket are neighbours. This is O(words x length) to build, instead of comparing every pair. Each neighbour list is sorted alphabetically, so every walk is deterministic. The engine function is pure and takes the word array as data. The provider builds the graph once per length and keeps it with the loaded dictionary.

**Shortest paths** (`bfs.ts`).

- `distancesFrom(graph, start)` is a plain breadth-first search returning an `Int32Array` by node, with `UNREACHABLE` (-1) for words with no path. `distanceTo(graph, distances, word)` reads one word's distance, or null. Par is the distance to the end word (FR-76).
- `shortestLadder(graph, start, end, answers)` returns one shortest path, start and end included, for give up (FR-86), or null if there is none. It works backwards from the end: the best continuation of each node is decided once per distance layer. Among equal-length paths it keeps the one with the most answer-list words, then the alphabetically smaller neighbour, so a puzzle always shows the same solution.

**Generation** (`generate.ts`). `generatePuzzle({ length, graph, answers, recentStarts, random })` returns `Result<Puzzle, 'no-puzzle'>` and follows FR-78 with the injected `RandomSource` (ADR-009):

```
draw up to 20 starts from answers, without replacement; starts in the recent window go last
  └─ for each: one BFS, E = random answer with PAR_BAND.min ≤ dist ≤ PAR_BAND.max
       └─ none for any start? any reachable answer with dist ≥ 3 from one of those starts
            └─ still none? Err('no-puzzle') → "Couldn't create a puzzle." + Retry (EC-32)
```

**Rung validation** (`validate.ts`). `validateRung(input, { length, previous, used, isAllowed })` returns `Result<string, RungError>` and checks in FR-80 order. The first two checks are Wordwright's `validateGuess`:

1. fewer or more letters than `length` → `too-short`
2. `isAllowed(input)` is false (not in the guess list) → `not-a-word`
3. does not differ from `previous` in exactly one position (`differsByOneLetter`) → `not-one-letter`
4. already in the ladder (the start word or a current rung) → `already-used`

**Evaluation** (`evaluate.ts`). `evaluateRung(rung, end)` returns `correct` where `rung[i] === end[i]` and `absent` otherwise (FR-81). There is no `present` state. The start row is evaluated the same way.

**Reducer** (`reducer.ts`). `weaverReducer(state, action)` is pure, synchronous and total, like `gameReducer`. `createWeaverGame(id, puzzle)` builds a fresh state.

```
Actions
  NEW_PUZZLE       { id, puzzle }            // puzzle = { length, start, end, par }
  RESTORE          { state }                 // a validated saved session (FR-93)
  ADD_LETTER       { letter, now }           // ignored once moves ≥ MAX_MOVES
  REMOVE_LETTER                              // removes a typed letter; does nothing on an empty row
  SUBMIT_RUNG      { word, now }             // word already passed validateRung
  UNDO                                       // drops the last rung; moves unchanged
  REVEAL_COMPLETE  { now }                   // unlocks input; end word → solved
  GIVE_UP          { ladder, now }           // ladder computed by the provider
```

```
NEW_PUZZLE ─▶ playing ──SUBMIT_RUNG──▶ revealing ──REVEAL_COMPLETE──▶ playing
                 │  ▲                                     │
                 │  └── UNDO (≥ 1 rung)                   └─ rung === end ──▶ solved
                 └── GIVE_UP ──▶ gave-up
```

`SUBMIT_RUNG` increments `moves` (FR-84). `UNDO` does not, and does nothing with no rungs, during a reveal or after the game ends (FR-83, EC-30). Backspace on an empty input row is `REMOVE_LETTER`, which the reducer ignores. Only `UNDO` removes a rung (ADR-036). `GIVE_UP` works only while `playing`, including at the move cap (EC-34).

**Selectors** (`selectors.ts`). `ladderRows(state)` is the board view-model (start, rungs, input, end; labels `Start`, `Rung n`, `Next rung`, `End`). `resultSummary(state)` returns `moves`, `par`, `ladderLength`, `overPar` (can be negative), `parHit` and a label (`Par!`, `Under par by n!`, `+n`, or null unless solved). `weaverRecord(state)` is the FR-92 statistics record, null while in play. Smaller ones: `isGameOver`, `canUndo`, `moveLimitReached`, `previousWord`, `usedWords`, `overPar`, `isParHit`. There is no numeric score (FR-87).

**How purity is kept.** The engine never sees the dictionary or builds anything it can't be handed. The pattern is the same one `SUBMIT_GUESS` uses (§3.2):

- The graph is passed into `distancesFrom`, `shortestLadder` and `generatePuzzle` as data.
- The provider calls `validateRung` with the loaded guess list's `Set.has`, then dispatches `SUBMIT_RUNG` with the accepted word, or raises the toast and shake on failure.
- The provider computes the give-up ladder and passes it in `GIVE_UP`.
- `WeaverLength = Extract<WordLength, 4 | 5>`, so `loadDictionary` and the registry are reused with no new types.

**Tests.** The engine tests use a small hand-built graph (`__tests__/fixtures.ts`). `generate.real.test.ts` is the one exception, by design (AC-36): 200 seeded puzzles per length on the real lists, with par checked against `src/test/referenceBfs.ts`, which finds neighbours by trying every one-letter substitution instead of wildcard buckets, so it cannot share a bug with the engine.

### 3.7 WordStack engine

**Shared pattern for §3.7–§3.10.** Each R2–R5 engine lives in its own folder under `src/engine/` and follows the WordWeaver rule (NFR-19): pure TypeScript, no React, DOM, storage, timers or `Math.random`, and 100% branch coverage. The existing `src/engine/**/*.ts` lint and coverage globs already cover the new folders. Validation works as for `SUBMIT_GUESS` (§3.2): the provider runs the validator with the loaded dictionary, then dispatches the accepted word. Anything that needs the word lists (list distances, anagram lookups) is computed by a pure engine helper the provider calls, and the result travels in the action. Each reducer is pure, synchronous and total. Final state shapes are settled in each engine task; the sketches below list what the state must hold.

`src/engine/stack/`, T-75. Rules in SPEC §17; rationale in ADR-029.

```ts
export const STACK_LENGTH = 5;
export const STACK_MODES = {
  duo: { boards: 2, maxGuesses: 7 },
  quad: { boards: 4, maxGuesses: 9 },
} as const;
export type StackMode = keyof typeof STACK_MODES;
export type StackStatus = 'playing' | 'revealing' | 'won' | 'lost';

interface StackBoard {
  readonly answer: string;
  readonly guesses: readonly Guess[]; // Wordwright's Guess: word + evaluation
}
interface StackState {
  readonly id: string;
  readonly mode: StackMode;
  readonly boards: readonly StackBoard[]; // 2 or 4
  readonly words: readonly string[]; // every accepted guess; length = guesses used
  readonly currentInput: string;
  readonly status: StackStatus;
  readonly startedAt: number | null;
  readonly finishedAt: number | null;
}
```

```
Actions
  START            { id, mode, answers }   // answers from pickAnswers, one per board
  RESTORE          { state }               // a validated saved game (FR-112)
  ADD_LETTER       { letter, now }
  REMOVE_LETTER
  SUBMIT_GUESS     { word, now }           // word already passed validateGuess
  REVEAL_COMPLETE  { now }                 // then won / lost / playing
```

- `SUBMIT_GUESS` appends the word to `words` and, for each board not yet solved, appends `{ word, evaluation: evaluateGuess(word, answer) }` (FR-105). A solved board takes no more guesses, so its rows stay empty (FR-106, EC-39).
- `REVEAL_COMPLETE` sets `won` when every board is solved (EC-40), `lost` when `words.length` reaches the mode's `maxGuesses` with any board unsolved (FR-107), and `playing` otherwise.
- `pickAnswers(pool, recent, count, random)` calls `pickAnswer` once per board, putting each answer it has drawn at the front of the recent list, so the boards always get different answers (FR-103, EC-41). One ring buffer serves both modes.
- Selectors: `boardKeyStates(state)` returns one `deriveKeyStates(board.guesses)` map per board, or `null` for a solved board, which drops out of the key (FR-109). `boardRows(state, i)` is one board's `maxGuesses` rows, `boardStatus` is `playing`, `solved` or `failed`, and `boardsSolved`, `unsolvedAnswers`, `remainingGuesses`, `isGameOver` and `stackRecord` (the FR-111 stats record) round it out. A solve only counts once its reveal has finished, so neither the "solved" mark nor a blank key segment spoils the result mid-flip (FR-52).
- **Provider.** `StackProvider` loads the 5-letter dictionary, draws answers with `pickAnswers`, remembers them in the one shared ring buffer, and restores a saved game of the current mode whose answers are all still in the answer list. It words the A11Y-21 summary by scoring the guess once with the reducer before dispatching it.
- **Reuses** `evaluateGuess`, `validateGuess`, `deriveKeyStates`, `pickAnswer`, `Guess` and `RandomSource` from the root engine. No new evaluation code.

### 3.8 WordRange engine

`src/engine/range/`, T-80 to T-83. Rules in SPEC §18; rationale in ADR-030 and ADR-037 (lengths).

```ts
export const RANGE_LENGTHS = [4, 5, 6] as const; // DEFAULT_RANGE_LENGTH = 5
export const RANGE_MAX_GUESSES = { 4: 13, 5: 14, 6: 15 }; // floor(log2 list size) + 1 (FR-115)
export const lowerSentinel = (length: number) => 'A'.repeat(length); // not a word
export const upperSentinel = (length: number) => 'Z'.repeat(length); // not a word
export const HEAT_BANDS: Record<WordLength, readonly { heat: Heat; max: number }[]>;
// 5 letters: burning 20, hot 100, warm 500, cold 2000. 4 and 6 scale those by list
// size over 13,746. Anything further is 'freezing' (FR-120, ADR-037).
export type Heat = 'burning' | 'hot' | 'warm' | 'cold' | 'freezing';
export type RangeError = 'too-short' | 'not-a-word' | 'already-guessed' | 'outside-range';

interface RangeGuess {
  readonly word: string;
  readonly direction: 'before' | 'after' | null; // null = the secret itself
  readonly heat: Heat | null;
}
interface RangeState {
  readonly id: string;
  readonly secret: string;
  readonly wordLength: WordLength; // the length of the secret
  readonly guesses: readonly RangeGuess[]; // in play order; the view sorts them
  readonly lower: string; // starts at lowerSentinel(wordLength)
  readonly upper: string; // starts at upperSentinel(wordLength)
  readonly currentInput: string;
  readonly status: 'playing' | 'won' | 'lost';
  readonly startedAt: number | null;
  readonly finishedAt: number | null;
}
```

```
Actions
  START          { id, secret }            // the game's length is the secret's length
  RESTORE        { state }                 // a validated saved game (FR-125)
  ADD_LETTER     { letter, now }
  REMOVE_LETTER
  SUBMIT_GUESS   { word, distance, now }   // word passed validateRangeGuess;
                                           // distance from listDistance()
```

- `validateRangeGuess(input, { wordLength, lower, upper, guessed, isAllowed })` returns `Result<string, RangeError>` in FR-117 order. Steps 1 and 2 call `validateGuess`; then `already-guessed`; then `outside-range` unless `lower < word < upper`. A guess equal to a bound is always an earlier guess, so it stops at `already-guessed` and never reaches the range check (EC-42, EC-43). The sentinels are not in the guess list, so typing one fails at `not-a-word`.
- Bounds compare as plain strings. The lists are sorted uppercase A–Z, so string order is list order.
- `listDistance(sortedGuesses, a, b)` finds both words by binary search and returns the difference of their indices. `heatOf(distance, length)` maps it through that length's `HEAT_BANDS` (FR-120). Both are pure; the provider passes in the sorted guess array (§8.5).
- `SUBMIT_GUESS` records direction by comparing the word with the secret, moves `lower` (secret after the word) or `upper` (secret before it) (FR-118), and sets `won` on the secret or `lost` at the length's guess limit (FR-119).
- Selectors: `remainingGuesses`, `lastHeat`, `sortedGuesses`, `isGameOver` and the FR-124 stats record.
- **Provider.** `RangeProvider` holds the chosen length (saved in `wordgames:v1:range:prefs`), loads that length's dictionary, draws the secret with `pickAnswer` and that length's ring buffer in `wordgames:v1:range:meta`, and restores a saved game whose secret is still an answer and whose length is the chosen one. `setLength` clears the saved game, as WordCode's does. It validates with `validateRangeGuess`, looks the distance up with `listDistance(dictionary.guessList, …)`, and words the A11Y-22 summary by scoring the guess once with the reducer before dispatching it. Statistics are `{ overall, perLength }`, as in WordCode: each bucket's `distribution` has one entry per guess, index 0 for a win on guess 1, so 13, 14 and 15 entries per length and 15 overall. A blob saved before lengths existed is one flat bucket, and reads as the 5-letter bucket and the overall one (ADR-037).
- **View.** `RangeBoard` is one focusable scroll region holding the upper bound, the input row with the last heat, the lower bound and the sorted list, so the keyboard stays on screen with 13 guesses listed. The input row is a labelled group, not a grid, because there is no tile evaluation. `HeatBadge` writes the heat as a word with five pips beside it.
- **Reuses** `validateGuess` and `pickAnswer`. There is no tile evaluation and no reveal state.

### 3.9 WordCode engine

`src/engine/code/`, T-84 to T-87. Rules in SPEC §19; rationale in ADR-031.

```ts
export const CODE_MAX_GUESSES = 10;
export type CodeLength = WordLength; // 4 | 5 | 6, default 5
export type NoteMark = 'out' | 'in'; // absent from the map = unmarked

interface CodeGuess {
  readonly word: string;
  readonly bulls: number;
  readonly cows: number;
}
interface CodeState {
  readonly id: string;
  readonly wordLength: CodeLength;
  readonly secret: string;
  readonly guesses: readonly CodeGuess[];
  readonly notes: Readonly<Partial<Record<string, NoteMark>>>; // letter → mark (FR-132)
  readonly currentInput: string;
  readonly status: 'playing' | 'won' | 'lost';
  readonly startedAt: number | null;
  readonly finishedAt: number | null;
}
```

```
Actions
  START          { id, wordLength, secret }
  RESTORE        { state }                 // a validated saved game (FR-135)
  ADD_LETTER     { letter, now }
  REMOVE_LETTER
  SUBMIT_GUESS   { word, now } // word already passed validateGuess
  CYCLE_NOTE     { letter }    // unmarked → out → in → unmarked
```

- `scoreCode(guess, secret)` counts the `correct` and `present` entries of `evaluateGuess(guess, secret)` (FR-129). Duplicate letters therefore follow FR-12 and FR-13 with no new algorithm (EC-44). Example: `PANEL` against `PLANT` gives 1 bull and 3 cows.
- `SUBMIT_GUESS` sets `won` when bulls equal the length and `lost` at 10 guesses (FR-130).
- Notes live in the state, so they are saved with the session and restored on reload (FR-135, EC-45). The reducer never sets a mark itself.
- Selectors: `remainingGuesses`, `guessesUsed`, `noteOf(state, letter)`, `isGameOver` and `codeRecord` (the FR-134 stats record).
- **Provider.** `CodeProvider` loads the dictionary for the selected length, draws the secret with `pickAnswer` and that length's ring buffer, and restores a saved game of the current length whose secret is still an answer. A length change clears the saved game first and locks input until the new list loads. Statistics are one bucket set overall and one per length, each with 10 distribution buckets.
- **View.** `CodeRows` draws neutral tiles with the counts as text (`1 bull · 3 cows`), and each guess row reads as one line. The rows sit in one focusable scroll region, so the keyboard stays on screen at 6 letters. `CodeKeyboard` has a Type and Mark switch; in Mark mode a letter key cycles its note instead of typing. A note shows on its key as a dimmed key with a dashed outline and a × (ruled out) or a solid heavy outline and a ● (in the word). These use the existing neutral key tokens, so no new colour token was needed.
- **Reuses** `evaluateGuess`, `validateGuess`, `pickAnswer` and `WordLength`. There is no tile reveal: rows show neutral tiles and the counts as text (FR-131).

### 3.10 WordShuffle engine

`src/engine/shuffle/`, T-88 to T-91. Rules in SPEC §20; rationale in ADR-032 and ADR-038 (harder targets, scramble and clock).

```ts
export const MAX_HINTS = 2;
export type ShuffleLength = WordLength; // 4 | 5 | 6, default 5
export type AnswerError = 'too-short' | 'hint-moved' | 'not-a-word';

interface ShuffleState {
  readonly id: string;
  readonly wordLength: ShuffleLength;
  readonly target: string;
  readonly scramble: string; // the original order, for the result panel
  readonly tray: readonly string[]; // letters left, in their current order
  readonly slots: readonly (string | null)[]; // the answer row, one per position
  readonly hinted: readonly number[]; // locked positions, ascending, at most MAX_HINTS
  readonly status: 'playing' | 'solved' | 'gave-up';
  readonly found: string | null; // the word that solved it
  readonly anagrams: readonly string[]; // filled on solve or give up
  readonly startedAt: number | null;
  readonly finishedAt: number | null;
}
```

```
Actions
  START          { id, wordLength, target, scramble }
  RESTORE        { state }                 // a validated saved puzzle (FR-147)
  ADD_LETTER     { letter, now }           // typed or tapped; ignored if not in the tray (EC-46)
  REMOVE_LETTER                            // returns the last unlocked letter to the tray
  RESHUFFLE      { tray }                  // new order from shuffleLetters(tray, random, avoid)
  HINT           { now }                   // locks the next target letter
  SUBMIT_ANSWER  { word, anagrams, now }   // word passed validateAnswer
  GIVE_UP        { anagrams, now }
```

- **Targets and scrambles (ADR-038).** `createPuzzle({ targets, isWord }, recent, random)` draws from the shuffle list. `makeScramble` and `shuffleLetters` both list every distinct order of the letters, drop the current one and any word, keep the orders with the fewest letters where the reference has the same letter, and pick one at random. For a first scramble the reference is the target. For a reshuffle it is the target's letters not locked by a hint, passed in as `avoid`. This is at most 720 orders, so there is no retry loop. The provider falls back to `answers` when a dictionary has no shuffle list, as a test fixture may.
- **Clock (ADR-038).** `useElapsed(startedAt, finishedAt)` in `src/hooks/` ticks once a second while the game is running and holds still at the end. It reads the saved `startedAt`, so a restored game keeps counting. The engine stays free of timers: it only stores the two times it always stored.
- **Input model (FR-139, FR-142).** `ADD_LETTER` moves one copy of the letter from the tray into the leftmost empty slot. A locked slot is never empty, so it is skipped. `REMOVE_LETTER` clears the rightmost filled slot that is not locked and appends its letter to the tray. It never removes a locked letter. A letter that is not left in the tray, or a full row, returns the same state.
- **Hints.** `HINT` picks the leftmost position not in `hinted`. It first returns every unlocked letter in the row to the end of the tray, so the hinted letter is always available and never collides with a typed one (FR-142). It then places `target[position]` there, locks it and takes one copy of that letter out of the tray. It does nothing after `MAX_HINTS` or once the puzzle ends. The tray and the row together always hold exactly the letters of the scramble.
- `validateAnswer(slots, { target, hinted, isAllowed })` returns `Result<string, AnswerError>` in FR-140 order: an empty slot gives `too-short`, a locked position that differs from the target gives `hint-moved`, and a word not in the guess list gives `not-a-word`. The input model makes `hint-moved` unreachable from the UI. It is a guard against a bad action or a hand-edited session, and the provider shows no toast for it (EC-48). `SUBMIT_ANSWER` repeats the guard: it ignores a word that is not the row as it stands, or that moves a hinted letter.
- Any word that passes is a solve, target or not (FR-141, EC-47). The letters already match by construction, because the row is built from the tray.
- `anagramKey(word)` sorts a word's letters. `buildAnagramIndex(words)` maps each key to the list of words in the order given. `anagramsOf(index, word)` looks one up. The provider builds the index once per length from `dictionary.guessList` and caches it per `Dictionary`, so leaving and returning does not rebuild it. It passes the lookup result in `SUBMIT_ANSWER` and `GIVE_UP`, so the result panel can list every valid anagram (FR-144, FR-145).
- `makeScramble(target, isWord, random)` lists every distinct ordering of the letters (at most 720 for 6), drops the target and any ordering that is a word, and picks one with the injected `RandomSource`. There is no retry loop to bound. If none qualifies it returns `Err('no-scramble')`. `createPuzzle(lists, recent, random)` draws the target with `pickAnswer` and the ring buffer, and when a target has no scramble it leaves the pool and another is drawn (FR-138, EC-49). No shipped answer fails. `shuffleLetters(tray, random)` is a Fisher-Yates shuffle that rotates by one if it lands on the same order, so a reshuffle always visibly changes the tray (FR-143).
- Selectors: `canHint`, `hintsUsed`, `hintsLeft`, `hasInput`, `otherAnagrams`, `remainingOf`, `isGameOver` and `shuffleRecord` (the FR-146 stats record).
- **Provider.** `ShuffleProvider` loads the dictionary for the selected length, draws the puzzle, and restores a saved puzzle of the current length whose target is still an answer. A length change clears the saved puzzle first and locks input until the new list loads. Statistics are one bucket set overall and one per length. A bucket keeps played, solved, solved without hints, hints taken across solves, and the streaks. Given up and average hints per solve are derived, and the average is `null` (shown as the em dash) with no solves.
- **View.** `ShuffleBoard` is a labelled answer row and a tray of buttons at least 44 px square, so a 6-letter tray fits one row at 320 px. There is no on-screen keyboard: the tray is the keyboard, with **Backspace** and **Submit** buttons beside **Hint**, **Reshuffle** and **Give up**. The answer row's name lists each position and marks hinted letters. Each tray button is named with its letter and how many copies are left.
- **Reuses** `pickAnswer`, `pickRandom`, `RandomSource` and `WordLength`. There is no tile evaluation.

### 3.11 WordDodge engine

`src/engine/dodge/`, T-92 to T-95. Rules in SPEC §21; rationale in ADR-039.

```ts
interface DodgeGuess { readonly word: string; readonly evaluation: Evaluation }

interface DodgeSession {
  readonly id: string;
  readonly wordLength: WordLength; // 4 | 5 | 6, default 5
  readonly guesses: readonly DodgeGuess[];
  readonly currentInput: string;
  readonly status: 'playing' | 'revealing' | 'won' | 'gave-up';
  readonly startedAt: number | null;
  readonly finishedAt: number | null;
}

interface DodgeState extends DodgeSession {
  readonly candidates: readonly string[]; // every answer still possible, in list order
}

type DodgeAction =
  | START          { id, wordLength, answers }
  | RESTORE        { state }
  | ADD_LETTER     { letter, now }
  | REMOVE_LETTER
  | SUBMIT_GUESS   { word, now }     // validated by the provider
  | REVEAL_COMPLETE { now }
  | GIVE_UP        { now }
```

- **The adversary.** `chooseReply(guess, candidates)` in `adversary.ts` groups the candidates by `evaluateGuess(guess, c)`, keeps the largest group, and returns its colours and words. A tie goes to fewer hits (two for green, one for yellow), then to the smaller pattern key (`c`, `p`, `a` per letter). It throws on an empty list, which no game reaches.
- **Reducer.** `SUBMIT_GUESS` appends the guess with the chosen colours, narrows `candidates` and goes to `revealing`, like Wordwright (§3.2). `REVEAL_COMPLETE` makes the game `won` if the last reply was all green, and otherwise `playing` again. `GIVE_UP` needs a game in play with a guess made.
- **Save and restore.** `dodgeSession(state)` drops the candidates. `restoreGame(session, answers)` replays the guesses against the answers and returns null if any reply differs, so the provider starts a new game (FR-153).
- **Selectors.** `dodgeRows` (a row per guess plus the row being typed, as `RowView[]` for the shared `Board`), `wordsLeft`, `canGiveUp`, `revealedWord`, `isGameOver`, `dodgeRecord` (the FR-155 stats record), and `distributionIndex` / `distributionLabels` for the grouped chart.
- **Provider.** `DodgeProvider` loads the dictionary for the selected length, starts a game from its `answers`, restores a saved game of the current length that replays, and saves everything but a game that is revealing. It announces a guess in `completeReveal`, once the flip is done. There is no ring buffer and no meta repository.
- **View.** `DodgeView` reuses `Board`, `Keyboard`, `useRevealTimeline` and `usePhysicalKeyboard`. The board sits in a scrollable, keyboard-reachable group that scrolls to its newest row. Above it are the words-left count and **Give up**.
- **Reuses** `evaluateGuess`, `validateGuess`, `deriveKeyStates`, `RowView` and `WordLength`.

---

### 3.12 WordHunt engine

`src/engine/hunt/`, T-96 to T-99. Rules in SPEC §22; rationale in ADR-040.

```ts
interface HuntState {
  readonly id: string;
  readonly seed: string; // the 6-letter word the tray came from
  readonly tray: string; // the six letters, in the order shown
  readonly required: readonly string[]; // common words that hide in the tray, by length then alphabet
  readonly found: readonly string[]; // required words found, in order
  readonly bonus: readonly string[]; // other valid words found
  readonly currentInput: string;
  readonly status: 'playing' | 'won' | 'gave-up';
  readonly startedAt: number | null;
  readonly finishedAt: number | null;
}

type HuntAction =
  | START        { id, puzzle }
  | RESTORE      { state }
  | ADD_LETTER   { letter, now }
  | REMOVE_LETTER
  | SUBMIT_WORD  { word, now }     // validated by the provider
  | RESHUFFLE    { tray }          // from shuffleLetters()
  | GIVE_UP      { now }
```

- **Finding the words.** `requiredFor(letters, sources)` in `puzzle.ts` takes, for each length 4, 5 and 6, every distinct sorted-letter key of that many of the letters (`subsetKeys`), looks it up in that length's anagram index, and keeps the words in the common set. A word belongs to one key, so none repeats. `sources` holds, per length, the common set (answers and shuffle list) and the index built from the guess list.
- **The pool.** `buildPool(seeds, sources)` keeps the seeds with 8 to 20 required words. `createPuzzle(pool, sources, recent, random)` draws a seed with `pickAnswer` and the ring buffer, and scrambles it with WordShuffle's `shuffleLetters`.
- **Check.** `validateWord(input, state, isWord)` runs the FR-161 order: `too-short`, `not-from-tray`, `already-found`, `not-a-word`. It returns the word and whether it is required. The reducer re-checks length, tray and repeats, and trusts the dictionary result.
- **Reducer.** `SUBMIT_WORD` puts a required word in `found` and any other in `bonus`, and wins when `found` holds every required word. `ADD_LETTER` ignores a letter the tray has none left of. `RESHUFFLE` accepts only a reordering of the same letters.
- **Selectors.** `slotGroups` (the board's slots by length), `usedPositions` (which tray buttons typed letters are using), `missedWords`, `requiredCount`, `foundCount`, `isGameOver` and `huntRecord` (the FR-165 stats record).
- **Provider.** `HuntProvider` loads the 4, 5 and 6-letter dictionaries together, builds the sources and the pool once (cached against the 6-letter dictionary), and restores a saved puzzle or starts one. A saved puzzle needs no check against the lists. It has a ring buffer in `meta` and no prefs.
- **View.** `HuntBoard` shows the slots in a labelled scrollable group, the bonus words, the word row and a tray of buttons at least 44 px square. `HuntView` adds the words-found line, the clock (`useElapsed`), and **Backspace**, **Submit**, **Reshuffle** and **Give up**.
- **Reuses** WordShuffle's `buildAnagramIndex` and `shuffleLetters`, the root engine's `pickAnswer`, and `useElapsed`.

---

### 3.13 WordHang engine

`src/engine/hang/`, T-100 to T-103. Rules in SPEC §23; rationale in ADR-041.

```ts
interface HangState {
  readonly id: string;
  readonly wordLength: WordLength; // 4 | 5 | 6, default 5
  readonly secret: string;
  readonly tried: string; // every letter guessed, in order, each once
  readonly status: 'playing' | 'won' | 'lost';
  readonly startedAt: number | null;
  readonly finishedAt: number | null;
}

type HangAction =
  | START         { id, wordLength, secret }
  | RESTORE       { state }
  | GUESS_LETTER  { letter, now }
```

- **Derived, not stored.** The misses, the revealed letters and the key states are selectors over `secret` and `tried`: `missedLetters`, `misses`, `missesLeft`, `maskedWord`, `isSolved`, `occurrences` and `letterStates` (each tried letter as `correct` or `absent`).
- **Reducer.** `GUESS_LETTER` ignores a finished game, anything that is not A to Z, and a letter already tried, returning the same state. Otherwise it adds the letter, starts the clock on the first, and ends the game: `won` if every letter of the secret is tried, else `lost` at `MAX_MISSES = 6`. A win is checked first. There is no validation action, because a letter needs no dictionary.
- **Record.** `hangRecord` (the FR-174 stats record) has the misses and the time.
- **Provider.** `HangProvider` loads one dictionary for the selected length, draws the secret with `pickAnswer` and a ring buffer per length, and restores a saved game of the current length whose secret is still an answer. `guessLetter` works out the next state to word the announcement, so a letter that is ignored is not announced. Storage checks that a saved game's status is the one its letters give.
- **View.** `HangFigure` is an SVG of six parts, hidden from assistive technology. `HangWord` is one labelled group of tiles. `HangKeyboard` reuses the shared QWERTY layout without Enter and Backspace. `HangView` replaces the keyboard with `HangResultPanel` when the game ends.
- **Reuses** `pickAnswer`, the `KEYBOARD_ROWS` layout, `usePhysicalKeyboard` (with Enter and Backspace ignored) and `useEnterToContinue`.

---

## 4. Component Hierarchy

The suite tree as built (`src/App.tsx`, `src/shell/AppShell.tsx`). §4.1 has the reasoning and the game-by-game table.

```
<ErrorBoundary>
  <SettingsProvider>              theme, colourblind, motion (shared, ADR-024)
    <ToastProvider>               queue, auto-dismiss, live regions
      <AppShell>                  useHashRoute(); closes Settings when the view changes
        <Header>                  All games · <h1> · [controls slot] · Settings
        <HomeView />              #/            a <ul> of game cards
        <WordwrightView />        #/wordwright  StatsProvider > GameProvider > …
        <WeaverView />            #/weaver      WeaverStatsProvider > WeaverProvider > …
        <footer>  <StorageNotices />  <ToastRegion />  <SettingsModal />

WordwrightView
  <HeaderControls>                portalled into the header: How to play, New game,
                                  LengthSelector (4 / 5 / 6), Statistics
  <main>
    <Board role="grid"> <Row ×6> <Tile ×wordLength>
    <BoardSkeleton />  <DictionaryError />  <ResultPanel />     ← FR-56, EC-14, FR-21
    <Keyboard>
  <HelpModal />  <StatsModal />  <ConfirmDialog />              ← portals, focus-trapped

WeaverView
  <HeaderControls>                How to play, LengthSelector (4 / 5), Statistics
  <main>
    live region (polite)  <WeaverBoard role="grid" "Word ladder">  <WeaverResultPanel />
    <WeaverSkeleton />  <DictionaryError />  <GenerationError />
    Undo · Give up · New puzzle   <Keyboard (no letter colours)>
  <WeaverHelpModal />  <WeaverStatsModal />  <ConfirmDialog />
```

### 4.1 Suite provider tree

The tree above becomes the Wordwright branch of a routed shell (T-55). Shared providers stay at the top. Each game's providers mount only while its route is active, so Home loads no dictionary (FR-63, NFR-15).

Suite V1 picks the branch with a `switch` over the route (ADR-021). From T-74 the shell reads the static game catalogue instead (ADR-028, FR-97), and every game view is a `React.lazy` chunk (NFR-20):

```
<ErrorBoundary>
  <SettingsProvider>                 appearance only: theme, colourblind, motion (ADR-024)
    <ToastProvider>
      <StorageNotices />
      <AppShell>                     header frame, <main>, footer, ToastRegion, SettingsModal
        route = useHashRoute()       ← parseHash() looks the hash up in GAMES
          home   → <HomeView>        ← <ul> with one <GameCard> per GAMES entry, in order (A11Y-14)
          game   → <h1>{entry.name}</h1> and document.title, straight from the catalogue
                   <Suspense fallback={<ViewSkeleton />}>
                     <entry.View />  ← lazy chunk; mounts only its own providers
```

Each `View` module wraps its own provider pair around its view. The shell never imports a game's providers, state or engine:

| Route          | `View` module mounts                                                                                                    |
| -------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `#/wordwright` | `StatsProvider` › `GameProvider` › Wordwright view (board, keyboard, Help/Stats modals)                                 |
| `#/weaver`     | `WeaverStatsProvider` › `WeaverProvider` (reducer, dictionary, ladder graph, prefs) › `WeaverView`                      |
| `#/stack`      | `StackStatsProvider` › `StackProvider` (reducer, 5-letter dictionary, mode pref) › `StackView` (boards, split keyboard) |
| `#/range`      | `RangeStatsProvider` › `RangeProvider` (reducer, dictionary and sorted guess list for the length) › `RangeView`         |
| `#/code`       | `CodeStatsProvider` › `CodeProvider` (reducer incl. letter notes, dictionary, length pref) › `CodeView`                 |
| `#/shuffle`    | `ShuffleStatsProvider` › `ShuffleProvider` (reducer, dictionary, anagram index, length pref) › `ShuffleView`            |
| `#/dodge`      | `DodgeStatsProvider` › `DodgeProvider` (reducer, dictionary, replay on restore, length pref) › `DodgeView`              |
| `#/hunt`       | `HuntStatsProvider` › `HuntProvider` (reducer, three dictionaries, word sources and pool) › `HuntView`                  |
| `#/hang`       | `HangStatsProvider` › `HangProvider` (reducer, dictionary, length pref) › `HangView`                                    |

- The header `<h1>` and page title come from the catalogue entry, so they render before the chunk resolves. Focus moves to the `<h1>` on a route change as before (A11Y-15).
- A game that has not shipped has no catalogue entry, so its route goes Home (FR-97, EC-22).

- The header frame belongs to the shell. In a game view it shows **All games**, the game name as the `<h1>`, that game's controls, then settings (FR-64). The game view supplies its controls, because they need the game's context. On Home it shows the suite name and settings only.
- Unmounting a game provider flushes its session write immediately, skipping the debounce (FR-65, EC-24). `GameProvider` does this since T-51.
- **WordWeaver providers** (`src/state/weaver/`). `WeaverStatsProvider` holds the statistics, with `recordGame` idempotent by game id and scoped resets. `WeaverProvider` owns the rest: it loads the dictionary for the active length, builds the ladder graph once per ladder list (a module-level `WeakMap` keyed by the list), restores or generates a puzzle, validates and submits rungs, computes the give-up ladder, persists the session (debounced 150 ms, on page hide and on unmount), records the finished puzzle once, and keeps the polite announcement. It exposes `useWeaver()`. A restored `revealing` session is settled on restore by dispatching `REVEAL_COMPLETE`, so the row shows revealed and a winning rung is recorded as the solve (EC-23). A saved puzzle that breaks any FR-93 rule is discarded silently (`isWeaverSessionUsable`).
- Announcements (A11Y-17) are set in the actions that cause them: `submitRung` (`CARD: 2 of 4 letters match`), `undo` (`Removed CARD`), `completeReveal` when the end word lands (`Solved in 4 moves. Par 4.`) and `giveUp` (`Gave up. One shortest ladder: …`). The live region is `{ text, flip }`: when the same text arrives twice running, `flip` adds a trailing non-breaking space so the content changes and a screen reader reads it again.
- The header frame is the shell's, so its `<h1>` and the **All games** link exist before a game view does. A game's own controls reach the header through a portal: the shell stores the header's controls element in `HeaderSlotContext`, and the game view renders `<HeaderControls>…</HeaderControls>`, which portals into it. Tab order stays All games, title, controls, Settings, and the controls still read the game's providers through React's tree.
- `useHashRoute` sets `document.title` and moves focus to the `<h1>` after a change (not on first load). The shell closes Settings when the view changes by resetting its state during render when the view differs from the one it last showed; game dialogs close by unmounting with their view.
- `Modal` keeps a module-level stack of open dialogs, so only the topmost reacts to Escape. A `ConfirmDialog` over Settings or Statistics cancels alone.
- `ConfirmDialog` (T-52) is shared by every game for restart, length or mode change, New puzzle, Give up and the stats resets (FR-34, FR-47, FR-94, FR-113, FR-125, FR-135, FR-144, FR-147).
- Shared presentational parts are reused by import: `Board` and `Tile` (WordStack boards), `Keyboard` (every game; WordStack passes per-board states and renders `SplitKey`, WordRange passes no states, WordCode passes its note marks), `Modal`, `Button` and `useEnterToContinue` (FR-100). Each game has its own result panel. `Board` needs a label prop for "Board 1 of 4" (A11Y-20); it is hard-coded to "Guess board" today.

---

## 5. State Management

| Slice            | Owner                                    | Persisted             | Shape                             |
| ---------------- | ---------------------------------------- | --------------------- | --------------------------------- |
| Active game      | `GameProvider` (`useReducer`)            | Yes, debounced 150 ms | `GameState`                       |
| Dictionary       | `GameProvider` (ref + `useState` status) | No (bundled)          | `Dictionary`                      |
| Statistics       | `StatsProvider` (`useReducer`)           | Yes, immediate        | `StatsState`                      |
| Settings         | `SettingsProvider` (`useState`)          | Yes, immediate        | `Settings`                        |
| Toasts           | `ToastProvider` (`useReducer`)           | No                    | `Toast[]`                         |
| Reveal animation | `useRevealTimeline` (local)              | No                    | `{ revealingRow, revealedTiles }` |
| Modal open/close | `AppShell` local state                   | No                    | booleans                          |

**Why Context + `useReducer` and not Redux/Zustand/Jotai:** four independent slices, shallow trees, no cross-cutting async. Contexts are split by slice so a toast never re-renders the board. Every context value is `useMemo`'d and every callback `useCallback`'d. If profiling ever shows a problem, `useSyncExternalStore` over a tiny store is a drop-in — but do not pre-optimise (see ADR-006).

**Ephemeral vs persistent:** animation, focus, and modal state never touch storage. Only game session, stats, and settings persist.

### 5.1 Suite slices

The suite adds these slices and changes two existing ones (ADR-024):

| Slice                  | Owner                                   | Persisted                                         | Shape                                  |
| ---------------------- | --------------------------------------- | ------------------------------------------------- | -------------------------------------- |
| Route                  | `useHashRoute` (`useSyncExternalStore`) | In the URL hash                                   | `Route` (`home` or a `GameId`)         |
| Settings (changed)     | `SettingsProvider`                      | Yes, immediate                                    | `{ theme, colorblind, motion }`        |
| Wordwright prefs (new) | `GameProvider`                          | Yes, immediate                                    | `{ defaultWordLength }`                |
| WordWeaver game        | `WeaverProvider` (`useReducer`)         | Yes, debounced 150 ms + page hide + unmount flush | `WeaverState`                          |
| Ladder graph           | `WeaverProvider` (ref, per length)      | No (built from bundled lists)                     | `LadderGraph`                          |
| WordWeaver dictionary  | `WeaverProvider` (via `loadDictionary`) | No (bundled)                                      | `Dictionary` + ladder list             |
| WordWeaver prefs       | `WeaverProvider`                        | Yes, immediate                                    | `{ defaultWordLength: WeaverLength }`  |
| WordWeaver statistics  | `WeaverStatsProvider` (`useReducer`)    | Yes, immediate                                    | overall + per length + last 50 (FR-92) |
| WordWeaver meta        | `WeaverProvider`                        | Yes, immediate                                    | `{ recentStarts: { 4: [], 5: [] } }`   |
| Reveal animation       | `useRevealTimeline` (local, reused)     | No                                                | `{ revealingRow, revealedTiles }`      |

Releases R2–R5 add one set of slices per game. The persisted ones map to the keys in §7.6.

| Slice                   | Owner                                  | Persisted                                         | Shape                                                   |
| ----------------------- | -------------------------------------- | ------------------------------------------------- | ------------------------------------------------------- |
| Game catalogue          | `shell/catalogue.ts` (module constant) | No                                                | `readonly CatalogueEntry[]` (ADR-028)                   |
| WordStack game          | `StackProvider` (`useReducer`)         | Yes, debounced 150 ms + page hide + unmount flush | `StackState` (§3.7)                                     |
| WordStack prefs, meta   | `StackProvider`                        | Yes, immediate                                    | `{ mode }`; `{ recentAnswers }`, one buffer             |
| WordStack statistics    | `StackStatsProvider` (`useReducer`)    | Yes, immediate                                    | overall + per mode + last 50 (FR-111)                   |
| WordRange game          | `RangeProvider` (`useReducer`)         | Yes, debounced 150 ms + page hide + unmount flush | `RangeState` (§3.8)                                     |
| WordRange meta          | `RangeProvider`                        | Yes, immediate                                    | `{ recentAnswers }` per length                          |
| WordRange statistics    | `RangeStatsProvider` (`useReducer`)    | Yes, immediate                                    | overall + per length + last 50 (FR-124)                 |
| WordCode game           | `CodeProvider` (`useReducer`)          | Yes, debounced 150 ms + page hide + unmount flush | `CodeState` incl. letter notes (§3.9)                   |
| WordCode prefs, meta    | `CodeProvider`                         | Yes, immediate                                    | `{ defaultWordLength }`; `{ recentAnswers }` per length |
| WordCode statistics     | `CodeStatsProvider` (`useReducer`)     | Yes, immediate                                    | overall + per length + last 50 (FR-134)                 |
| WordShuffle game        | `ShuffleProvider` (`useReducer`)       | Yes, debounced 150 ms + page hide + unmount flush | `ShuffleState` (§3.10)                                  |
| Anagram index           | `ShuffleProvider` (ref, per length)    | No (built from bundled lists)                     | `Map<string, readonly string[]>`                        |
| WordShuffle prefs, meta | `ShuffleProvider`                      | Yes, immediate                                    | `{ defaultWordLength }`; `{ recentAnswers }` per length |
| WordShuffle statistics  | `ShuffleStatsProvider` (`useReducer`)  | Yes, immediate                                    | overall + per length + last 50 (FR-146)                 |
| WordDodge game          | `DodgeProvider` (`useReducer`)         | Yes, debounced 150 ms + page hide + unmount flush | `DodgeSession` without candidates (§3.11)               |
| WordDodge prefs         | `DodgeProvider`                        | Yes, immediate                                    | `{ defaultWordLength }`; no meta                        |
| WordDodge statistics    | `DodgeStatsProvider` (`useReducer`)    | Yes, immediate                                    | overall + per length + last 50 (FR-155)                 |
| WordHunt puzzle         | `HuntProvider` (`useReducer`)          | Yes, debounced 150 ms + page hide + unmount flush | `HuntState` incl. its own word list (§3.12)             |
| WordHunt word sources   | `HuntProvider` (cached, per session)   | No (built from bundled lists)                     | per length: common set + anagram index; seed pool       |
| WordHunt meta           | `HuntProvider`                         | Yes, immediate                                    | `{ recentAnswers }`, one buffer; no prefs               |
| WordHunt statistics     | `HuntStatsProvider` (`useReducer`)     | Yes, immediate                                    | one set + last 50 (FR-165)                              |
| WordHang game           | `HangProvider` (`useReducer`)          | Yes, debounced 150 ms + page hide + unmount flush | `HangState`: secret and letters tried (§3.13)           |
| WordHang prefs, meta    | `HangProvider`                         | Yes, immediate                                    | `{ defaultWordLength }`; `{ recentAnswers }` per length |
| WordHang statistics     | `HangStatsProvider` (`useReducer`)     | Yes, immediate                                    | overall + per length + last 50 (FR-174)                 |

Each game's slices are independent of every other game's. Nothing in one game's tree reads another game's state (FR-99, AC-56).

---

## 6. Data Flow

### 6.1 A guess, end to end

```
User presses Enter (physical or on-screen)
      │
      ▼
usePhysicalKeyboard / <Key onClick>  →  useGame().submitGuess()
      │
      ▼
GameProvider guard:
   validateGuess(input, wordLength, dictionary.guesses.has)
      │                                   │
   Err('too-short'|'not-a-word')      Ok(word)
      │                                   │
   toast + shake                     dispatch SUBMIT_GUESS { now }
   (no turn consumed)                     │
                                          ▼
                             reducer: evaluateGuess() → append Guess,
                             clear input, set status, lock input
                                          │
                                          ▼
                    Board re-renders → useRevealTimeline staggers tiles
                    (250 ms apart; instant if reduced motion)
                                          │
                                          ▼
                    onComplete → dispatch REVEAL_COMPLETE
                                          │
                          ┌───────────────┼───────────────┐
                          ▼               ▼               ▼
                    still playing       won             lost
                                          │               │
                                          └──── StatsProvider.recordGame(record)
                                                (idempotent by game id, FR-20)
                                                          │
                                                statsRepository.save()  → LocalStorage
                                                announcer.announce(result)  → aria-live
```

### 6.2 Keyboard letter states

Derived, never stored: `deriveKeyStates(guesses)` folds every evaluation into a `Map<string, LetterState>` using precedence `correct > present > absent`. Memoised on `guesses`. No possibility of drift between board and keyboard.

### 6.3 Startup

```
main.tsx → App
  1. SettingsProvider reads settings (sync, before first paint via a small
     inline script that sets the `dark` class to avoid a flash)
  2. StatsProvider reads + migrates stats
  3. GameProvider reads the saved session
       ├─ valid session → status 'loading' → load that length's dictionary
       │     → validate answer still exists → status 'playing' (restored)
       └─ none/invalid → load default-length dictionary → START_GAME
  4. Dictionary chunk resolves → Set built → board interactive
```

In the suite, `main.tsx` runs the legacy import (§7.7) before `createRoot().render()`. Steps 2–4 then run only when the Wordwright route is active, and the WordWeaver provider follows the same pattern for its own route.

### 6.4 Hash routing

Rationale in ADR-022. There is no router library.

```
location.hash ──▶ parseHash()            (shell/routes.ts)
                    '#/'            → { view: 'home' }
                    '#/wordwright'  → { view: 'wordwright' }
                    '#/weaver'      → { view: 'weaver' }
                    anything else   → home, and history.replaceState(…, '#/')   (EC-22)

useHashRoute() = useSyncExternalStore(subscribe to 'hashchange', () => parseHash(location.hash))
```

- From T-74, `parseHash` matches the hash against the `route` of each catalogue entry instead of a fixed list, so `#/stack`, `#/range`, `#/code` and `#/shuffle` resolve only once their game is in the catalogue (FR-97, FR-98, ADR-028).
- Links are plain `<a href="#/weaver">`. Back and Forward fire `hashchange`, so they need no extra code.
- On a route change the shell sets `document.title` (FR-66) and moves focus to the new view's `<h1>`, which has `tabindex="-1"` (A11Y-15).
- An open dialog closes on a route change, and focus still goes to the new `<h1>` (EC-38).
- Leaving a game unmounts its providers, which flush the session first (FR-65, EC-23, EC-24). Returning restores it through the normal startup path (§6.3).

### 6.5 Enter to continue

Rationale in ADR-027. `GameView` puts `isGameOver` into `inputLocked`, which detaches `usePhysicalKeyboard` on the result panel, so continuing is a separate hook.

`useEnterToContinue(onContinue)` (`src/hooks/useEnterToContinue.ts`) is called by each game's result panel, with `onContinue` doing the same as **Play again** (FR-72):

```
result panel mounts (after the final REVEAL_COMPLETE)
  └─ window keydown listener attached
       key !== 'Enter'                          → ignore
       event.repeat                             → ignore (EC-35)
       ctrl / meta / alt / shift held           → ignore
       a dialog is open                         → ignore (EC-36)
       focus on button, link or text field      → ignore (the control handles Enter)
       otherwise                                → preventDefault, onContinue()
result panel unmounts → listener removed
```

- The listener only exists while the result panel is mounted. The Enter that submitted the final guess or rung happened before mount, so it cannot also start a new game (FR-73, AC-28, AC-29).
- The hook never moves focus, and **Play again** is not autofocused (A11Y-18).
- `usePhysicalKeyboard` does not change.

---

## 7. LocalStorage Strategy

### 7.1 Keys and versioning

```
wordwright:v1:settings   Settings
wordwright:v1:stats      StatsState  (aggregate + perLength + recentGames)
wordwright:v1:session    GameState   (in-progress)
wordwright:v1:meta       { schemaVersion: number, recentAnswers: Record<WordLength, string[]> }
```

One namespace prefix, one slice per key. Slices are independent so a corrupt session never destroys stats.

These are the pre-rename keys. Since T-51 the code uses the layout in §7.6, and these are only read by the legacy import (§7.7).

### 7.2 The repository pattern

Components never touch `localStorage`. A single generic factory provides typed access:

```ts
interface Repository<T> {
  read(): T;                  // always returns valid data (falls back to defaults)
  write(value: T): void;      // best-effort; swallows quota errors into a warning
  clear(): void;
  subscribe(fn: (value: T) => void): () => void;   // cross-tab `storage` events (EC-16)
}

createRepository<T>({ key, defaults, validate, migrate }): Repository<T>
```

`read()` pipeline: `getItem` → `JSON.parse` (guarded) → `migrate(raw)` → `validate(candidate)` → value, **or** defaults + a `corrupt-data` warning toast on any failure (EC-12).

### 7.3 Storage availability

`safeStorage.ts` probes with a write/read/delete of a sentinel key inside `try/catch`. If it throws (Safari private mode, disabled cookies, quota 0), it exports an in-memory `Map`-backed implementation with the same interface and flags `isPersistent = false`, which drives the one-time warning of EC-11. The rest of the app is unaware.

### 7.4 Migrations

```ts
type Migration = (data: unknown) => unknown;
const migrations: Record<number, Migration> = {/* 1: v0→v1, … */};
```

`meta.schemaVersion` drives the chain: run each migration from the stored version up to `CURRENT_SCHEMA_VERSION`. A stored version **newer** than the app's resets to defaults with a toast (EC-13). V1 ships version 1 and an empty chain, but the machinery exists so V2 can add fields without data loss.

**Current state:** the chain is not wired into any repository. `createRepository` accepts an optional `migrate`, but none of the settings, stats, session or meta repositories passes one, so `migrate()` in `migrations.ts` never runs at read time. This is why the rename uses a separate boot-time import (§7.7, ADR-023) rather than a migration.

### 7.5 Write policy

- Settings & stats: write immediately (rare, small, must not be lost).
- Session: debounced 150 ms, plus a flush on `visibilitychange`/`pagehide` (mobile-safe; `beforeunload` is unreliable on iOS).
- Serialisation is whole-slice; no partial writes (FR-42).
- A game's session is also written immediately when its view unmounts (FR-65, EC-24). `GameProvider` mirrors its latest state into a ref and writes it in an unmount cleanup (T-51).

### 7.6 Suite key layout

From SPEC FR-68. One namespace for the suite, then one sub-namespace per game. Rationale in ADR-023 and ADR-024.

| Key                                                  | Contents                                                                     |
| ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| `wordgames:v1:settings`                              | `{ theme, colorblind, motion }`                                              |
| `wordgames:v1:meta`                                  | `{ schemaVersion, importedFrom, importedAt }`                                |
| `wordgames:v1:wordwright:{prefs,stats,session,meta}` | Existing Wordwright shapes, unchanged. `prefs` is `{ defaultWordLength }`    |
| `wordgames:v1:weaver:{prefs,stats,session,meta}`     | WordWeaver shapes (SPEC §16). `meta` is `{ recentStarts: { 4: [], 5: [] } }` |

- `wordgames:v1:meta` doubles as the import marker (§7.7).
- Repositories are per-game factories: `createStatsRepository(gameId, onIssue)`, `createSessionRepository(gameId, …)`, `createMetaRepository(gameId, …)`, plus `createWordwrightPrefsRepository` and the shared `createSettingsRepository`. Providers create them once per instance with a lazy `useState`, not at module scope. Shared `Settings` is `{ theme, colorblind, motion }`; `defaultWordLength` moved to Wordwright `prefs` (T-51).
- `isOwnedKey` covers both the `wordgames:` and `wordwright:` prefixes, and `resetAllData()` removes every owned key it finds in the live store, so **Reset data** on the error screen clears both (FR-71). The `safeStorage` probe key is `__wordgames_probe__`. `safeStorage.keys()` enumerates with `length` and `key(i)`.
- Shared settings still sync across tabs through `storage` events. Per-game keys are independent, so two tabs on different games do not collide (EC-28).

**Per-game keys.** `gameKeys(gameId)` exists from T-51, with `GameId` a closed union (`'wordwright' | 'weaver'`) until T-74 widens it. Every game, including the two above, gets its keys from one builder in `src/storage/keys.ts` (FR-99):

```ts
gameKeys(gameId) → {
  prefs:   `wordgames:v1:${gameId}:prefs`,
  stats:   `wordgames:v1:${gameId}:stats`,
  session: `wordgames:v1:${gameId}:session`,
  meta:    `wordgames:v1:${gameId}:meta`,
}
```

Only the key names are shared. Each game keeps its own validators, defaults and repositories, and Wordwright and WordWeaver move onto the builder with no change to their key strings.

| Game (`gameId`)         | `prefs`                                  | `meta`                                       | `stats` / `session`                      |
| ----------------------- | ---------------------------------------- | -------------------------------------------- | ---------------------------------------- |
| WordStack (`stack`)     | `{ mode: 'duo' \| 'quad' }`, default Duo | `{ recentAnswers: string[] }`, both modes    | FR-111 / `StackState` (FR-112)           |
| WordRange (`range`)     | not used, no selector                    | `{ recentAnswers: string[] }`                | FR-124 / `RangeState` (FR-125)           |
| WordCode (`code`)       | `{ defaultWordLength }`, default 5       | `{ recentAnswers: { 4: [], 5: [], 6: [] } }` | FR-134 / `CodeState` with notes (FR-135) |
| WordShuffle (`shuffle`) | `{ defaultWordLength }`, default 5       | `{ recentAnswers: { 4: [], 5: [], 6: [] } }` | FR-146 / `ShuffleState` (FR-147)         |
| WordDodge (`dodge`)     | `{ defaultWordLength }`, default 5       | not used: no secret is drawn                 | FR-155 / `DodgeSession` (FR-153)         |
| WordHunt (`hunt`)       | not used: one fixed size                 | `{ recentAnswers: string[] }`, seeds         | FR-165 / `HuntState` (FR-164)            |
| WordHang (`hang`)       | `{ defaultWordLength }`, default 5       | `{ recentAnswers: { 4: [], 5: [], 6: [] } }` | FR-174 / `HangState` (FR-173)            |

- Each game's ring buffer lives in its own `meta`, so playing one game never changes another game's answer rotation.
- Restore rules follow FR-32 and FR-33: a saved session is discarded silently if any answer, secret or target has left the answer list (FR-112, FR-125).
- After T-51, `isOwnedKey` matches the whole `wordgames:` prefix, so **Reset data** (FR-71) covers new games with no change.

### 7.7 Legacy import

The rename (ADR-023) moves data from the `wordwright:v1:*` keys to the layout above. It runs once, in `main.tsx`, before the first render (FR-69):

```
storage unavailable?                          → skip, run in memory (EC-27)
wordgames:v1:meta present?                    → skip (already imported, EC-25)
no wordwright:v1:* key?                       → skip (new player)
otherwise:
  wordwright:v1:settings → split → wordgames:v1:settings     { theme, colorblind, motion }
                                 → wordgames:v1:wordwright:prefs { defaultWordLength }
  wordwright:v1:stats    → copy as-is → wordgames:v1:wordwright:stats
  wordwright:v1:session  → copy as-is → wordgames:v1:wordwright:session
  wordwright:v1:meta     → copy as-is → wordgames:v1:wordwright:meta
  write wordgames:v1:meta { schemaVersion, importedFrom: 'wordwright:v1', importedAt }   ← last
```

- The marker is written last, so an interrupted import runs again on the next load.
- Values are copied, not moved. Legacy keys are never modified or deleted in this release (NFR-17).
- The import never throws. A failure leaves the app on defaults.
- A destination key that already exists is never overwritten, so if an interrupted import is retried after the player has played, the newer data wins. Each copy is read back before the marker is written; if one cannot be verified the marker is skipped and the import retries on the next load. The code is `src/storage/legacyImport.ts`.
- A corrupt legacy value is copied unchanged. The normal repository read then resets that slice with one toast (EC-26).
- The inline theme script in `index.html` reads `wordgames:v1:settings` and falls back to `wordwright:v1:settings`, so the first load after the rename paints the right theme before the import has run (FR-70).

---

## 8. Dictionary Loading

### 8.1 Shape

```ts
// dictionary/registry.ts
export const DICTIONARY_REGISTRY: Record<WordLength, () => Promise<RawLists>> = {
  4: () => import('./data/lists-4'),
  5: () => import('./data/lists-5'),
  6: () => import('./data/lists-6'),
};
```

Each data module exports `answers: string[]` and `guesses: string[]` as plain TS arrays. Vite code-splits each into its own chunk, so a 5-letter player never downloads the 6-letter list. Everything is bundled at build time — **no `fetch`, no runtime network** (NFR-5). Dynamic `import()` of a bundled chunk is served from the same origin's already-cached assets and works offline after first load.

### 8.2 Loader

```ts
export async function loadDictionary(length: WordLength): Promise<Dictionary>;
```

- In-memory `Map<WordLength, Dictionary>` cache; a second call is synchronous-fast and never re-imports.
- An in-flight `Map<WordLength, Promise>` deduplicates concurrent requests (React 19 StrictMode double-effect safety).
- Builds `guesses` as a `Set<string>` once (FR-17, O(1) validation).
- Rejects with a typed `DictionaryLoadError`, surfaced as EC-14's retry panel.

### 8.3 Data invariants (enforced by tests, FR-27)

For every list: uppercase, `/^[A-Z]+$/`, exact length, no duplicates, sorted, `answers ⊆ guesses`, `answers.length ≥ 300`, `guesses.length ≥ 1500`.

For the 4 and 5-letter modules the ladder list obeys the same rules, plus `answers ⊆ ladder ⊆ guesses` (T-58). The checks live in `src/dictionary/__tests__/listInvariants.ts`, and `ladderInvariants.test.ts` corrupts a sound fixture one way at a time to prove each check can fail.

### 8.4 WordWeaver reuse

WordWeaver adds no loader, no registry entry and no data chunk (NFR-14).

- `WeaverLength = Extract<WordLength, 4 | 5>`, so `WeaverProvider` calls the same `loadDictionary(4 | 5)` and gets the same cached `Dictionary`. A player who switches between games at 5 letters downloads the 5-letter chunk once.
- `scripts/build-dictionaries.mjs` adds a third export to `lists-4.ts` and `lists-5.ts`: the **ladder list**: the most frequent ENABLE1 words of that length, ranked by the same frequency data as the answers, plus every answer (FR-75). `lists-6.ts` is unchanged. Each chunk may grow by at most 15 KB gzipped. Measured growth: `lists-4` +2.6 KB, `lists-5` +13.2 KB.
- The ladder list's size is the smallest frequency cut where at least 90% of answer starts have one or more in-band ends, within the 15 KB budget. `scripts/measure-par.mjs` fixes it and `PAR_BAND` together (FR-77). The result is 1,400 words for 4 letters and 5,000 for 5 letters, which reaches 74.9% (§15.1 of the SPEC has the table and the reasoning). The generator and the measurement script share one set of helpers, exported from `scripts/build-dictionaries.mjs`, which runs `main()` only when executed directly.
- `RawLists` and `Dictionary` have an optional `ladder` field, present only for lengths that have one. The guess `Set` is shared by both games.
- The ladder graph (§3.6) is built from the ladder list by `WeaverProvider` after the chunk loads, and cached per length for the session.

### 8.5 Dictionary reuse in releases R2–R5

The four new games add no loader, no registry entry and no data chunk (NFR-18). Each calls `loadDictionary(length)` and gets the same cached `Dictionary` as the other games, so a chunk is downloaded once per session whichever game asks first. None of them uses the ladder list.

| Game        | Chunks                | Answer list                                                  | Guess `Set`                                        | Sorted guess array                        |
| ----------- | --------------------- | ------------------------------------------------------------ | -------------------------------------------------- | ----------------------------------------- |
| WordStack   | `lists-5`             | 2 or 4 distinct answers (FR-103)                             | validation (FR-104)                                | not used                                  |
| WordRange   | `lists-5`             | the secret (FR-115)                                          | validation (FR-117)                                | list distance for heat (FR-120)           |
| WordCode    | `lists-4`, `-5`, `-6` | the secret (FR-127)                                          | validation (FR-128)                                | not used                                  |
| WordShuffle | `lists-4`, `-5`, `-6` | the target (FR-138)                                          | validation and the scramble check (FR-138, FR-140) | builds the anagram index (FR-141, FR-144) |
| WordDodge   | `lists-4`, `-5`, `-6` | the candidates (FR-149)                                      | validation (FR-151)                                | not used                                  |
| WordHunt    | `lists-4`, `-5`, `-6` | with the shuffle list, the required words and seeds (FR-159) | validation (FR-161)                                | builds the anagram index (FR-159)         |
| WordHang    | `lists-4`, `-5`, `-6` | the secret (FR-168)                                          | not used                                           | not used                                  |

- `Dictionary` holds `guesses` only as a `Set` today (`src/dictionary/types.ts`). WordRange and WordShuffle need the sorted array as well, so `Dictionary` gains a read-only `guessList` field that points at the module's existing array. Nothing is copied.
- The lists are already sorted, uppercase and unique, and `answers ⊆ guesses` (§8.3). WordRange relies on this: string order is list order, so bounds compare as strings and heat is a difference of indices (ADR-030).
- WordShuffle's anagram index is built by `ShuffleProvider` after the chunk loads and cached per length for the session, like WordWeaver's ladder graph. The 6-letter guess list (24,637 words) is the largest input.

---

## 9. Styling & Theming

- Tailwind utility classes in components; **no CSS-in-JS**, no styled-components.
- Semantic design tokens as CSS custom properties in `styles/index.css`, consumed by Tailwind:
  `--color-tile-correct`, `--color-tile-present`, `--color-tile-absent`, `--color-key-*`, `--color-surface`, `--color-text`, `--color-focus`.
- **Dark mode:** `dark` class on `<html>`, toggled by `useTheme`; `system` subscribes to a `matchMedia` listener (FR-43, EC-17). An inline script in `index.html` sets the class before hydration to prevent a flash of the wrong theme.
- **Colourblind mode:** `data-palette="cb"` on `<html>` re-points the same tokens to blue/orange. Because every component uses tokens, no component knows the palette exists — that is the extension point for V2 themes (ADR-008).
- **Motion:** `data-motion="reduced"` on `<html>` plus a `@media (prefers-reduced-motion: reduce)` block; both zero out durations in `animations.css`. The `useRevealTimeline` hook also collapses its stagger to 0 so logic and CSS agree (A11Y-9).
- Layout uses flex column with `min-h-dvh`, `clamp()`-sized tiles, and container-driven sizing so 320 px and landscape phones both fit (FR-59, EC-18).
- The help dialog's example tiles (FR-60) reuse the board's own token classes and colourblind marker glyphs, exported from `board/tileAppearance.ts`, rather than a fixed `clamp()` size — so no new colour token exists and `scripts/check-contrast.mjs` needed no change.

---

## 10. Accessibility Implementation

| Concern              | Mechanism                                                                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Board semantics      | `role="grid"` / `role="row"` / `role="gridcell"`, `aria-label` per tile including state (A11Y-2)                                              |
| Result announcements | `useAnnouncer` writes to a polite live region; the message is composed after reveal so it is announced once (A11Y-3)                          |
| Errors               | Separate assertive live region inside `ToastRegion` (A11Y-4)                                                                                  |
| Focus trap           | `useFocusTrap` — first focusable on open, cycle on Tab, `Esc` to close, restore to trigger (FR-57, A11Y-11)                                   |
| Focus ring           | Global `:focus-visible` ring using `--color-focus`; `outline: none` is never used without a replacement (A11Y-6)                              |
| Keys                 | Real `<button>`s with `aria-label` + `aria-pressed`-free state text (A11Y-10)                                                                 |
| Physical keyboard    | A single window listener that ignores events when `event.metaKey/ctrlKey/altKey` (EC-4) or when a modal is open (EC-7)                        |
| Landmarks            | `header` / `main` / `footer`, one `h1` (A11Y-12)                                                                                              |
| Help examples        | Decorative tiles are `aria-hidden`; the sentence beneath carries the meaning, so no `gridcell` appears outside the board's own grid (A11Y-13) |

---

## 11. Testing Strategy

### Pyramid

| Layer       | Tool                 | Scope                                         | Target                             |
| ----------- | -------------------- | --------------------------------------------- | ---------------------------------- |
| Unit        | Vitest (node env)    | `engine/`, `lib/`, `storage/` pure parts      | **100% branches in engine**        |
| Data        | Vitest               | dictionary invariants                         | all lists                          |
| Component   | Vitest + RTL (jsdom) | Tile, Key, Board, Keyboard, modals            | behaviour, not markup              |
| Integration | Vitest + RTL         | full flows via `renderWithProviders`          | win, loss, restart, restore, reset |
| Manual      | Checklist            | Lighthouse, axe, real devices, screen readers | [`ACCEPTANCE.md`](./ACCEPTANCE.md) |

### Rules

1. **Engine first.** No UI work begins until the engine is green (TASKS Phase 2).
2. **Test behaviour through the DOM the user sees** — query by role/label, never by class or test id unless there is no accessible alternative.
3. **Determinism:** inject `seededRandom`, use fake timers for reveal/toast timing, use fixture dictionaries (≈20 words) in component tests — never the real lists.
4. **Storage tests** run against a mocked `localStorage` and must cover: happy path, corrupt JSON, wrong shape, quota throw, unavailable storage, migration chain.
5. **Accessibility assertions live in the component tests** (`getByRole`, `toHaveAccessibleName`), so a11y regressions fail CI rather than waiting for a manual audit.
6. No snapshot tests of whole components; they encode markup, not behaviour.

---

## 12. Extension Points (how V2/V3 land without a rewrite)

| Future feature                        | Seam that already exists                                                | Work required                                                                                                                                                                                                                                                  |
| ------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Daily challenge**                   | `RandomSource` injection + `pickAnswer`                                 | Inject `seededRandom(dateSeed)`; add a `mode` field to `GameState`; new provider prop. No engine rules change.                                                                                                                                                 |
| **Seeded / shareable games**          | Same PRNG, URL parse in `main.tsx`                                      | Read `?seed=` → seeded source.                                                                                                                                                                                                                                 |
| **Hard mode**                         | Validation is an injected predicate                                     | Add a `hardModeRule(previousGuesses)` composed into `validateGuess`. Reducer untouched.                                                                                                                                                                        |
| **Timed / survival modes**            | `startedAt`/`finishedAt` + monotonic `clock.ts`                         | New provider wrapping the same reducer; add statuses to the `GameStatus` union.                                                                                                                                                                                |
| **New word length (e.g. 7)**          | `WORD_LENGTHS` const + registry map                                     | Add two data modules + one registry entry + widen the tuple + one `HELP_EXAMPLES` entry, type-enforced (FR-29).                                                                                                                                                |
| **Per-length analytics / charts**     | `stats.perLength` is already recorded (FR-36)                           | Pure presentation layer.                                                                                                                                                                                                                                       |
| **Calendar heatmap / trends**         | `recentGames` carries `playedAt`                                        | Increase the retention cap; add a chart component.                                                                                                                                                                                                             |
| **Achievements**                      | Game completion is a single funnel (`recordGame`)                       | Subscribe an achievements evaluator to that call.                                                                                                                                                                                                              |
| **Sound effects**                     | Reveal/keypress already emit discrete events via the timeline hook      | Add an audio adapter listening to those events.                                                                                                                                                                                                                |
| **Themes**                            | Everything is a design token                                            | Add token sets keyed by `data-theme`.                                                                                                                                                                                                                          |
| **PWA**                               | No runtime network, all assets static                                   | Add `vite-plugin-pwa` + manifest + icons. Zero app-code change.                                                                                                                                                                                                |
| **Cloud sync (V3)**                   | Repository interface                                                    | Implement a remote `Repository<T>` with the same contract; swap at the provider.                                                                                                                                                                               |
| **i18n (V3)**                         | Dictionary registry is keyed data; UI strings centralised in one module | Key the registry by `locale + length`; add a string catalogue.                                                                                                                                                                                                 |
| **Another game**                      | Static game catalogue (ADR-028), `gameKeys(gameId)`, shared UI parts    | Widen the `GameId` union; add the game's own `engine/<id>/`, `state/<id>/` and `components/<id>/` folders, using `gameKeys` for storage; add one catalogue entry with a `React.lazy` view in the release that ships it. Home, routing and titles need no edit. |
| **`src/games/*` layout**              | Each game already has its own engine, state and component folders       | Move each game's `engine/<id>/`, `state/<id>/` and `components/<id>/` (and the Wordwright equivalents) under `src/games/<id>/`. A pure refactor: no behaviour change, only imports and the lint/coverage globs move.                                           |
| **WordWeaver daily / seeded puzzles** | `generatePuzzle` takes an injected `RandomSource`                       | Pass `seededRandom(seed)`. No rule change.                                                                                                                                                                                                                     |

**Anti-goal:** none of these get abstract base classes, plugin systems, or config flags in V1. The seams above are ordinary function parameters and data maps — the cheapest possible form of flexibility (ADR-005).

The same holds for the suite. Suite V1 names its two games in a closed union and picks one with a `switch` (ADR-021). From T-74 the shell reads a static catalogue instead (ADR-028), and that is still not a plugin system: entries are written in source, nothing registers at runtime, and the catalogue holds only a game's id, name, description, route and lazy view. There is no shared engine, reducer, provider, storage or statistics interface. Each game owns its own.

---

## 13. Performance Notes

- `React.memo` on `Tile` and `Key`; both take primitive props only.
- `deriveKeyStates` and board row slices are `useMemo`'d on `guesses`.
- Contexts are split per slice to bound re-render fan-out.
- Animations use `transform`/`opacity` only (compositor-friendly, no layout thrash).
- Dictionary chunks are lazy and cached; the 6-letter list never loads for a 4-letter player.
- Bundle budget NFR-1 checked with `vite build --report` / `rollup-plugin-visualizer` at the polish phase.

### 13.1 Suite and WordWeaver

- Home is in the entry bundle and loads no dictionary chunk (NFR-15, AC-24). In Suite V1 the two game views can stay in the entry bundle. From T-74 every game view is a `React.lazy` chunk (NFR-20, see §13.2).
- WordWeaver budget (NFR-13): graph build plus first puzzle ≤ 400 ms p95 for 5 letters under Lighthouse mobile CPU throttling, and each later puzzle ≤ 150 ms.
- Reference numbers on desktop Node, measured over the full guess list: 4 letters, graph build 7 ms and BFS about 6 ms; 5 letters, build 45 ms and BFS about 16 ms. The ladder list (1,400 and 5,000 words) is smaller than the guess list (6,142 and 13,746 words), so real costs are lower. T-72 checks the budget on a throttled production build (AC-37).
- **Measured (T-72), Chromium with 4x CPU throttling, 12 cold runs:** the first 5-letter puzzle, from the click to the rendered board and including the `lists-5` chunk load, is 153 ms p95 (budget 400 ms). Later puzzles are 19 ms p95 (budget 150 ms). No Web Worker is needed. Lighthouse mobile scores 100 / 100 / 100 / 100 on Home, WordWeaver and Wordwright.
- The graph is built once per length per session. Later puzzles cost one BFS each, plus retries when no end word falls in `PAR_BAND` (up to 20 starts, FR-78).
- **Fallback (NFR-13):** if the budget is missed, move graph build and generation into a Web Worker using Vite's built-in worker support, so no new dependency is added. The engine functions are pure and take data in, so they run in a worker unchanged. The provider shows the "Preparing puzzle…" skeleton while it waits (FR-96).
- WordWeaver tiles reuse `Tile`'s token classes and the same `React.memo` discipline. The rung area scrolls, so long ladders do not grow the page (FR-88).

### 13.2 Releases R2–R5

**Code splitting (NFR-20).**

- The entry bundle holds the shell, Home and the catalogue. Each game view, with its providers, engine and components, is its own chunk, loaded by `React.lazy` when its route opens (ADR-028). Shared parts (`Board`, `Keyboard`, `Modal`, the root engine) land in a shared chunk that Vite splits out.
- Home still triggers no dictionary request (NFR-15). A game's view chunk and its dictionary chunk load only on its route.
- T-74 checks the entry bundle size before and after the move, and each release task re-checks it against NFR-1.

**WordStack Quad render (NFR-21).** A Quad guess runs four `evaluateGuess` calls on 5 letters, which costs microseconds. The render budget is what matters:

- Quad shows 4 boards × 9 rows × 5 tiles = 180 tiles. `Board` and `Tile` are `React.memo`'d, and each board's rows are memoised on that board's guesses, so a guess re-renders only the four new rows and the input row.
- All boards reveal together (FR-105), so one `useRevealTimeline` drives every board, not one timeline per board.
- Per-board key states are memoised on each board's guesses. `SplitKey` takes primitive props (letter plus up to four states) and is `React.memo`'d, so only keys whose letters appear in the guess re-render.
- A solved board stops changing, so its `Board` skips re-rendering for the rest of the game.
- T-78 measures a Quad guess with the React Profiler under Lighthouse mobile CPU throttling against the 16 ms budget (NFR-3).

**Other games.** WordRange computes heat with two binary searches over 13,746 words per guess. WordShuffle builds its anagram index once per length, one sort of each word's letters (at most 24,637 words, for 6 letters). Neither is expected to need a worker; their engine tasks (T-80, T-88) confirm it.
