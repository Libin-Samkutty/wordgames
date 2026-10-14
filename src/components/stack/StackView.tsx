import { useCallback, useEffect, useRef, useState } from 'react';

import {
  STACK_LENGTH,
  STACK_MODES,
  boardsSolved,
  guessesUsed,
  maxGuesses,
  type StackMode,
} from '@/engine/stack';
import { usePhysicalKeyboard } from '@/hooks/usePhysicalKeyboard';
import { useRevealTimeline } from '@/hooks/useRevealTimeline';
import { useSettings } from '@/state';
import { StackProvider, StackStatsProvider, useStack } from '@/state/stack';

import { BoardSkeleton } from '../board/BoardSkeleton';
import { DictionaryError } from '../game/DictionaryError';
import type { KeyValue } from '../keyboard/Key';
import { HeaderIconButton } from '../layout/Header';
import { HeaderControls } from '../layout/HeaderControls';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { ModeSelector } from './ModeSelector';
import { StackBoards } from './StackBoards';
import { StackHelpModal } from './StackHelpModal';
import { StackKeyboard } from './StackKeyboard';
import { StackResultPanel } from './StackResultPanel';
import { StackStatsModal } from './StackStatsModal';

/** How long the invalid-guess shake stays on, matching --duration-shake. */
const SHAKE_DURATION_MS = 600;

type Pending = { readonly kind: 'restart' } | { readonly kind: 'mode'; readonly to: StackMode };

/** Everything inside WordStack's own providers. */
function StackScreen(): React.JSX.Element {
  const {
    state,
    mode,
    keyStates,
    dictionaryStatus,
    isRevealing,
    isGameOver,
    announcement,
    addLetter,
    removeLetter,
    submitGuess,
    completeReveal,
    restart,
    setMode,
    retryDictionary,
  } = useStack();
  const { prefersReducedMotion } = useSettings();

  const [isHelpOpen, setHelpOpen] = useState(false);
  const [isStatsOpen, setStatsOpen] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);

  const [shake, setShake] = useState(false);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isReady = dictionaryStatus === 'ready';
  // Input is locked while revealing, while loading, and once the game ends.
  const inputLocked = isRevealing || isGameOver || !isReady;

  // Abandoning is only costly once a guess has been made, and a finished game
  // has nothing left to abandon (FR-113).
  const needsConfirm =
    state.words.length >= 1 && (state.status === 'playing' || state.status === 'revealing');

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

  /** Submitting shakes the active row on every board when the guess is rejected (FR-104). */
  const handleSubmit = useCallback((): void => {
    if (!submitGuess()) triggerShake();
  }, [submitGuess, triggerShake]);

  // Every board flips together, so one timeline serves them all (FR-105).
  useRevealTimeline({
    isRevealing,
    wordLength: STACK_LENGTH,
    reducedMotion: prefersReducedMotion,
    onComplete: completeReveal,
  });

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

  const handleModeChange = (next: StackMode): void => {
    if (next === mode) return;
    if (needsConfirm) setPending({ kind: 'mode', to: next });
    else setMode(next);
  };

  const confirmPending = (): void => {
    if (pending?.kind === 'restart') restart();
    else if (pending?.kind === 'mode') setMode(pending.to);
    setPending(null);
  };

  const boardCount = STACK_MODES[mode].boards;
  const confirmTitle =
    pending?.kind === 'mode'
      ? `Switch to ${pending.to === 'duo' ? 'Duo' : 'Quad'}?`
      : 'Start a new game?';

  let body: React.JSX.Element;
  if (dictionaryStatus === 'error') {
    body = <DictionaryError onRetry={retryDictionary} />;
  } else if (!isReady) {
    body = <BoardSkeleton wordLength={STACK_LENGTH} />;
  } else {
    body = (
      <>
        <StackBoards state={state} shake={shake} reducedMotion={prefersReducedMotion} />

        {isGameOver ? (
          <StackResultPanel
            won={state.status === 'won'}
            mode={mode}
            guessesUsed={guessesUsed(state)}
            maxGuesses={maxGuesses(state)}
            boardsSolved={boardsSolved(state)}
            answers={state.boards.map((board) => ({
              word: board.answer,
              solved: board.guesses.some((guess) => guess.word === board.answer),
            }))}
            onPlayAgain={restart}
            onChangeMode={setMode}
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

        <ModeSelector value={mode} disabled={!isReady} onChange={handleModeChange} />

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
        {/* A11Y-21: one polite region, one summary per guess. */}
        <div role="status" aria-live="polite" className="sr-only">
          {/* A trailing non-breaking space makes a repeated message differ, so it is read again. */}
          {announcement.text}
          {announcement.flip ? ' ' : ''}
        </div>

        <div className="flex w-full flex-1 flex-col items-center justify-center gap-4">{body}</div>

        {isReady ? (
          <StackKeyboard
            boardKeyStates={keyStates}
            disabled={inputLocked}
            onKeyPress={handleKeyPress}
          />
        ) : null}
      </main>

      <StackHelpModal
        isOpen={isHelpOpen}
        onClose={() => {
          setHelpOpen(false);
        }}
      />
      <StackStatsModal
        isOpen={isStatsOpen}
        onClose={() => {
          setStatsOpen(false);
        }}
      />
      <ConfirmDialog
        isOpen={pending !== null}
        title={confirmTitle}
        confirmLabel={pending?.kind === 'mode' ? 'Switch' : 'New game'}
        onConfirm={confirmPending}
        onCancel={() => {
          setPending(null);
        }}
      >
        Your current game of {String(boardCount)} boards will be abandoned. It will not count
        towards your statistics.
      </ConfirmDialog>
    </>
  );
}

/**
 * The WordStack view (`#/stack`).
 *
 * Its providers mount only here, so leaving for Home or another game unmounts
 * them, which flushes the session first (FR-65, ADR-021).
 */
export function StackView(): React.JSX.Element {
  return (
    <StackStatsProvider>
      <StackProvider>
        <StackScreen />
      </StackProvider>
    </StackStatsProvider>
  );
}
