import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { loadDictionary, type Dictionary } from '@/dictionary';
import { systemRandom } from '@/engine';
import {
  MAX_MOVES,
  buildLadderGraph,
  canUndo,
  createWeaverGame,
  evaluateRung,
  generatePuzzle,
  isGameOver,
  ladderRows,
  moveLimitReached,
  previousWord,
  resultSummary,
  shortestLadder,
  usedWords,
  validateRung,
  weaverRecord,
  weaverReducer,
  type LadderGraph,
  type LadderRowView,
  type ResultSummary,
  type RungError,
  type WeaverLength,
  type WeaverState,
} from '@/engine/weaver';
import { now } from '@/lib/clock';
import {
  createWeaverMetaRepository,
  createWeaverPrefsRepository,
  createWeaverSessionRepository,
  isWeaverSessionUsable,
  rememberStart,
} from '@/storage';

import { useToast } from '../contexts';
import { reportStorageIssue } from '../storageIssues';
import { WeaverContext, useWeaverStats } from './weaverContexts';

/** Status of the dictionary load and graph build, apart from the puzzle's own status. */
export type WeaverDictionaryStatus = 'loading' | 'ready' | 'error';

/**
 * A polite live-region message. Screen readers announce a change in the
 * region's content, so when the same text comes twice running, `flip` alternates
 * to make the content differ and the repeat is read again.
 */
export interface WeaverAnnouncement {
  readonly text: string;
  readonly flip: boolean;
}

export interface WeaverContextValue {
  readonly state: WeaverState;
  readonly rows: readonly LadderRowView[];
  readonly summary: ResultSummary;
  readonly length: WeaverLength;
  readonly dictionaryStatus: WeaverDictionaryStatus;
  /** True when no puzzle could be generated (EC-32). */
  readonly generationFailed: boolean;
  /** True while a rung is flipping; input is locked (FR-89). */
  readonly isRevealing: boolean;
  readonly isGameOver: boolean;
  readonly canUndo: boolean;
  readonly moveLimitReached: boolean;
  /** Latest polite announcement for the live region (A11Y-17). */
  readonly announcement: WeaverAnnouncement;
  readonly addLetter: (letter: string) => void;
  /** Removes a typed letter; on an empty row, undoes the last rung (FR-83). */
  readonly removeLetter: () => void;
  /** Returns false when the rung was rejected, so the view can shake. */
  readonly submitRung: () => boolean;
  readonly undo: () => void;
  readonly giveUp: () => void;
  readonly newPuzzle: () => void;
  /** Called by the reveal animation when the flip finishes. */
  readonly completeReveal: () => void;
  readonly setLength: (length: WeaverLength) => void;
  /** Retries a failed dictionary load or a failed puzzle generation. */
  readonly retry: () => void;
}

/** The toast copy for each rejected rung, in FR-80 order. */
const RUNG_ERROR_TOAST: Record<RungError, string> = {
  'too-short': 'Not enough letters',
  'not-a-word': 'Not in word list',
  'not-one-letter': 'Change exactly one letter',
  'already-used': 'Already used',
};

/** Session writes are debounced; keystrokes are far more frequent than reloads. */
const SESSION_WRITE_DEBOUNCE_MS = 150;

/** What a loaded length needs to generate and play puzzles. */
interface Resources {
  readonly dictionary: Dictionary;
  readonly graph: LadderGraph;
  readonly answers: ReadonlySet<string>;
  readonly length: WeaverLength;
}

/**
 * The ladder graph is built once per ladder list and kept for the session
 * (ARCHITECTURE §3.6). Keyed by the list itself, so a new dictionary object
 * with the same list, as in tests, still reuses it.
 */
const graphCache = new WeakMap<readonly string[], LadderGraph>();

function graphFor(ladder: readonly string[]): LadderGraph {
  let graph = graphCache.get(ladder);
  if (!graph) {
    graph = buildLadderGraph(ladder);
    graphCache.set(ladder, graph);
  }
  return graph;
}

/** Placeholder until a dictionary resolves and a real puzzle starts. */
function placeholderPuzzle(length: WeaverLength): WeaverState {
  return createWeaverGame('pending', { length, start: '', end: '', par: 0 });
}

/** True for a puzzle worth persisting: not the placeholder (FR-93). */
function isPersistable(state: WeaverState): boolean {
  return state.id !== 'pending';
}

function movesLabel(moves: number): string {
  return `${String(moves)} ${moves === 1 ? 'move' : 'moves'}`;
}

