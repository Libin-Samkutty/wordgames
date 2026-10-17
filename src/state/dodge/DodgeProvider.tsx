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
import {
  deriveKeyStates,
  validateGuess,
  type LetterState,
  type RowView,
  type WordLength,
} from '@/engine';
import {
  createDodgeGame,
  dodgeReducer,
  dodgeRecord,
  dodgeRows,
  dodgeSession,
  isGameOver,
  restoreGame,
  wordsLeft,
  type DodgeState,
} from '@/engine/dodge';
import { now } from '@/lib/clock';
import { createDodgePrefsRepository, createDodgeSessionRepository } from '@/storage';

import { useToast } from '../contexts';
import { reportStorageIssue } from '../storageIssues';
import { guessAnnouncement, outcomeAnnouncement } from './announcements';
import { DodgeContext, useDodgeStats } from './dodgeContexts';

/** Status of the dictionary load, apart from the game's own status. */
export type DodgeDictionaryStatus = 'loading' | 'ready' | 'error';

/**
 * A polite live-region message. When the same text comes twice running, `flip`
 * alternates so the content differs and a screen reader reads it again.
 */
export interface DodgeAnnouncement {
  readonly text: string;
  readonly flip: boolean;
}

export interface DodgeContextValue {
  readonly state: DodgeState;
  readonly rows: readonly RowView[];
  readonly keyStates: ReadonlyMap<string, LetterState>;
  readonly length: WordLength;
  readonly dictionaryStatus: DodgeDictionaryStatus;
  /** True while a row is flipping; input is locked (FR-11). */
  readonly isRevealing: boolean;
  readonly isGameOver: boolean;
  /** How many answers the game has left to choose from (FR-150). */
  readonly wordsLeft: number;
  readonly announcement: DodgeAnnouncement;
  readonly addLetter: (letter: string) => void;
  readonly removeLetter: () => void;
  /** Returns false when the guess was rejected, so the view can shake. */
  readonly submitGuess: () => boolean;
  /** Called by the reveal animation when the flip finishes. */
  readonly completeReveal: () => void;
  readonly giveUp: () => void;
  readonly restart: () => void;
  readonly setLength: (length: WordLength) => void;
  readonly retryDictionary: () => void;
}

/** Session writes are debounced; keystrokes are far more frequent than reloads. */
const SESSION_WRITE_DEBOUNCE_MS = 150;

/** Placeholder until the dictionary resolves and a real game starts. */
function placeholderGame(length: WordLength): DodgeState {
  return createDodgeGame('pending', length, []);
}

/**
 * True for a game worth persisting: not the placeholder, and not mid-reveal. A
 * reload during a reveal keeps the game as it was before that guess (FR-153).
 */
function isPersistable(state: DodgeState): boolean {
  return state.id !== 'pending' && state.status !== 'revealing';
}

