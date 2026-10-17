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
  buildPool,
  createHuntGame,
  createPuzzle,
  huntRecord,
  huntReducer,
  isGameOver,
  validateWord,
  type HuntSources,
  type HuntState,
} from '@/engine/hunt';
import { buildAnagramIndex, shuffleLetters } from '@/engine/shuffle';
import { now } from '@/lib/clock';
import { createHuntMetaRepository, createHuntSessionRepository, rememberHuntSeed } from '@/storage';

import { useToast } from '../contexts';
import { reportStorageIssue } from '../storageIssues';
import { outcomeAnnouncement, wordAnnouncement } from './announcements';
import { HuntContext, useHuntStats } from './huntContexts';

/** Status of the dictionary load, apart from the puzzle's own status. */
export type HuntDictionaryStatus = 'loading' | 'ready' | 'error';

/**
 * A polite live-region message. When the same text comes twice running, `flip`
 * alternates so the content differs and a screen reader reads it again.
 */
export interface HuntAnnouncement {
  readonly text: string;
  readonly flip: boolean;
}

export interface HuntContextValue {
  readonly state: HuntState;
  readonly dictionaryStatus: HuntDictionaryStatus;
  readonly isGameOver: boolean;
  readonly announcement: HuntAnnouncement;
  readonly addLetter: (letter: string) => void;
  readonly removeLetter: () => void;
  /** Returns false when the word was rejected, so the view can shake. */
  readonly submitWord: () => boolean;
  readonly reshuffle: () => void;
  readonly giveUp: () => void;
  readonly restart: () => void;
  readonly retryDictionary: () => void;
}

/** Session writes are debounced; keystrokes are far more frequent than reloads. */
const SESSION_WRITE_DEBOUNCE_MS = 150;

/** Everything a puzzle is drawn from, built once the three dictionaries have loaded. */
interface HuntWorld {
  readonly dictionaries: Readonly<Record<4 | 5 | 6, Dictionary>>;
  readonly sources: HuntSources;
  /** The seeds that make a good puzzle (FR-159). */
  readonly pool: readonly string[];
}

const worlds = new WeakMap<Dictionary, HuntWorld>();

/** The common words of a length: the answer list and the shuffle list (FR-159). */
function sourceOf(dictionary: Dictionary): HuntSources[4] {
  return {
    common: new Set([...dictionary.answers, ...(dictionary.shuffle ?? [])]),
    index: buildAnagramIndex(dictionary.guessList),
  };
}

/**
 * Builds the word sources and the seed pool, cached against the 6-letter
 * dictionary so a second visit in the same session does not repeat the work.
 */
function worldOf(dictionaries: Readonly<Record<4 | 5 | 6, Dictionary>>): HuntWorld {
  const cached = worlds.get(dictionaries[6]);
  if (cached) return cached;

  const sources: HuntSources = {
    4: sourceOf(dictionaries[4]),
    5: sourceOf(dictionaries[5]),
    6: sourceOf(dictionaries[6]),
  };
  const seeds = [...sources[6].common].sort();
  const world: HuntWorld = { dictionaries, sources, pool: buildPool(seeds, sources) };

  worlds.set(dictionaries[6], world);
  return world;
}

/** Placeholder until the dictionaries resolve and a real puzzle starts. */
function placeholderGame(): HuntState {
  return createHuntGame('pending', { seed: 'AAAAAA', tray: 'AAAAAA', required: [] });
}

/** True for a puzzle worth persisting: not the placeholder (FR-164). */
function isPersistable(state: HuntState): boolean {
  return state.id !== 'pending';
}

const REJECTION_TOAST = {
  'too-short': 'Not enough letters',
  'already-found': 'Already found',
  'not-a-word': 'Not in word list',
} as const;