export function WeaverProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { show } = useToast();
  const { recordGame } = useWeaverStats();

  // Per-game repositories (FR-67, FR-68), created once per provider instance.
  const [prefsRepo] = useState(() => createWeaverPrefsRepository(reportStorageIssue));
  const [sessionRepo] = useState(() => createWeaverSessionRepository(reportStorageIssue));
  const [metaRepo] = useState(() => createWeaverMetaRepository(reportStorageIssue));

  const [length, setLengthState] = useState<WeaverLength>(() => prefsRepo.read().defaultWordLength);
  const [dictionaryStatus, setDictionaryStatus] = useState<WeaverDictionaryStatus>('loading');
  const [generationFailed, setGenerationFailed] = useState(false);
  const [resources, setResources] = useState<Resources | null>(null);
  const [announcement, setAnnouncement] = useState<WeaverAnnouncement>({ text: '', flip: false });
  const [state, dispatch] = useReducer(weaverReducer, length, placeholderPuzzle);

  // Reload token: bumping it re-runs the dictionary effect for Retry (EC-14).
  const [loadToken, setLoadToken] = useState(0);

  const announce = useCallback((text: string): void => {
    setAnnouncement((previous) => ({
      text,
      flip: previous.text === text ? !previous.flip : false,
    }));
  }, []);

  /** Starts a fresh puzzle, remembering its start (FR-78). Returns false on failure (EC-32). */
  const startFreshPuzzle = useCallback(
    (loaded: Resources): void => {
      const meta = metaRepo.read();
      const result = generatePuzzle({
        length: loaded.length,
        graph: loaded.graph,
        answers: loaded.dictionary.answers,
        recentStarts: meta.recentStarts[loaded.length],
        random: systemRandom,
      });

      if (!result.ok) {
        setGenerationFailed(true);
        return;
      }

      setGenerationFailed(false);
      metaRepo.write(rememberStart(meta, loaded.length, result.value.start));
      dispatch({ type: 'NEW_PUZZLE', id: crypto.randomUUID(), puzzle: result.value });
    },
    [metaRepo],
  );

  // Load the dictionary for the active length, build the graph, then restore or start.
  useEffect(() => {
    let cancelled = false;

    loadDictionary(length)
      .then((dictionary) => {
        // The player switched length while this was in flight; drop the result.
        if (cancelled) return;

        const loaded: Resources = {
          dictionary,
          // The ladder list rides in the 4 and 5-letter chunks (FR-75). The
          // fallback only matters for hand-built dictionaries without one.
          graph: graphFor(dictionary.ladder ?? dictionary.answers),
          answers: new Set(dictionary.answers),
          length,
        };
        setResources(loaded);
        setDictionaryStatus('ready');

        const saved = sessionRepo.read();
        if (
          isWeaverSessionUsable(
            saved,
            length,
            (word) => loaded.answers.has(word),
            (word) => dictionary.guesses.has(word),
          )
        ) {
          dispatch({ type: 'RESTORE', state: saved });
          // A reload mid-reveal cannot resume the animation: settle the row so
          // it shows revealed, and a winning rung is recorded as the solve (EC-23).
          if (saved.status === 'revealing') dispatch({ type: 'REVEAL_COMPLETE', now: now() });
        } else {
          startFreshPuzzle(loaded);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setDictionaryStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [length, loadToken, startFreshPuzzle, sessionRepo]);

  /*
   * Persist the session (FR-93): debounced, plus a synchronous flush when the
   * page is hidden. The unmount flush is the effect below.
   */
  useEffect(() => {
    if (!isPersistable(state)) return;

    const write = (): void => {
      sessionRepo.write(state);
    };

    const timer = setTimeout(write, SESSION_WRITE_DEBOUNCE_MS);
    window.addEventListener('pagehide', write);
    document.addEventListener('visibilitychange', write);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('pagehide', write);
      document.removeEventListener('visibilitychange', write);
    };
  }, [state, sessionRepo]);

  // Leaving the view must not lose the last keystroke (FR-65, EC-24).
  const latestStateRef = useRef(state);
  useEffect(() => {
    latestStateRef.current = state;
  }, [state]);

  useEffect(
    () => () => {
      if (isPersistable(latestStateRef.current)) sessionRepo.write(latestStateRef.current);
    },
    [sessionRepo],
  );

  // Record a finished puzzle exactly once (FR-92).
  const recordedRef = useRef<string | null>(null);
  useEffect(() => {
    const record = weaverRecord(state);
    if (!record || recordedRef.current === state.id) return;

    recordedRef.current = state.id;
    recordGame(record);
  }, [state, recordGame]);

  const addLetter = useCallback(
    (letter: string): void => {
      if (state.status === 'playing' && moveLimitReached(state)) {
        show('Move limit reached', 'error');
        return;
      }
      dispatch({ type: 'ADD_LETTER', letter, now: now() });
    },
    [state, show],
  );

  const removeLetter = useCallback((): void => {
    dispatch({ type: 'REMOVE_LETTER' });
  }, []);

  /**
   * Validates then submits (ARCHITECTURE §3.6).
   *
   * Validation lives here rather than in the reducer because the engine may
   * not depend on the dictionary (ADR-003). A rejected rung raises a toast and
   * is not a move.
   */
  const submitRung = useCallback((): boolean => {
    if (!resources || state.status !== 'playing') return false;

    if (moveLimitReached(state)) {
      show('Move limit reached', 'error');
      return false;
    }

    const result = validateRung(state.currentInput, {
      length: state.length,
      previous: previousWord(state),
      used: usedWords(state),
      isAllowed: (word) => resources.dictionary.guesses.has(word),
    });

    if (!result.ok) {
      show(RUNG_ERROR_TOAST[result.error], 'error');
      return false;
    }

    const matches = evaluateRung(result.value, state.end).filter(
      (letter) => letter === 'correct',
    ).length;
    dispatch({ type: 'SUBMIT_RUNG', word: result.value, now: now() });
    announce(`${result.value}: ${String(matches)} of ${String(state.length)} letters match`);
    return true;
  }, [resources, state, show, announce]);

  const undo = useCallback((): void => {
    if (!canUndo(state)) return;

    const removed = state.rungs[state.rungs.length - 1];
    dispatch({ type: 'UNDO' });
    if (removed) announce(`Removed ${removed.word}`);
  }, [state, announce]);

  const giveUp = useCallback((): void => {
    if (!resources || state.status !== 'playing') return;

    const ladder = shortestLadder(
      resources.graph,
      state.start,
      state.end,
      resources.dictionary.answers,
    ) ?? [state.start, state.end];

    dispatch({ type: 'GIVE_UP', ladder, now: now() });
    announce(`Gave up. One shortest ladder: ${ladder.join(', ')}`);
  }, [resources, state, announce]);

  const newPuzzle = useCallback((): void => {
    if (!resources) return;
    announce('New puzzle started.');
    startFreshPuzzle(resources);
  }, [resources, startFreshPuzzle, announce]);

  const completeReveal = useCallback((): void => {
    // The reveal is what turns the end word into a solve (FR-82), so this is
    // the moment to announce it (A11Y-17). Give up announces itself.
    const last = state.rungs[state.rungs.length - 1];
    if (state.status === 'revealing' && last?.word === state.end) {
      announce(`Solved in ${movesLabel(state.moves)}. Par ${String(state.par)}.`);
    }
    dispatch({ type: 'REVEAL_COMPLETE', now: now() });
  }, [state, announce]);

  const setLength = useCallback(
    (next: WeaverLength): void => {
      // Discard the old session immediately so a mid-load refresh cannot
      // restore a puzzle for the length we just left.
      sessionRepo.clear();
      setGenerationFailed(false);
      setDictionaryStatus('loading');
      setLengthState(next);
      // Persist the choice so the next visit opens on it (FR-74).
      prefsRepo.write({ defaultWordLength: next });
    },
    [sessionRepo, prefsRepo],
  );

  const retry = useCallback((): void => {
    if (dictionaryStatus === 'error') {
      setDictionaryStatus('loading');
      setLoadToken((token) => token + 1);
    } else if (resources) {
      startFreshPuzzle(resources);
    }
  }, [dictionaryStatus, resources, startFreshPuzzle]);

  const rows = useMemo(() => ladderRows(state), [state]);
  const summary = useMemo(() => resultSummary(state), [state]);

  const value = useMemo<WeaverContextValue>(
    () => ({
      state,
      rows,
      summary,
      length,
      dictionaryStatus,
      generationFailed,
      isRevealing: state.status === 'revealing',
      isGameOver: isGameOver(state),
      canUndo: canUndo(state),
      moveLimitReached: state.moves >= MAX_MOVES,
      announcement,
      addLetter,
      removeLetter,
      submitRung,
      undo,
      giveUp,
      newPuzzle,
      completeReveal,
      setLength,
      retry,
    }),
    [
      state,
      rows,
      summary,
      length,
      dictionaryStatus,
      generationFailed,
      announcement,
      addLetter,
      removeLetter,
      submitRung,
      undo,
      giveUp,
      newPuzzle,
      completeReveal,
      setLength,
      retry,
    ],
  );

  return <WeaverContext.Provider value={value}>{children}</WeaverContext.Provider>;
}
