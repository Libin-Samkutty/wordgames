import { useCallback, useEffect, useRef, useState } from 'react';

import type { LetterState, WordLength } from '@/engine';
import { RANGE_LENGTHS, guessesUsed } from '@/engine/range';
import { usePhysicalKeyboard } from '@/hooks/usePhysicalKeyboard';
import { useSettings } from '@/state';
import { RangeProvider, RangeStatsProvider, useRange } from '@/state/range';

import { BoardSkeleton } from '../board/BoardSkeleton';
import { DictionaryError } from '../game/DictionaryError';
import { LengthSelector } from '../game/LengthSelector';
import { Keyboard } from '../keyboard/Keyboard';
import type { KeyValue } from '../keyboard/Key';
import { HeaderIconButton } from '../layout/Header';
import { HeaderControls } from '../layout/HeaderControls';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { RangeBoard } from './RangeBoard';
import { RangeHelpModal } from './RangeHelpModal';
import { RangeResultPanel } from './RangeResultPanel';
import { RangeStatsModal } from './RangeStatsModal';

/** How long the invalid-guess shake stays on, matching --duration-shake. */
const SHAKE_DURATION_MS = 600;

/** WordRange has no letter colours (FR-122), so the keyboard always gets an empty map. */
const NO_KEY_STATES: ReadonlyMap<string, LetterState> = new Map();

type Pending = { readonly kind: 'restart' } | { readonly kind: 'length'; readonly to: WordLength };

/** Everything inside WordRange's own providers. */
function RangeScreen(): React.JSX.Element {
  const {
    state,
    length,
    dictionaryStatus,
    isGameOver,
    announcement,
    addLetter,
    removeLetter,
    submitGuess,
    restart,
    setLength,
    retryDictionary,
  } = useRange();
  const { prefersReducedMotion } = useSettings();

  const [isHelpOpen, setHelpOpen] = useState(false);
  const [isStatsOpen, setStatsOpen] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);

  const [shake, setShake] = useState(false);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isReady = dictionaryStatus === 'ready';
  // Input is locked while loading and once the game ends.
  const inputLocked = isGameOver || !isReady;

  // Abandoning is only costly once a guess has been made, and a finished game
  // has nothing left to abandon (FR-125).
  const needsConfirm = state.guesses.length >= 1 && state.status === 'playing';

  const triggerShake = useCallback((): void => {
    setShake(true);
    if (shakeTimer.current) clearTimeout(shakeTimer.current);
    shakeTimer.current = setTimeout(() => {
      setShake(false);
    }, SHAKE_DURATION_MS);
  }, []);

  useEffect(
    () => () => {
      if (shakeTimer.current) clearTimeout(shakeTimer.current);
    },
    [],
  );

  const handleSubmit = useCallback((): void => {
    if (!submitGuess()) triggerShake();
  }, [submitGuess, triggerShake]);

  const handleKeyPress = useCallback(
    (value: KeyValue): void => {
      if (inputLocked) return;
      if (value === 'ENTER') handleSubmit();
      else if (value === 'BACKSPACE') removeLetter();
      else addLetter(value);
    },
    [inputLocked, handleSubmit, removeLetter, addLetter],
  );

  const isRowEmpty = useCallback(() => state.currentInput.length === 0, [state.currentInput]);

  usePhysicalKeyboard({
    onLetter: addLetter,
    onBackspace: removeLetter,
    onEnter: handleSubmit,
    isRowEmpty,
    disabled: inputLocked,
  });

  const handleRestart = (): void => {
    if (needsConfirm) setPending({ kind: 'restart' });
    else restart();
  };

  const handleLengthChange = (next: WordLength): void => {
    if (next === length) return;
    if (needsConfirm) setPending({ kind: 'length', to: next });
    else setLength(next);
  };

  const confirmPending = (): void => {
    if (pending?.kind === 'restart') restart();
    else if (pending?.kind === 'length') setLength(pending.to);
    setPending(null);
  };

  const confirmTitle =
    pending?.kind === 'length' ? `Switch to ${String(pending.to)} letters?` : 'Start a new game?';

  let body: React.JSX.Element;
  if (dictionaryStatus === 'error') {
    body = <DictionaryError onRetry={retryDictionary} />;
  } else if (!isReady) {
    body = <BoardSkeleton wordLength={length} />;
  } else {
    body = (
      <>
        <RangeBoard state={state} shake={shake} reducedMotion={prefersReducedMotion} />

        {isGameOver ? (
          <RangeResultPanel
            won={state.status === 'won'}
            guessesUsed={guessesUsed(state)}
            length={length}
            secret={state.secret}
            onPlayAgain={restart}
            onChangeLength={setLength}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      <HeaderControls>
        <HeaderIconButton
          label="How to play"
          onClick={() => {
            setHelpOpen(true);
          }}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M9.6 9.3a2.5 2.5 0 0 1 4.86.83c0 1.67-2.5 2.5-2.5 2.5" strokeLinecap="round" />
            <path d="M12 16.5h.01" strokeLinecap="round" />
          </svg>
        </HeaderIconButton>

        <HeaderIconButton label="New game" onClick={handleRestart} disabled={!isReady}>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </HeaderIconButton>

        <LengthSelector
          value={length}
          lengths={RANGE_LENGTHS}
          disabled={!isReady}
          onChange={handleLengthChange}
        />

        <HeaderIconButton
          label="Statistics"
          onClick={() => {
            setStatsOpen(true);
          }}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M18 20V10M12 20V4M6 20v-6" strokeLinecap="round" />
          </svg>
        </HeaderIconButton>
      </HeaderControls>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-between gap-3 px-2 py-3">
        {/* A11Y-22: one polite region, one summary per guess. */}
        <div role="status" aria-live="polite" className="sr-only">
          {/* A trailing space makes a repeated message differ, so it is read again. */}
          {announcement.text}
          {announcement.flip ? ' ' : ''}
        </div>

        <div className="flex w-full flex-1 flex-col items-center justify-start gap-4">{body}</div>

        {isReady ? (
          <Keyboard keyStates={NO_KEY_STATES} disabled={inputLocked} onKeyPress={handleKeyPress} />
        ) : null}
      </main>

      <RangeHelpModal
        isOpen={isHelpOpen}
        length={length}
        onClose={() => {
          setHelpOpen(false);
        }}
      />
      <RangeStatsModal
        isOpen={isStatsOpen}
        onClose={() => {
          setStatsOpen(false);
        }}
      />
      <ConfirmDialog
        isOpen={pending !== null}
        title={confirmTitle}
        confirmLabel={pending?.kind === 'length' ? 'Switch' : 'New game'}
        onConfirm={confirmPending}
        onCancel={() => {
          setPending(null);
        }}
      >
        Your current game will be abandoned. It will not count towards your statistics.
      </ConfirmDialog>
    </>
  );
}

/**
 * The WordRange view (`#/range`).
 *
 * Its providers mount only here, so leaving for Home or another game unmounts
 * them, which flushes the session first (FR-65, ADR-021).
 */
export function RangeView(): React.JSX.Element {
  return (
    <RangeStatsProvider>
      <RangeProvider>
        <RangeScreen />
      </RangeProvider>
    </RangeStatsProvider>
  );
}