export function HuntProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { show } = useToast();
  const { recordGame } = useHuntStats();

  // Per-game repositories (FR-67, FR-99), created once per provider instance.
  const [sessionRepo] = useState(() => createHuntSessionRepository(reportStorageIssue));
  const [metaRepo] = useState(() => createHuntMetaRepository(reportStorageIssue));

  const [dictionaryStatus, setDictionaryStatus] = useState<HuntDictionaryStatus>('loading');
  const [world, setWorld] = useState<HuntWorld | null>(null);
  const [announcement, setAnnouncement] = useState<HuntAnnouncement>({ text: '', flip: false });
  const [state, dispatch] = useReducer(huntReducer, undefined, placeholderGame);

  // Reload token: bumping it re-runs the dictionary effect for Retry (EC-14).
  const [loadToken, setLoadToken] = useState(0);

  const announce = useCallback((text: string): void => {
    setAnnouncement((previous) => ({
      text,
      flip: previous.text === text ? !previous.flip : false,
    }));
  }, []);

  /** Starts a fresh puzzle, drawing a seed that is not a recent one (FR-158). */
  const startFreshGame = useCallback(
    (loaded: HuntWorld): void => {
      const meta = metaRepo.read();
      const puzzle = createPuzzle(loaded.pool, loaded.sources, meta.recentAnswers, systemRandom);

      metaRepo.write(rememberHuntSeed(meta, puzzle.seed));
      dispatch({ type: 'START', id: crypto.randomUUID(), puzzle });
    },
    [metaRepo],
  );

  // Load the three dictionaries, then restore a saved puzzle or start a new one.
  useEffect(() => {
    let cancelled = false;

    Promise.all([loadDictionary(4), loadDictionary(5), loadDictionary(6)])
      .then(([four, five, six]) => {
        if (cancelled) return;

        const loaded = worldOf({ 4: four, 5: five, 6: six });
        setWorld(loaded);
        setDictionaryStatus('ready');

        // A saved puzzle carries its own words, so it restores whatever the lists now hold (FR-164).
        const saved = sessionRepo.read();
        if (saved) dispatch({ type: 'RESTORE', state: saved });
        else startFreshGame(loaded);
      })
      .catch(() => {
        if (cancelled) return;
        setDictionaryStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [loadToken, startFreshGame, sessionRepo]);

  // Persist the session (FR-164): debounced, plus a flush when the page is hidden.
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

  // Record a finished puzzle exactly once (FR-165).
  const recordedRef = useRef<string | null>(null);
  useEffect(() => {
    const record = huntRecord(state);
    if (!record || recordedRef.current === state.id) return;

    recordedRef.current = state.id;
    recordGame(record);
  }, [state, recordGame]);

  const addLetter = useCallback((letter: string): void => {
    dispatch({ type: 'ADD_LETTER', letter, now: now() });
  }, []);

  const removeLetter = useCallback((): void => {
    dispatch({ type: 'REMOVE_LETTER' });
  }, []);

  /**
   * Validates then submits (ARCHITECTURE §3.12). Validation lives here because
   * the engine may not depend on the dictionary (ADR-003). A rejected word
   * raises a toast and leaves the puzzle as it was (FR-161).
   */
  const submitWord = useCallback((): boolean => {
    if (!world || state.status !== 'playing') return false;

    const result = validateWord(state.currentInput, state, (word) =>
      world.dictionaries[word.length as 4 | 5 | 6].guesses.has(word),
    );

    if (!result.ok) {
      // A word the tray cannot spell is an engine guard: the UI never produces one, so it has no toast.
      if (result.error !== 'not-from-tray') show(REJECTION_TOAST[result.error], 'error');
      return false;
    }

    const action = { type: 'SUBMIT_WORD', word: result.value.word, now: now() } as const;
    const next = huntReducer(state, action);
    announce(
      isGameOver(next)
        ? outcomeAnnouncement(next)
        : wordAnnouncement(next, result.value.word, result.value.isRequired),
    );
    dispatch(action);
    return true;
  }, [world, state, show, announce]);

  const reshuffle = useCallback((): void => {
    dispatch({ type: 'RESHUFFLE', tray: shuffleLetters([...state.tray], systemRandom).join('') });
  }, [state.tray]);

  const giveUp = useCallback((): void => {
    const action = { type: 'GIVE_UP', now: now() } as const;
    const next = huntReducer(state, action);
    if (next === state) return;

    announce(outcomeAnnouncement(next));
    dispatch(action);
  }, [state, announce]);

  const restart = useCallback((): void => {
    if (!world) return;
    announce('New puzzle started.');
    startFreshGame(world);
  }, [world, startFreshGame, announce]);

  const retryDictionary = useCallback((): void => {
    setDictionaryStatus('loading');
    setLoadToken((token) => token + 1);
  }, []);

  const value = useMemo<HuntContextValue>(
    () => ({
      state,
      dictionaryStatus,
      isGameOver: isGameOver(state),
      announcement,
      addLetter,
      removeLetter,
      submitWord,
      reshuffle,
      giveUp,
      restart,
      retryDictionary,
    }),
    [
      state,
      dictionaryStatus,
      announcement,
      addLetter,
      removeLetter,
      submitWord,
      reshuffle,
      giveUp,
      restart,
      retryDictionary,
    ],
  );

  return <HuntContext.Provider value={value}>{children}</HuntContext.Provider>;
}
