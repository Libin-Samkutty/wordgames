import { useCallback, useEffect, useRef, useState } from 'react';

import type { WordLength } from '@/engine';
import { DODGE_LENGTHS, canGiveUp, revealedWord, wordsLeft } from '@/engine/dodge';
import { usePhysicalKeyboard } from '@/hooks/usePhysicalKeyboard';
import { useRevealTimeline } from '@/hooks/useRevealTimeline';
import { clampDuration } from '@/lib/clock';
import { useSettings } from '@/state';
import { DodgeProvider, DodgeStatsProvider, useDodge } from '@/state/dodge';

import { Board } from '../board/Board';
import { BoardSkeleton } from '../board/BoardSkeleton';
import { DictionaryError } from '../game/DictionaryError';
import { LengthSelector } from '../game/LengthSelector';
import type { KeyValue } from '../keyboard/Key';
import { Keyboard } from '../keyboard/Keyboard';
import { HeaderIconButton } from '../layout/Header';
import { HeaderControls } from '../layout/HeaderControls';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { DodgeHelpModal } from './DodgeHelpModal';
import { DodgeResultPanel } from './DodgeResultPanel';
import { DodgeStatsModal } from './DodgeStatsModal';

/** How long the invalid-guess shake stays on, matching --duration-shake. */
const SHAKE_DURATION_MS = 600;

type Pending =
  | { readonly kind: 'restart' }
  | { readonly kind: 'give-up' }
  | { readonly kind: 'length'; readonly to: WordLength };

