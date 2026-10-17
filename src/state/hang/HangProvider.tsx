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
import { pickAnswer, systemRandom, type LetterState, type WordLength } from '@/engine';
import {
  createHangGame,
  hangRecord,
  hangReducer,
  isGameOver,
  letterStates,
  misses,
  type HangState,
} from '@/engine/hang';
import { now } from '@/lib/clock';
import {
  createHangMetaRepository,
  createHangPrefsRepository,
  createHangSessionRepository,
  isHangSessionUsable,
  rememberHangAnswer,
} from '@/storage';

import { reportStorageIssue } from '../storageIssues';
import { letterAnnouncement, outcomeAnnouncement } from './announcements';
import { HangContext, useHangStats } from './hangContexts';

/** Status of the dictionary load, apart from the game's own status. */
export type HangDictionaryStatus = 'loading' | 'ready' | 'error';

/**
 * A polite live-region message. When the same text comes twice running, `flip`
 * alternates so the content differs and a screen reader reads it again.
 */
export interface HangAnnouncement {
  readonly text: string;
  readonly flip: boolean;
}

export interface HangContextValue {
  readonly state: HangState;
  readonly length: WordLength;
  readonly dictionaryStatus: HangDictionaryStatus;
  readonly isGameOver: boolean;
  /** Each letter tried as `correct` (in the word) or `absent` (not), for the keyboard. */
  readonly letterStates: ReadonlyMap<string, LetterState>;
  readonly announcement: HangAnnouncement;
  readonly guessLetter: (letter: string) => void;
  readonly restart: () => void;
  readonly setLength: (length: WordLength) => void;
  readonly retryDictionary: () => void;
}

/** Session writes are debounced; guesses are far more frequent than reloads. */
const SESSION_WRITE_DEBOUNCE_MS = 150;

/** Placeholder until the dictionary resolves and a real game starts. */
function placeholderGame(length: WordLength): HangState {
  return createHangGame('pending', length, 'A'.repeat(length));
}

/** True for a game worth persisting: not the placeholder (FR-173). */
function isPersistable(state: HangState): boolean {
  return state.id !== 'pending';
}

export function HangProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { recordGame } = useHangStats();

  // Per-game repositories (FR-67, FR-99), created once per provider instance.
  const [prefsRepo] = useState(() => createHangPrefsRepository(reportStorageIssue));
  const [sessionRepo] = useState(() => createHangSessionRepository(reportStorageIssue));
  const [metaRepo] = useState(() => createHangMetaRepository(reportStorageIssue));

  const [length, setLengthState] = useState<WordLength>(() => prefsRepo.read().defaultWordLength);
  const [dictionaryStatus, setDictionaryStatus] = useState<HangDictionaryStatus>('loading');
  const [dictionary, setDictionary] = useState<Dictionary | null>(null);
  const [announcement, setAnnouncement] = useState<HangAnnouncement>({ text: '', flip: false });
  const [state, dispatch] = useReducer(hangReducer, length, placeholderGame);

  // Reload token: bumping it re-runs the dictionary effect for Retry (EC-14).
  const [loadToken, setLoadToken] = useState(0);

  const announce = useCallback((text: string): void => {
    setAnnouncement((previous) => ({
      text,
      flip: previous.text === text ? !previous.flip : false,
    }));
  }, []);

  /** Starts a fresh game, drawing a secret that is not a recent one (FR-168). */
  const startFreshGame = useCallback(
    (dict: Dictionary, forLength: WordLength): void => {
      const meta = metaRepo.read();
      const secret = pickAnswer(dict.answers, meta.recentAnswers[forLength], systemRandom);

      metaRepo.write(rememberHangAnswer(meta, forLength, secret));
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
          isHangSessionUsable(saved, (word) => answers.has(word))
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

  // Persist the session (FR-173): debounced, plus a flush when the page is hidden.
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

  // Leaving the view must not lose the last letter (FR-65, EC-24).
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

  // Record a finished game exactly once (FR-174).
  const recordedRef = useRef<string | null>(null);
  useEffect(() => {
    const record = hangRecord(state);
    if (!record || recordedRef.current === state.id) return;

    recordedRef.current = state.id;
    recordGame(record);
  }, [state, recordGame]);

  /**
   * Applies a letter. There is nothing to validate: a letter already tried or a
   * finished game is ignored by the reducer with no toast (FR-169). The
   * announcement is worded from the state the letter would give, so it is said
   * once, and not for an ignored letter.
   */
  const guessLetter = useCallback(
    (letter: string): void => {
      const action = { type: 'GUESS_LETTER', letter, now: now() } as const;
      const next = hangReducer(state, action);
      if (next === state) return;

      const upper = letter.toUpperCase();
      announce(
        isGameOver(next)
          ? outcomeAnnouncement(next, misses(next))
          : letterAnnouncement(next, upper),
      );
      dispatch(action);
    },
    [state, announce],
  );

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
      // Persist the choice so the next visit opens on it (FR-167).
      prefsRepo.write({ defaultWordLength: next });
    },
    [sessionRepo, prefsRepo],
  );

  const retryDictionary = useCallback((): void => {
    setDictionaryStatus('loading');
    setLoadToken((token) => token + 1);
  }, []);

  const states = useMemo(() => letterStates(state), [state]);

  const value = useMemo<HangContextValue>(
    () => ({
      state,
      length,
      dictionaryStatus,
      isGameOver: isGameOver(state),
      letterStates: states,
      announcement,
      guessLetter,
      restart,
      setLength,
      retryDictionary,
    }),
    [
      state,
      length,
      dictionaryStatus,
      states,
      announcement,
      guessLetter,
      restart,
      setLength,
      retryDictionary,
    ],
  );

  return <HangContext.Provider value={value}>{children}</HangContext.Provider>;
}
