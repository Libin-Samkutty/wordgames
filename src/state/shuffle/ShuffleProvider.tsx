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
import { systemRandom, type WordLength } from '@/engine';
import {
  anagramsOf,
  buildAnagramIndex,
  createPuzzle,
  createShuffleGame,
  isGameOver,
  shuffleLetters,
  shuffleRecord,
  shuffleReducer,
  validateAnswer,
  type AnagramIndex,
  type AnswerError,
  type ShuffleState,
} from '@/engine/shuffle';
import { now } from '@/lib/clock';
import {
  createShuffleMetaRepository,
  createShufflePrefsRepository,
  createShuffleSessionRepository,
  isShuffleSessionUsable,
  rememberShuffleAnswer,
} from '@/storage';

import { useToast } from '../contexts';
import { reportStorageIssue } from '../storageIssues';
import {
  giveUpAnnouncement,
  hintAnnouncement,
  reshuffleAnnouncement,
  solveAnnouncement,
} from './announcements';
import { ShuffleContext, useShuffleStats } from './shuffleContexts';

/** Status of the dictionary load, apart from the puzzle's own status. */
export type ShuffleDictionaryStatus = 'loading' | 'ready' | 'error';

/**
 * A polite live-region message. When the same text comes twice running, `flip`
 * alternates so the content differs and a screen reader reads it again.
 */
export interface ShuffleAnnouncement {
  readonly text: string;
  readonly flip: boolean;
}

export interface ShuffleContextValue {
  readonly state: ShuffleState;
  readonly length: WordLength;
  readonly dictionaryStatus: ShuffleDictionaryStatus;
  readonly isGameOver: boolean;
  readonly announcement: ShuffleAnnouncement;
  /** Typed on the keyboard or tapped in the tray (FR-139). */
  readonly addLetter: (letter: string) => void;
  readonly removeLetter: () => void;
  /** Returns false when the answer was rejected, so the view can shake. */
  readonly submitAnswer: () => boolean;
  readonly hint: () => void;
  readonly reshuffle: () => void;
  /** Ends the puzzle as given up; the view asks to confirm first (FR-144). */
  readonly giveUp: () => void;
  readonly restart: () => void;
  readonly setLength: (length: WordLength) => void;
  readonly retryDictionary: () => void;
}

/** Session writes are debounced; keystrokes are far more frequent than reloads. */
const SESSION_WRITE_DEBOUNCE_MS = 150;

/** The toast copy for a rejected answer. A moved hint has none (FR-140, EC-48). */
const ANSWER_ERROR_TOAST: Record<AnswerError, string | null> = {
  'too-short': 'Not enough letters',
  'hint-moved': null,
  'not-a-word': 'Not in word list',
};

/**
 * The anagram index per dictionary. The loader caches a `Dictionary` for the
 * session, so keying on it builds the index once per length and reuses it when
 * the player leaves and returns (ARCHITECTURE §8.5).
 */
const indexCache = new WeakMap<Dictionary, AnagramIndex>();

function anagramIndexFor(dictionary: Dictionary): AnagramIndex {
  let index = indexCache.get(dictionary);
  if (!index) {
    index = buildAnagramIndex(dictionary.guessList);
    indexCache.set(dictionary, index);
  }
  return index;
}

/** Placeholder until the dictionary resolves and a real puzzle starts. */
function placeholderGame(length: WordLength): ShuffleState {
  return createShuffleGame('pending', length, 'A'.repeat(length), 'A'.repeat(length));
}

/** True for a puzzle worth persisting: not the placeholder (FR-147). */
function isPersistable(state: ShuffleState): boolean {
  return state.id !== 'pending';
}

