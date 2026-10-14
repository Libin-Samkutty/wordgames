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
import { systemRandom, validateGuess } from '@/engine';
import {
  STACK_LENGTH,
  STACK_MODES,
  boardKeyStates,
  createStackGame,
  isGameOver,
  pickAnswers,
  stackRecord,
  stackReducer,
  type StackMode,
  type StackState,
} from '@/engine/stack';
import { now } from '@/lib/clock';
import {
  createStackMetaRepository,
  createStackPrefsRepository,
  createStackSessionRepository,
  isStackSessionUsable,
  rememberStackAnswers,
} from '@/storage';
import type { LetterState } from '@/engine';

import { useToast } from '../contexts';
import { reportStorageIssue } from '../storageIssues';
import { guessAnnouncement, outcomeAnnouncement } from './announcements';
import { StackContext, useStackStats } from './stackContexts';

/** Status of the dictionary load, apart from the game's own status. */
export type StackDictionaryStatus = 'loading' | 'ready' | 'error';

/**
 * A polite live-region message. When the same text comes twice running, `flip`
 * alternates so the content differs and a screen reader reads it again.
 */
export interface StackAnnouncement {
  readonly text: string;
  readonly flip: boolean;
}

export interface StackContextValue {
  readonly state: StackState;
  readonly mode: StackMode;
  /** One map per board, `null` for a solved board (FR-109). */
  readonly keyStates: readonly (ReadonlyMap<string, LetterState> | null)[];
  readonly dictionaryStatus: StackDictionaryStatus;
  /** True while a row is flipping on every board; input is locked (FR-105). */
  readonly isRevealing: boolean;
  readonly isGameOver: boolean;
  readonly announcement: StackAnnouncement;
  readonly addLetter: (letter: string) => void;
  readonly removeLetter: () => void;
  /** Returns false when the guess was rejected, so the view can shake. */
  readonly submitGuess: () => boolean;
  /** Called by the reveal animation when the flip finishes. */
  readonly completeReveal: () => void;
  readonly restart: () => void;
  readonly setMode: (mode: StackMode) => void;
  readonly retryDictionary: () => void;
}

/** Session writes are debounced; keystrokes are far more frequent than reloads. */
const SESSION_WRITE_DEBOUNCE_MS = 150;

/** Placeholder until the dictionary resolves and a real game starts. */
function placeholderGame(mode: StackMode): StackState {
  return createStackGame(
    'pending',
    mode,
    Array.from({ length: STACK_MODES[mode].boards }, () => 'PENDING'.slice(0, STACK_LENGTH)),
  );
}

/** True for a game worth persisting: not the placeholder (FR-112). */
function isPersistable(state: StackState): boolean {
  return state.id !== 'pending';
}