/** Everything inside WordDodge's own providers. */
function DodgeScreen(): React.JSX.Element {
  const {
    state,
    rows,
    keyStates,
    length,
    dictionaryStatus,
    isRevealing,
    isGameOver,
    wordsLeft: remaining,
    announcement,
    addLetter,
    removeLetter,
    submitGuess,
    completeReveal,
    giveUp,
    restart,
    setLength,
    retryDictionary,
  } = useDodge();
  const { prefersReducedMotion } = useSettings();

  const [isHelpOpen, setHelpOpen] = useState(false);
  const [isStatsOpen, setStatsOpen] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);

  const [shakeRow, setShakeRow] = useState<number | null>(null);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boardRegion = useRef<HTMLDivElement>(null);

  const isReady = dictionaryStatus === 'ready';
  // Input is locked while revealing, while loading, and once the game ends.
  const inputLocked = isRevealing || isGameOver || !isReady;

  // Abandoning is only costly once a guess has been made, and a finished game
  // has nothing left to abandon (FR-153).
  const needsConfirm = state.guesses.length >= 1 && !isGameOver;

  const triggerShake = useCallback((): void => {
    setShakeRow(state.guesses.length);

    if (shakeTimer.current) clearTimeout(shakeTimer.current);
    shakeTimer.current = setTimeout(() => {
      setShakeRow(null);
    }, SHAKE_DURATION_MS);
  }, [state.guesses.length]);

  useEffect(
    () => () => {
      if (shakeTimer.current) clearTimeout(shakeTimer.current);
    },
    [],
  );

  // The board has no row limit, so keep the newest row in view as it grows (FR-150).
  const rowCount = rows.length;
  useEffect(() => {
    const region = boardRegion.current;
    if (region) region.scrollTop = region.scrollHeight;
  }, [rowCount, isReady]);

  const handleSubmit = useCallback((): void => {
    if (!submitGuess()) triggerShake();
  }, [submitGuess, triggerShake]);

  useRevealTimeline({
    isRevealing,
    wordLength: length,
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

  const handleLengthChange = (next: WordLength): void => {
    if (next === length) return;
    if (needsConfirm) setPending({ kind: 'length', to: next });
    else setLength(next);
  };

  const confirmPending = (): void => {
    if (pending?.kind === 'restart') restart();
    else if (pending?.kind === 'give-up') giveUp();
    else if (pending?.kind === 'length') setLength(pending.to);
    setPending(null);
  };

  let confirmTitle = 'Start a new game?';
  let confirmLabel = 'New game';
  let confirmBody =
    'Your current game will be abandoned. It will not count towards your statistics.';
  if (pending?.kind === 'length') {
    confirmTitle = `Switch to ${String(pending.to)} letters?`;
    confirmLabel = 'Switch';
  } else if (pending?.kind === 'give-up') {
    confirmTitle = 'Give up?';
    confirmLabel = 'Give up';
    confirmBody =
      'One of the words still possible will be shown. A give up counts in your statistics and ends your streak.';
  }

  let body: React.JSX.Element;
  if (dictionaryStatus === 'error') {
    body = <DictionaryError onRetry={retryDictionary} />;
  } else if (!isReady) {
    body = <BoardSkeleton wordLength={length} />;
  } else {
    body = (
      <>
        <div className="flex w-full max-w-md items-center justify-between gap-2 px-1">
          <p className="text-sm tabular-nums">
            <span className="font-bold">{String(remaining)}</span>{' '}
            {remaining === 1 ? 'word' : 'words'} left
          </p>
          <Button
            variant="secondary"
            className="px-3"
            disabled={!canGiveUp(state)}
            onClick={() => {
              setPending({ kind: 'give-up' });
            }}
          >
            Give up
          </Button>
        </div>

        <div
          ref={boardRegion}
          role="group"
          aria-label="Board"
          // A scrollable region must be reachable by keyboard (WCAG 2.1.1, axe
          // scrollable-region-focusable), so a keyboard user can scroll the rows
          // while the keyboard below stays on screen (FR-59).
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- see above
          tabIndex={0}
          className="flex max-h-[clamp(8rem,calc(100dvh-26rem),60rem)] w-full max-w-md [scrollbar-gutter:stable_both-edges] flex-col items-center overflow-y-auto overscroll-contain px-1 py-1"
        >
          <Board
            rows={rows}
            wordLength={length}
            shakeRow={shakeRow}
            reducedMotion={prefersReducedMotion}
          />
        </div>

        {isGameOver ? (
          <DodgeResultPanel
            won={state.status === 'won'}
            length={length}
            word={
              state.status === 'won'
                ? (state.guesses[state.guesses.length - 1]?.word ?? '')
                : revealedWord(state)
            }
            guessesUsed={state.guesses.length}
            elapsedMs={clampDuration((state.finishedAt ?? 0) - (state.startedAt ?? 0))}
            othersLeft={Math.max(0, wordsLeft(state) - 1)}
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
          lengths={DODGE_LENGTHS}
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
        {/* A11Y-25: one polite region, one summary per guess once its reveal is done. */}
        <div role="status" aria-live="polite" className="sr-only">
          {/* A trailing space makes a repeated message differ, so it is read again. */}
          {announcement.text}
          {announcement.flip ? ' ' : ''}
        </div>

        <div className="flex w-full flex-1 flex-col items-center justify-start gap-3">{body}</div>

        {isReady ? (
          <Keyboard keyStates={keyStates} disabled={inputLocked} onKeyPress={handleKeyPress} />
        ) : null}
      </main>

      <DodgeHelpModal
        isOpen={isHelpOpen}
        length={length}
        onClose={() => {
          setHelpOpen(false);
        }}
      />
      <DodgeStatsModal
        isOpen={isStatsOpen}
        onClose={() => {
          setStatsOpen(false);
        }}
      />
      <ConfirmDialog
        isOpen={pending !== null}
        title={confirmTitle}
        confirmLabel={confirmLabel}
        onConfirm={confirmPending}
        onCancel={() => {
          setPending(null);
        }}
      >
        {confirmBody}
      </ConfirmDialog>
    </>
  );
}

/**
 * The WordDodge view (`#/dodge`).
 *
 * Its providers mount only here, so leaving for Home or another game unmounts
 * them, which flushes the session first (FR-65, ADR-021).
 */
export function DodgeView(): React.JSX.Element {
  return (
    <DodgeStatsProvider>
      <DodgeProvider>
        <DodgeScreen />
      </DodgeProvider>
    </DodgeStatsProvider>
  );
}
