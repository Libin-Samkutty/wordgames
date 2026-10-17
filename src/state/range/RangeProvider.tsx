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
import { pickAnswer, systemRandom } from '@/engine';
import {
  createRangeGame,
  guessedWords,
  isGameOver,
  listDistance,
  rangeRecord,
  rangeReducer,
  validateRangeGuess,
  type RangeError,
  type RangeState,
} from '@/engine/range';
import type { WordLength } from '@/engine/types';
import { now } from '@/lib/clock';
import {
  createRangeMetaRepository,
  createRangePrefsRepository,
  createRangeSessionRepository,
  isRangeSessionUsable,
  rememberRangeAnswer,
} from '@/storage';

import { useToast } from '../contexts';
import { reportStorageIssue } from '../storageIssues';
import { guessAnnouncement, outcomeAnnouncement } from './announcements';
import { RangeContext, useRangeStats } from './rangeContexts';

/** Status of the dictionary load, apart from the game's own status. */
export type RangeDictionaryStatus = 'loading' | 'ready' | 'error';

/**
 * A polite live-region message. When the same text comes twice running, `flip`
 * alternates so the content differs and a screen reader reads it again.
 */
export interface RangeAnnouncement {
  readonly text: string;
  readonly flip: boolean;
}

export interface RangeContextValue {
  readonly state: RangeState;
  /** The chosen word length (FR-115). It can differ from `state.wordLength` while a length loads. */
  readonly length: WordLength;
  readonly dictionaryStatus: RangeDictionaryStatus;
  readonly isGameOver: boolean;
  readonly announcement: RangeAnnouncement;
  readonly addLetter: (letter: string) => void;
  readonly removeLetter: () => void;
  /** Returns false when the guess was rejected, so the view can shake. */
  readonly submitGuess: () => boolean;
  readonly restart: () => void;
  /** Switches length: discards the saved game, loads that list and starts afresh (FR-115). */
  readonly setLength: (length: WordLength) => void;
  readonly retryDictionary: () => void;
}

/** Session writes are debounced; keystrokes are far more frequent than reloads. */
const SESSION_WRITE_DEBOUNCE_MS = 150;

const ERROR_MESSAGES: Record<RangeError, string> = {
  'too-short': 'Not enough letters',
  'not-a-word': 'Not in word list',
  'already-guessed': 'Already guessed',
  'outside-range': 'Outside the range',
};

/** Placeholder until the dictionary resolves and a real game starts. */
function placeholderGame(length: WordLength): RangeState {
  return createRangeGame('pending', 'A'.repeat(length));
}

/** True for a game worth persisting: not the placeholder (FR-125). */
function isPersistable(state: RangeState): boolean {
  return state.id !== 'pending';
}

export function RangeProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { show } = useToast();
  const { recordGame } = useRangeStats();

  // Per-game repositories (FR-67, FR-99), created once per provider instance.
  const [prefsRepo] = useState(() => createRangePrefsRepository(reportStorageIssue));
  const [sessionRepo] = useState(() => createRangeSessionRepository(reportStorageIssue));
  const [metaRepo] = useState(() => createRangeMetaRepository(reportStorageIssue));

  const [length, setLengthState] = useState<WordLength>(() => prefsRepo.read().defaultWordLength);
  const [dictionaryStatus, setDictionaryStatus] = useState<RangeDictionaryStatus>('loading');
  const [dictionary, setDictionary] = useState<Dictionary | null>(null);
  const [announcement, setAnnouncement] = useState<RangeAnnouncement>({ text: '', flip: false });
  const [state, dispatch] = useReducer(rangeReducer, length, placeholderGame);

  // Reload token: bumping it re-runs the dictionary effect for Retry (EC-14).
  const [loadToken, setLoadToken] = useState(0);

  const announce = useCallback((text: string): void => {
    setAnnouncement((previous) => ({
      text,
      flip: previous.text === text ? !previous.flip : false,
    }));
  }, []);

  /** Starts a fresh game, drawing a secret that is not a recent one (FR-115). */
  const startFreshGame = useCallback(
    (dict: Dictionary, forLength: WordLength): void => {
      const meta = metaRepo.read();
      const secret = pickAnswer(dict.answers, meta.recentAnswers[forLength], systemRandom);

      metaRepo.write(rememberRangeAnswer(meta, forLength, secret));
      dispatch({ type: 'START', id: crypto.randomUUID(), secret });
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
          isRangeSessionUsable(saved, (word) => answers.has(word))
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

  // Persist the session (FR-125): debounced, plus a flush when the page is hidden.
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

  // Record a finished game exactly once (FR-124).
  const recordedRef = useRef<string | null>(null);
  useEffect(() => {
    const record = rangeRecord(state);
    if (!record || recordedRef.current === state.id) return;

    recordedRef.current = state.id;

    // On a loss, count the words still in the range. The list is needed for that, so a
    // game restored before the dictionary loads is recorded without it.
    let wordsLeft: number | null = null;
    if (!record.won && dictionary) {
      const apart = listDistance(dictionary.guessList, state.lower, state.upper);
      if (apart !== null) wordsLeft = Math.max(0, apart - 1);
    }

    recordGame(record.won ? record : { ...record, wordsLeft });
  }, [state, recordGame, dictionary]);

  const addLetter = useCallback((letter: string): void => {
    dispatch({ type: 'ADD_LETTER', letter, now: now() });
  }, []);

  const removeLetter = useCallback((): void => {
    dispatch({ type: 'REMOVE_LETTER' });
  }, []);

  /**
   * Validates then submits (ARCHITECTURE §3.8). Validation lives here because
   * the engine may not depend on the dictionary (ADR-003). A rejected guess
   * raises a toast and uses no guess (FR-117).
   */
  const submitGuess = useCallback((): boolean => {
    if (!dictionary || state.status !== 'playing') return false;

    const result = validateRangeGuess(state.currentInput, {
      wordLength: state.wordLength,
      lower: state.lower,
      upper: state.upper,
      guessed: guessedWords(state),
      isAllowed: (word) => dictionary.guesses.has(word),
    });

    if (!result.ok) {
      show(ERROR_MESSAGES[result.error], 'error');
      return false;
    }

    // An accepted word is in the guess list, so the secret is too: the distance exists.
    const distance = listDistance(dictionary.guessList, result.value, state.secret) ?? 0;
    const action = { type: 'SUBMIT_GUESS', word: result.value, distance, now: now() } as const;

    // Score it once here to word the announcement, then let the reducer own the state.
    const next = rangeReducer(state, action);
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
      // Persist the choice so the next visit opens on it (FR-115).
      prefsRepo.write({ defaultWordLength: next });
    },
    [sessionRepo, prefsRepo],
  );

  const retryDictionary = useCallback((): void => {
    setDictionaryStatus('loading');
    setLoadToken((token) => token + 1);
  }, []);

  const value = useMemo<RangeContextValue>(
    () => ({
      state,
      length,
      dictionaryStatus,
      isGameOver: isGameOver(state),
      announcement,
      addLetter,
      removeLetter,
      submitGuess,
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
      restart,
      setLength,
      retryDictionary,
    ],
  );

  return <RangeContext.Provider value={value}>{children}</RangeContext.Provider>;
}