export function ShuffleProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { show } = useToast();
  const { recordGame } = useShuffleStats();

  // Per-game repositories (FR-67, FR-99), created once per provider instance.
  const [prefsRepo] = useState(() => createShufflePrefsRepository(reportStorageIssue));
  const [sessionRepo] = useState(() => createShuffleSessionRepository(reportStorageIssue));
  const [metaRepo] = useState(() => createShuffleMetaRepository(reportStorageIssue));

  const [length, setLengthState] = useState<WordLength>(() => prefsRepo.read().defaultWordLength);
  const [dictionaryStatus, setDictionaryStatus] = useState<ShuffleDictionaryStatus>('loading');
  const [dictionary, setDictionary] = useState<Dictionary | null>(null);
  const [announcement, setAnnouncement] = useState<ShuffleAnnouncement>({ text: '', flip: false });
  const [state, dispatch] = useReducer(shuffleReducer, length, placeholderGame);

  // Reload token: bumping it re-runs the dictionary effect for Retry (EC-14).
  const [loadToken, setLoadToken] = useState(0);

  const announce = useCallback((text: string): void => {
    setAnnouncement((previous) => ({
      text,
      flip: previous.text === text ? !previous.flip : false,
    }));
  }, []);

  /**
   * Starts a fresh puzzle, drawing a target that is not a recent one with a
   * scramble that is not a word (FR-138, EC-49). Returns false if no puzzle
   * could be made, which no shipped list produces.
   */
  const startFreshPuzzle = useCallback(
    (dict: Dictionary, forLength: WordLength): boolean => {
      const meta = metaRepo.read();
      const puzzle = createPuzzle(
        { answers: dict.answers, isWord: (word) => dict.guesses.has(word) },
        meta.recentAnswers[forLength],
        systemRandom,
      );
      if (!puzzle.ok) return false;

      metaRepo.write(rememberShuffleAnswer(meta, forLength, puzzle.value.target));
      dispatch({
        type: 'START',
        id: crypto.randomUUID(),
        wordLength: forLength,
        target: puzzle.value.target,
        scramble: puzzle.value.scramble,
      });
      return true;
    },
    [metaRepo],
  );

  // Load the dictionary, then restore a saved puzzle or start a new one.
  useEffect(() => {
    let cancelled = false;

    loadDictionary(length)
      .then((dict) => {
        if (cancelled) return;

        const answers = new Set(dict.answers);
        const saved = sessionRepo.read();

        if (
          saved?.wordLength === length &&
          isShuffleSessionUsable(saved, (word) => answers.has(word))
        ) {
          dispatch({ type: 'RESTORE', state: saved });
        } else if (!startFreshPuzzle(dict, length)) {
          setDictionaryStatus('error');
          return;
        }

        setDictionary(dict);
        setDictionaryStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setDictionaryStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [length, loadToken, startFreshPuzzle, sessionRepo]);

  // Persist the session (FR-147): debounced, plus a flush when the page is hidden.
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

  // Leaving the view must not lose the last letter or hint (FR-65, EC-24).
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

  // Record a finished puzzle exactly once (FR-146).
  const recordedRef = useRef<string | null>(null);
  useEffect(() => {
    const record = shuffleRecord(state);
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
   * Validates then submits (ARCHITECTURE §3.10). Validation lives here because
   * the engine may not depend on the dictionary (ADR-003). A rejected answer
   * raises a toast, except a moved hint, and has no other cost (FR-140).
   */
  const submitAnswer = useCallback((): boolean => {
    if (!dictionary || state.status !== 'playing') return false;

    const result = validateAnswer(state.slots, {
      target: state.target,
      hinted: state.hinted,
      isAllowed: (word) => dictionary.guesses.has(word),
    });

    if (!result.ok) {
      const message = ANSWER_ERROR_TOAST[result.error];
      if (message) show(message, 'error');
      return false;
    }

    const action = {
      type: 'SUBMIT_ANSWER',
      word: result.value,
      anagrams: anagramsOf(anagramIndexFor(dictionary), result.value),
      now: now(),
    } as const;
    // Score it once here to word the announcement, then let the reducer own the state.
    announce(solveAnnouncement(shuffleReducer(state, action)));
    dispatch(action);
    return true;
  }, [dictionary, state, show, announce]);

  const hint = useCallback((): void => {
    const action = { type: 'HINT', now: now() } as const;
    const next = shuffleReducer(state, action);
    // A hint that does nothing (none left, or the puzzle is over) is silent.
    if (next === state) return;

    announce(hintAnnouncement(next));
    dispatch(action);
  }, [state, announce]);

  const reshuffle = useCallback((): void => {
    const action = { type: 'RESHUFFLE', tray: shuffleLetters(state.tray, systemRandom) } as const;
    const next = shuffleReducer(state, action);
    if (next === state) return;

    announce(reshuffleAnnouncement(next));
    dispatch(action);
  }, [state, announce]);

  const giveUp = useCallback((): void => {
    if (!dictionary || state.status !== 'playing') return;

    const action = {
      type: 'GIVE_UP',
      anagrams: anagramsOf(anagramIndexFor(dictionary), state.target),
      now: now(),
    } as const;
    announce(giveUpAnnouncement(shuffleReducer(state, action)));
    dispatch(action);
  }, [dictionary, state, announce]);

  const restart = useCallback((): void => {
    if (!dictionary) return;
    announce('New puzzle started.');
    if (!startFreshPuzzle(dictionary, length)) setDictionaryStatus('error');
  }, [dictionary, length, startFreshPuzzle, announce]);

  const setLength = useCallback(
    (next: WordLength): void => {
      // Discard the old session immediately so a mid-load refresh cannot
      // restore a puzzle for the length we just left.
      sessionRepo.clear();
      setDictionaryStatus('loading');
      setLengthState(next);
      // Persist the choice so the next visit opens on it (FR-137).
      prefsRepo.write({ defaultWordLength: next });
    },
    [sessionRepo, prefsRepo],
  );

  const retryDictionary = useCallback((): void => {
    setDictionaryStatus('loading');
    setLoadToken((token) => token + 1);
  }, []);

  const value = useMemo<ShuffleContextValue>(
    () => ({
      state,
      length,
      dictionaryStatus,
      isGameOver: isGameOver(state),
      announcement,
      addLetter,
      removeLetter,
      submitAnswer,
      hint,
      reshuffle,
      giveUp,
      restart,
      setLength,
      retryDictionary,
    }),
    [
      state,
      length,
      dictionaryStatus,
      announcement,
      addLetter,
      removeLetter,
      submitAnswer,
      hint,
      reshuffle,
      giveUp,
      restart,
      setLength,
      retryDictionary,
    ],
  );

  return <ShuffleContext.Provider value={value}>{children}</ShuffleContext.Provider>;
}
