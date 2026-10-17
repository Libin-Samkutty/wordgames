import { useCallback, useEffect, useRef, useState } from 'react';

import { foundCount, missedWords, requiredCount } from '@/engine/hunt';
import { useElapsed } from '@/hooks/useElapsed';
import { usePhysicalKeyboard } from '@/hooks/usePhysicalKeyboard';
import { formatDuration } from '@/lib/format';
import { useSettings } from '@/state';
import { HuntProvider, HuntStatsProvider, useHunt } from '@/state/hunt';

import { DictionaryError } from '../game/DictionaryError';
import { HeaderIconButton } from '../layout/Header';
import { HeaderControls } from '../layout/HeaderControls';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { HuntBoard } from './HuntBoard';
import { HuntHelpModal } from './HuntHelpModal';
import { HuntResultPanel } from './HuntResultPanel';
import { HuntStatsModal } from './HuntStatsModal';

/** How long the invalid-word shake stays on, matching --duration-shake. */
const SHAKE_DURATION_MS = 600;

type Pending = { readonly kind: 'restart' } | { readonly kind: 'give-up' };

/** Everything inside WordHunt's own providers. */
function HuntScreen(): React.JSX.Element {
  const {
    state,
    dictionaryStatus,
    isGameOver,
    announcement,
    addLetter,
    removeLetter,
    submitWord,
    reshuffle,
    giveUp,
    restart,
    retryDictionary,
  } = useHunt();
  const { prefersReducedMotion } = useSettings();
  const elapsed = useElapsed(state.startedAt, state.finishedAt);

  const [isHelpOpen, setHelpOpen] = useState(false);
  const [isStatsOpen, setStatsOpen] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);

  const [shake, setShake] = useState(false);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isReady = dictionaryStatus === 'ready';
  // Input is locked while loading and once the puzzle ends.
  const inputLocked = isGameOver || !isReady;

  // Abandoning is only costly once there is progress, and a finished puzzle has
  // nothing left to abandon (FR-164).
  const hasProgress = state.found.length > 0 || state.bonus.length > 0 || state.currentInput !== '';
  const needsConfirm = hasProgress && !isGameOver;

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
    if (!submitWord()) triggerShake();
  }, [submitWord, triggerShake]);

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

  const confirmPending = (): void => {
    if (pending?.kind === 'restart') restart();
    else if (pending?.kind === 'give-up') giveUp();
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
      'The words you missed will be shown. A give up counts in your statistics and ends your streak.';
  }

  let body: React.JSX.Element;
  if (dictionaryStatus === 'error') {
    body = <DictionaryError onRetry={retryDictionary} />;
  } else if (!isReady) {
    body = (
      <p role="status" className="py-8 text-sm text-text-muted">
        Loading dictionary…
      </p>
    );
  } else {
    body = (
      <>
        {isGameOver ? null : (
          <div className="flex w-full max-w-md items-center justify-between gap-2 px-1">
            <p className="text-sm tabular-nums">
              <span className="font-bold">{String(foundCount(state))}</span> of{' '}
              {String(requiredCount(state))} found
            </p>
            {/* A count-up clock (as ADR-038). A timer role is not announced on every tick. */}
            <p
              role="timer"
              aria-label="Time"
              className="font-mono text-lg font-bold tracking-wider text-text-muted tabular-nums"
            >
              {formatDuration(elapsed)}
            </p>
          </div>
        )}

        <HuntBoard
          state={state}
          shake={shake}
          reducedMotion={prefersReducedMotion}
          disabled={inputLocked}
          onTapLetter={addLetter}
        />

        {isGameOver ? (
          <HuntResultPanel
            completed={state.status === 'won'}
            foundCount={foundCount(state)}
            requiredCount={requiredCount(state)}
            bonusCount={state.bonus.length}
            elapsedMs={state.startedAt === null ? null : elapsed}
            missed={missedWords(state)}
            onPlayAgain={restart}
          />
        ) : (
          <div className="grid w-full max-w-md grid-cols-2 gap-2 sm:grid-cols-4">
            <Button
              variant="secondary"
              className="min-w-0 px-2"
              disabled={inputLocked}
              onClick={removeLetter}
            >
              Backspace
            </Button>
            <Button className="min-w-0 px-2" disabled={inputLocked} onClick={handleSubmit}>
              Submit
            </Button>
            <Button
              variant="secondary"
              className="min-w-0 px-2"
              disabled={inputLocked}
              onClick={reshuffle}
            >
              Reshuffle
            </Button>
            <Button
              variant="secondary"
              className="min-w-0 px-2"
              disabled={inputLocked}
              onClick={() => {
                setPending({ kind: 'give-up' });
              }}
            >
              Give up
            </Button>
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

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center gap-2 px-2 py-2">
        {/* A11Y-26: one polite region, one message per accepted word. */}
        <div role="status" aria-live="polite" className="sr-only">
          {/* A trailing space makes a repeated message differ, so it is read again. */}
          {announcement.text}
          {announcement.flip ? ' ' : ''}
        </div>

        {body}
      </main>

      <HuntHelpModal
        isOpen={isHelpOpen}
        onClose={() => {
          setHelpOpen(false);
        }}
      />
      <HuntStatsModal
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
 * The WordHunt view (`#/hunt`).
 *
 * Its providers mount only here, so leaving for Home or another game unmounts
 * them, which flushes the session first (FR-65, ADR-021).
 */
export function HuntView(): React.JSX.Element {
  return (
    <HuntStatsProvider>
      <HuntProvider>
        <HuntScreen />
      </HuntProvider>
    </HuntStatsProvider>
  );
}