export function StackProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { show } = useToast();
  const { recordGame } = useStackStats();

  // Per-game repositories (FR-67, FR-99), created once per provider instance.
  const [prefsRepo] = useState(() => createStackPrefsRepository(reportStorageIssue));
  const [sessionRepo] = useState(() => createStackSessionRepository(reportStorageIssue));
  const [metaRepo] = useState(() => createStackMetaRepository(reportStorageIssue));

  const [mode, setModeState] = useState<StackMode>(() => prefsRepo.read().mode);
  const [dictionaryStatus, setDictionaryStatus] = useState<StackDictionaryStatus>('loading');
  const [dictionary, setDictionary] = useState<Dictionary | null>(null);
  const [announcement, setAnnouncement] = useState<StackAnnouncement>({ text: '', flip: false });
  const [state, dispatch] = useReducer(stackReducer, mode, placeholderGame);

  // Reload token: bumping it re-runs the dictionary effect for Retry (EC-14).
  const [loadToken, setLoadToken] = useState(0);

  const announce = useCallback((text: string): void => {
    setAnnouncement((previous) => ({
      text,
      flip: previous.text === text ? !previous.flip : false,
    }));
  }, []);

  /** Starts a fresh game, drawing different answers and remembering them (FR-103). */
  const startFreshGame = useCallback(
    (dict: Dictionary, forMode: StackMode): void => {
      const meta = metaRepo.read();
      const answers = pickAnswers(
        dict.answers,
        meta.recentAnswers,
        STACK_MODES[forMode].boards,
        systemRandom,
      );

      metaRepo.write(rememberStackAnswers(meta, answers));
      dispatch({ type: 'START', id: crypto.randomUUID(), mode: forMode, answers });
    },
    [metaRepo],
  );

  // Load the dictionary, then restore a saved game or start a new one.
  useEffect(() => {
    let cancelled = false;

    loadDictionary(STACK_LENGTH)
      .then((dict) => {
        if (cancelled) return;

        setDictionary(dict);
        setDictionaryStatus('ready');

        const answers = new Set(dict.answers);
        const saved = sessionRepo.read();

        if (saved?.mode === mode && isStackSessionUsable(saved, (word) => answers.has(word))) {
          dispatch({ type: 'RESTORE', state: saved });
          // A reload mid-reveal cannot resume the animation: settle it so the
          // rows show revealed, and a winning guess is recorded as the win.
          if (saved.status === 'revealing') dispatch({ type: 'REVEAL_COMPLETE', now: now() });
        } else {
          startFreshGame(dict, mode);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setDictionaryStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [mode, loadToken, startFreshGame, sessionRepo]);

  // Persist the session (FR-112): debounced, plus a flush when the page is hidden.
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

  // Record a finished game exactly once (FR-111).
  const recordedRef = useRef<string | null>(null);
  useEffect(() => {
    const record = stackRecord(state);
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
   * Validates then submits (ARCHITECTURE §3.7). Validation lives here because
   * the engine may not depend on the dictionary (ADR-003). A rejected guess
   * raises a toast and costs no turn on any board (FR-104).
   */
  const submitGuess = useCallback((): boolean => {
    if (!dictionary || state.status !== 'playing') return false;

    const result = validateGuess(state.currentInput, STACK_LENGTH, (word) =>
      dictionary.guesses.has(word),
    );

    if (!result.ok) {
      show(result.error === 'too-short' ? 'Not enough letters' : 'Not in word list', 'error');
      return false;
    }

    const action = { type: 'SUBMIT_GUESS', word: result.value, now: now() } as const;
    // Score it once here to word the announcement, then let the reducer own the state.
    announce(guessAnnouncement(stackReducer(state, action)));
    dispatch(action);
    return true;
  }, [dictionary, state, show, announce]);

  const completeReveal = useCallback((): void => {
    const next = stackReducer(state, { type: 'REVEAL_COMPLETE', now: now() });
    if (isGameOver(next) && !isGameOver(state)) announce(outcomeAnnouncement(next));
    dispatch({ type: 'REVEAL_COMPLETE', now: now() });
  }, [state, announce]);

  const restart = useCallback((): void => {
    if (!dictionary) return;
    announce('New game started.');
    startFreshGame(dictionary, mode);
  }, [dictionary, mode, startFreshGame, announce]);

  const setMode = useCallback(
    (next: StackMode): void => {
      // Discard the old session immediately so a mid-load refresh cannot
      // restore a game for the mode we just left.
      sessionRepo.clear();
      setModeState(next);
      // Persist the choice so the next visit opens on it (FR-102).
      prefsRepo.write({ mode: next });
    },
    [sessionRepo, prefsRepo],
  );

  const retryDictionary = useCallback((): void => {
    setDictionaryStatus('loading');
    setLoadToken((token) => token + 1);
  }, []);

  const keyStates = useMemo(() => boardKeyStates(state), [state]);

  const value = useMemo<StackContextValue>(
    () => ({
      state,
      mode,
      keyStates,
      dictionaryStatus,
      isRevealing: state.status === 'revealing',
      isGameOver: isGameOver(state),
      announcement,
      addLetter,
      removeLetter,
      submitGuess,
      completeReveal,
      restart,
      setMode,
      retryDictionary,
    }),
    [
      state,
      mode,
      keyStates,
      dictionaryStatus,
      announcement,
      addLetter,
      removeLetter,
      submitGuess,
      completeReveal,
      restart,
      setMode,
      retryDictionary,
    ],
  );

  return <StackContext.Provider value={value}>{children}</StackContext.Provider>;
}
