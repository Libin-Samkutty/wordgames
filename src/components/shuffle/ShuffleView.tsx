import { useCallback, useEffect, useRef, useState } from 'react';

import type { WordLength } from '@/engine';
import {
  SHUFFLE_LENGTHS,
  canHint,
  hasInput,
  hintsLeft,
  hintsUsed,
  otherAnagrams,
} from '@/engine/shuffle';
import { usePhysicalKeyboard } from '@/hooks/usePhysicalKeyboard';
import { useSettings } from '@/state';
import { ShuffleProvider, ShuffleStatsProvider, useShuffle } from '@/state/shuffle';

import { BoardSkeleton } from '../board/BoardSkeleton';
import { DictionaryError } from '../game/DictionaryError';
import { LengthSelector } from '../game/LengthSelector';
import { HeaderIconButton } from '../layout/Header';
import { HeaderControls } from '../layout/HeaderControls';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { ShuffleBoard } from './ShuffleBoard';
import { ShuffleHelpModal } from './ShuffleHelpModal';
import { ShuffleResultPanel } from './ShuffleResultPanel';
import { ShuffleStatsModal } from './ShuffleStatsModal';

/** How long the invalid-answer shake stays on, matching --duration-shake. */
const SHAKE_DURATION_MS = 600;

type Pending =
  | { readonly kind: 'restart' }
  | { readonly kind: 'give-up' }
  | { readonly kind: 'length'; readonly to: WordLength };

/** Everything inside WordShuffle's own providers. */
function ShuffleScreen(): React.JSX.Element {
  const {
    state,
    length,
    dictionaryStatus,
    isGameOver,
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
  } = useShuffle();
  const { prefersReducedMotion } = useSettings();

  const [isHelpOpen, setHelpOpen] = useState(false);
  const [isStatsOpen, setStatsOpen] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);

  const [shake, setShake] = useState(false);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isReady = dictionaryStatus === 'ready';
  // Input is locked while loading and once the puzzle ends.
  const inputLocked = isGameOver || !isReady;

  // Abandoning is only costly once the player has put something in the row or
  // taken a hint, and a finished puzzle has nothing left to abandon (FR-147).
  const needsConfirm = hasInput(state) && state.status === 'playing';

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
    if (!submitAnswer()) triggerShake();
  }, [submitAnswer, triggerShake]);

  /** True when the player has typed no letter of their own: a locked hint does not count. */
  const isRowEmpty = useCallback(
    () => !state.slots.some((slot, index) => slot !== null && !state.hinted.includes(index)),
    [state.slots, state.hinted],
  );

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

  let confirmTitle = 'Start a new puzzle?';
  let confirmLabel = 'New puzzle';
  let confirmBody =
    'Your current puzzle will be abandoned. It will not count towards your statistics.';
  if (pending?.kind === 'give-up') {
    confirmTitle = 'Give up?';
    confirmLabel = 'Give up';
    confirmBody =
      'The word will be shown. A give up counts in your statistics and ends your streak.';
  } else if (pending?.kind === 'length') {
    confirmTitle = `Switch to ${String(pending.to)} letters?`;
    confirmLabel = 'Switch';
  }

  const left = hintsLeft(state);

  let body: React.JSX.Element;
  if (dictionaryStatus === 'error') {
    body = <DictionaryError onRetry={retryDictionary} />;
  } else if (!isReady) {
    body = <BoardSkeleton wordLength={length} />;
  } else {
    body = (
      <>
        <ShuffleBoard
          state={state}
          shake={shake}
          reducedMotion={prefersReducedMotion}
          disabled={inputLocked}
          onTapLetter={addLetter}
        />

        {isGameOver ? (
          <ShuffleResultPanel
            solved={state.status === 'solved'}
            length={length}
            word={state.found ?? state.target}
            hintsUsed={hintsUsed(state)}
            others={otherAnagrams(state)}
            onPlayAgain={restart}
            onChangeLength={setLength}
          />
        ) : (
          <div className="flex w-full max-w-sm flex-col gap-2">
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                disabled={inputLocked}
                onClick={removeLetter}
              >
                Backspace
              </Button>
              <Button className="flex-1" disabled={inputLocked} onClick={handleSubmit}>
                Submit
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="min-w-0 flex-1 px-2"
                disabled={inputLocked || !canHint(state)}
                aria-label={`Hint, ${String(left)} left`}
                onClick={hint}
              >
                Hint ({left})
              </Button>
              <Button
                variant="secondary"
                className="min-w-0 flex-1 px-2"
                disabled={inputLocked || state.tray.length < 2}
                onClick={reshuffle}
              >
                Reshuffle
              </Button>
              <Button
                variant="secondary"
                className="min-w-0 flex-1 px-2"
                disabled={inputLocked}
                onClick={() => {
                  setPending({ kind: 'give-up' });
                }}
              >
                Give up
              </Button>
            </div>
          </div>
        )}
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

        <HeaderIconButton label="New puzzle" onClick={handleRestart} disabled={!isReady}>
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
          lengths={SHUFFLE_LENGTHS}
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

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center gap-3 px-2 py-3">
        {/* A11Y-24: one polite region for hints, reshuffles and the outcome. */}
        <div role="status" aria-live="polite" className="sr-only">
          {/* A trailing space makes a repeated message differ, so it is read again. */}
          {announcement.text}
          {announcement.flip ? ' ' : ''}
        </div>

        <div className="flex w-full flex-1 flex-col items-center justify-center gap-6">{body}</div>
      </main>

      <ShuffleHelpModal
        isOpen={isHelpOpen}
        onClose={() => {
          setHelpOpen(false);
        }}
      />
      <ShuffleStatsModal
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
 * The WordShuffle view (`#/shuffle`).
 *
 * Its providers mount only here, so leaving for Home or another game unmounts
 * them, which flushes the session first (FR-65, ADR-021).
 */
export function ShuffleView(): React.JSX.Element {
  return (
    <ShuffleStatsProvider>
      <ShuffleProvider>
        <ShuffleScreen />
      </ShuffleProvider>
    </ShuffleStatsProvider>
  );
}
