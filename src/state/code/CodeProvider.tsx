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
import { pickAnswer, systemRandom, validateGuess, type WordLength } from '@/engine';
import { codeRecord, codeReducer, createCodeGame, isGameOver, type CodeState } from '@/engine/code';
import { now } from '@/lib/clock';
import {
  createCodeMetaRepository,
  createCodePrefsRepository,
  createCodeSessionRepository,
  isCodeSessionUsable,
  rememberCodeAnswer,
} from '@/storage';

import { useToast } from '../contexts';
import { reportStorageIssue } from '../storageIssues';
import { guessAnnouncement, outcomeAnnouncement } from './announcements';
import { CodeContext, useCodeStats } from './codeContexts';

/** Status of the dictionary load, apart from the game's own status. */
export type CodeDictionaryStatus = 'loading' | 'ready' | 'error';

/**
 * A polite live-region message. When the same text comes twice running, `flip`
 * alternates so the content differs and a screen reader reads it again.
 */
export interface CodeAnnouncement {
  readonly text: string;
  readonly flip: boolean;
}

export interface CodeContextValue {
  readonly state: CodeState;
  readonly length: WordLength;
  readonly dictionaryStatus: CodeDictionaryStatus;
  readonly isGameOver: boolean;
  readonly announcement: CodeAnnouncement;
  readonly addLetter: (letter: string) => void;
  readonly removeLetter: () => void;
  /** Returns false when the guess was rejected, so the view can shake. */
  readonly submitGuess: () => boolean;
  /** Moves a letter to its next note mark (FR-132). */
  readonly cycleNote: (letter: string) => void;
  readonly restart: () => void;
  readonly setLength: (length: WordLength) => void;
  readonly retryDictionary: () => void;
}

/** Session writes are debounced; keystrokes are far more frequent than reloads. */
const SESSION_WRITE_DEBOUNCE_MS = 150;

/** Placeholder until the dictionary resolves and a real game starts. */
function placeholderGame(length: WordLength): CodeState {
  return createCodeGame('pending', length, 'A'.repeat(length));
}

/** True for a game worth persisting: not the placeholder (FR-135). */
function isPersistable(state: CodeState): boolean {
  return state.id !== 'pending';
}

export function CodeProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { show } = useToast();
  const { recordGame } = useCodeStats();

  // Per-game repositories (FR-67, FR-99), created once per provider instance.
  const [prefsRepo] = useState(() => createCodePrefsRepository(reportStorageIssue));
  const [sessionRepo] = useState(() => createCodeSessionRepository(reportStorageIssue));
  const [metaRepo] = useState(() => createCodeMetaRepository(reportStorageIssue));

  const [length, setLengthState] = useState<WordLength>(() => prefsRepo.read().defaultWordLength);
  const [dictionaryStatus, setDictionaryStatus] = useState<CodeDictionaryStatus>('loading');
  const [dictionary, setDictionary] = useState<Dictionary | null>(null);
  const [announcement, setAnnouncement] = useState<CodeAnnouncement>({ text: '', flip: false });
  const [state, dispatch] = useReducer(codeReducer, length, placeholderGame);

  // Reload token: bumping it re-runs the dictionary effect for Retry (EC-14).
  const [loadToken, setLoadToken] = useState(0);

  const announce = useCallback((text: string): void => {
    setAnnouncement((previous) => ({
      text,
      flip: previous.text === text ? !previous.flip : false,
    }));
  }, []);

  /** Starts a fresh game, drawing a secret that is not a recent one (FR-127). */
  const startFreshGame = useCallback(
    (dict: Dictionary, forLength: WordLength): void => {
      const meta = metaRepo.read();
      const secret = pickAnswer(dict.answers, meta.recentAnswers[forLength], systemRandom);

      metaRepo.write(rememberCodeAnswer(meta, forLength, secret));
      dispatch({ type: 'START', id: crypto.randomUUID(), wordLength: forLength, secret });
    },
    [metaRepo],
  );

  // Load the dictionary, then restore a saved game or start a new one.
  useEffect(() => {
    let cancelled = false;

    loadDictionary(length)
      .then((dict) => {
        if (cancelled) return;

        setDictionary(dict);
        setDictionaryStatus('ready');

        const answers = new Set(dict.answers);
        const saved = sessionRepo.read();

        if (
          saved?.wordLength === length &&
          isCodeSessionUsable(saved, (word) => answers.has(word))
        ) {
          dispatch({ type: 'RESTORE', state: saved });
        } else {
          startFreshGame(dict, length);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setDictionaryStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [length, loadToken, startFreshGame, sessionRepo]);

  // Persist the session (FR-135): debounced, plus a flush when the page is hidden.
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

  // Leaving the view must not lose the last keystroke or note (FR-65, EC-24).
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

  // Record a finished game exactly once (FR-134).
  const recordedRef = useRef<string | null>(null);
  useEffect(() => {
    const record = codeRecord(state);
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

  const cycleNote = useCallback((letter: string): void => {
    dispatch({ type: 'CYCLE_NOTE', letter });
  }, []);

  /**
   * Validates then submits (ARCHITECTURE §3.9). Validation lives here because
   * the engine may not depend on the dictionary (ADR-003). A rejected guess
   * raises a toast and uses no guess (FR-128).
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

    const action = { type: 'SUBMIT_GUESS', word: result.value, now: now() } as const;
    // Score it once here to word the announcement, then let the reducer own the state.
    const next = codeReducer(state, action);
    announce(isGameOver(next) ? outcomeAnnouncement(next) : guessAnnouncement(next));
    dispatch(action);
    return true;
  }, [dictionary, state, show, announce]);

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
      // Persist the choice so the next visit opens on it (FR-127).
      prefsRepo.write({ defaultWordLength: next });
    },
    [sessionRepo, prefsRepo],
  );

  const retryDictionary = useCallback((): void => {
    setDictionaryStatus('loading');
    setLoadToken((token) => token + 1);
  }, []);

  const value = useMemo<CodeContextValue>(
    () => ({
      state,
      length,
      dictionaryStatus,
      isGameOver: isGameOver(state),
      announcement,
      addLetter,
      removeLetter,
      submitGuess,
      cycleNote,
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
      submitGuess,
      cycleNote,
      restart,
      setLength,
      retryDictionary,
    ],
  );

  return <CodeContext.Provider value={value}>{children}</CodeContext.Provider>;
}