export function DodgeProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { show } = useToast();
  const { recordGame } = useDodgeStats();

  // Per-game repositories (FR-67, FR-99), created once per provider instance.
  const [prefsRepo] = useState(() => createDodgePrefsRepository(reportStorageIssue));
  const [sessionRepo] = useState(() => createDodgeSessionRepository(reportStorageIssue));

  const [length, setLengthState] = useState<WordLength>(() => prefsRepo.read().defaultWordLength);
  const [dictionaryStatus, setDictionaryStatus] = useState<DodgeDictionaryStatus>('loading');
  const [dictionary, setDictionary] = useState<Dictionary | null>(null);
  const [announcement, setAnnouncement] = useState<DodgeAnnouncement>({ text: '', flip: false });
  const [state, dispatch] = useReducer(dodgeReducer, length, placeholderGame);

  // Reload token: bumping it re-runs the dictionary effect for Retry (EC-14).
  const [loadToken, setLoadToken] = useState(0);

  const announce = useCallback((text: string): void => {
    setAnnouncement((previous) => ({
      text,
      flip: previous.text === text ? !previous.flip : false,
    }));
  }, []);

  /** Starts a fresh game: every answer is possible, so no word is drawn (FR-149). */
  const startFreshGame = useCallback((dict: Dictionary, forLength: WordLength): void => {
    dispatch({
      type: 'START',
      id: crypto.randomUUID(),
      wordLength: forLength,
      answers: dict.answers,
    });
  }, []);

  // Load the dictionary, then restore a saved game or start a new one.
  useEffect(() => {
    let cancelled = false;

    loadDictionary(length)
      .then((dict) => {
        if (cancelled) return;

        setDictionary(dict);
        setDictionaryStatus('ready');

        const saved = sessionRepo.read();
        // A saved game that no longer replays against the answers is dropped (FR-153).
        const restored = saved?.wordLength === length ? restoreGame(saved, dict.answers) : null;

        if (restored) dispatch({ type: 'RESTORE', state: restored });
        else startFreshGame(dict, length);
      })
      .catch(() => {
        if (cancelled) return;
        setDictionaryStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [length, loadToken, startFreshGame, sessionRepo]);

  // Persist the session (FR-153): debounced, plus a flush when the page is hidden.
  useEffect(() => {
    if (!isPersistable(state)) return;

    const write = (): void => {
      sessionRepo.write(dodgeSession(state));
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
      if (isPersistable(latestStateRef.current)) {
        sessionRepo.write(dodgeSession(latestStateRef.current));
      }
    },
    [sessionRepo],
  );

  // Record a finished game exactly once (FR-155).
  const recordedRef = useRef<string | null>(null);
  useEffect(() => {
    const record = dodgeRecord(state);
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
   * Validates then submits (ARCHITECTURE §3.11). Validation lives here because
   * the engine may not depend on the dictionary (ADR-003). A rejected guess
   * raises a toast and leaves the game as it was (FR-149).
   */
  const submitGuess = useCallback((): boolean => {
    if (!dictionary || state.status !== 'playing') return false;

    const result = validateGuess(state.currentInput, state.wordLength, (word) =>
      dictionary.guesses.has(word),
    );

    if (!result.ok) {
      show(result.error === 'too-short' ? 'Not enough letters' : 'Not in word list', 'error');
      return false;
    }

    dispatch({ type: 'SUBMIT_GUESS', word: result.value, now: now() });
    return true;
  }, [dictionary, state.currentInput, state.status, state.wordLength, show]);

  /**
   * The flip has finished: say what the guess scored, or how the game ended.
   * Announcing here, not on submit, keeps the result hidden until it is seen (FR-52).
   */
  const completeReveal = useCallback((): void => {
    const action = { type: 'REVEAL_COMPLETE', now: now() } as const;
    const next = dodgeReducer(state, action);
    announce(isGameOver(next) ? outcomeAnnouncement(next) : guessAnnouncement(next));
    dispatch(action);
  }, [state, announce]);

  const giveUp = useCallback((): void => {
    const action = { type: 'GIVE_UP', now: now() } as const;
    const next = dodgeReducer(state, action);
    if (next === state) return;

    announce(outcomeAnnouncement(next));
    dispatch(action);
  }, [state, announce]);

  const restart = useCallback((): void => {
    if (!dictionary) return;
    announce('New game started.');
    startFreshGame(dictionary, length);
  }, [dictionary, length, startFreshGame, announce]);

  const setLength = useCallback(
    (next: WordLength): void => {
      // Discard the old session immediately so a mid-load refresh cannot
      // restore a game for the length we just left.
      sessionRepo.clear();
      setDictionaryStatus('loading');
      setLengthState(next);
      // Persist the choice so the next visit opens on it (FR-148).
      prefsRepo.write({ defaultWordLength: next });
    },
    [sessionRepo, prefsRepo],
  );

  const retryDictionary = useCallback((): void => {
    setDictionaryStatus('loading');
    setLoadToken((token) => token + 1);
  }, []);

  const rows = useMemo(() => dodgeRows(state), [state]);
  const keyStates = useMemo(() => deriveKeyStates(state.guesses), [state.guesses]);

  const value = useMemo<DodgeContextValue>(
    () => ({
      state,
      rows,
      keyStates,
      length,
      dictionaryStatus,
      isRevealing: state.status === 'revealing',
      isGameOver: isGameOver(state),
      wordsLeft: wordsLeft(state),
      announcement,
      addLetter,
      removeLetter,
      submitGuess,
      completeReveal,
      giveUp,
      restart,
      setLength,
      retryDictionary,
    }),
    [
      state,
      rows,
      keyStates,
      length,
      dictionaryStatus,
      announcement,
      addLetter,
      removeLetter,
      submitGuess,
      completeReveal,
      giveUp,
      restart,
      setLength,
      retryDictionary,
    ],
  );

  return <DodgeContext.Provider value={value}>{children}</DodgeContext.Provider>;
}
