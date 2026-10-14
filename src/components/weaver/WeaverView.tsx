import { useCallback, useEffect, useRef, useState } from 'react';

import type { LetterState } from '@/engine';
import { WEAVER_LENGTHS, type WeaverLength } from '@/engine/weaver';
import { usePhysicalKeyboard } from '@/hooks/usePhysicalKeyboard';
import { useRevealTimeline } from '@/hooks/useRevealTimeline';
import { useSettings } from '@/state';
import { WeaverProvider, WeaverStatsProvider, useWeaver } from '@/state/weaver';

import { DictionaryError } from '../game/DictionaryError';
import { LengthSelector } from '../game/LengthSelector';
import type { KeyValue } from '../keyboard/Key';
import { Keyboard } from '../keyboard/Keyboard';
import { HeaderIconButton } from '../layout/Header';
import { HeaderControls } from '../layout/HeaderControls';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { GenerationError } from './GenerationError';
import { WeaverBoard } from './WeaverBoard';
import { WeaverHelpModal } from './WeaverHelpModal';
import { WeaverResultPanel } from './WeaverResultPanel';
import { WeaverSkeleton } from './WeaverSkeleton';
import { WeaverStatsModal } from './WeaverStatsModal';

/** How long the invalid-rung shake stays on, matching --duration-shake. */
const SHAKE_DURATION_MS = 600;

/** WordWeaver has no letter colours on the keyboard (FR-90). */
const NO_KEY_STATES: ReadonlyMap<string, LetterState> = new Map();

type Pending =
  | { readonly kind: 'give-up' }
  | { readonly kind: 'new-puzzle' }
  | { readonly kind: 'length'; readonly to: WeaverLength };

function isWeaverLength(value: number): value is WeaverLength {
  return WEAVER_LENGTHS.some((length) => length === value);
}

/** Everything inside WordWeaver's own providers. */
function WeaverScreen(): React.JSX.Element {
  const {
    state,
    rows,
    summary,
    length,
    dictionaryStatus,
    generationFailed,
    isRevealing,
    isGameOver,
    canUndo,
    announcement,
    addLetter,
    removeLetter,
    submitRung,
    undo,
    giveUp,
    newPuzzle,
    completeReveal,
    setLength,
    retry,
  } = useWeaver();
  const { prefersReducedMotion } = useSettings();

  const [isHelpOpen, setHelpOpen] = useState(false);
  const [isStatsOpen, setStatsOpen] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);

  const [shakeInput, setShakeInput] = useState(false);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isReady = dictionaryStatus === 'ready' && !generationFailed;
  // Input is locked while revealing, while preparing, and once the puzzle ends.
  const inputLocked = isRevealing || isGameOver || !isReady;

  // Abandoning is only costly once a rung has been played, and a finished
  // puzzle has nothing left to abandon (FR-94).
  const hasRungs = state.rungs.length >= 1;
  const inPlay = state.status === 'playing' || state.status === 'revealing';
  const needsConfirm = hasRungs && inPlay;

  const triggerShake = useCallback((): void => {
    setShakeInput(true);
    if (shakeTimer.current) clearTimeout(shakeTimer.current);
    shakeTimer.current = setTimeout(() => {
      setShakeInput(false);
    }, SHAKE_DURATION_MS);
  }, []);

  useEffect(
    () => () => {
      if (shakeTimer.current) clearTimeout(shakeTimer.current);
    },
    [],
  );

  /** Submitting shakes the input row when the rung is rejected (FR-80). */
  const handleSubmit = useCallback((): void => {
    if (!submitRung()) triggerShake();
  }, [submitRung, triggerShake]);

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

  const handleGiveUp = (): void => {
    if (hasRungs) setPending({ kind: 'give-up' });
    else giveUp();
  };

  const handleNewPuzzle = (): void => {
    if (needsConfirm) setPending({ kind: 'new-puzzle' });
    else newPuzzle();
  };

  const handleLengthChange = (next: number): void => {
    if (!isWeaverLength(next) || next === length) return;
    if (needsConfirm) setPending({ kind: 'length', to: next });
    else setLength(next);
  };

  const confirmPending = (): void => {
    if (pending?.kind === 'give-up') giveUp();
    else if (pending?.kind === 'new-puzzle') newPuzzle();
    else if (pending?.kind === 'length') setLength(pending.to);
    setPending(null);
  };

  const confirmCopy = {
    title: 'Start a new puzzle?',
    body: 'Your current ladder will be abandoned. It will not count towards your statistics.',
    confirm: 'New puzzle',
    destructive: false,
  };
  if (pending?.kind === 'give-up') {
    confirmCopy.title = 'Give up?';
    confirmCopy.body =
      'This ends the puzzle and shows one shortest ladder. It counts as a puzzle played and resets your streak.';
    confirmCopy.confirm = 'Give up';
    confirmCopy.destructive = true;
  } else if (pending?.kind === 'length') {
    confirmCopy.title = `Switch to ${String(pending.to)} letters?`;
    confirmCopy.confirm = 'Switch';
  }

  let body: React.JSX.Element;
  if (dictionaryStatus === 'error') {
    body = <DictionaryError onRetry={retry} />;
  } else if (dictionaryStatus === 'loading') {
    body = <WeaverSkeleton length={length} />;
  } else if (generationFailed) {
    body = <GenerationError onRetry={retry} />;
  } else {
    body = (
      <>
        {isGameOver ? null : (
          <p className="text-sm text-text-muted tabular-nums">
            <span className="font-bold text-text">Par {state.par}</span>
            <span aria-hidden="true"> · </span>
            <span className="sr-only">, </span>
            Moves {state.moves}
          </p>
        )}

        <WeaverBoard
          rows={rows}
          length={length}
          shakeInput={shakeInput}
          reducedMotion={prefersReducedMotion}
        />

        {isGameOver ? (
          <WeaverResultPanel
            solved={state.status === 'solved'}
            summary={summary}
            length={length}
            playerLadder={[state.start, ...state.rungs.map((rung) => rung.word)]}
            optimalLadder={state.optimalLadder}
            onPlayAgain={newPuzzle}
            onChangeLength={setLength}
          />
        ) : null}
      </>
    );
  }

  const showControls = dictionaryStatus === 'ready' && !generationFailed;

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

        <LengthSelector
          value={length}
          lengths={WEAVER_LENGTHS}
          disabled={dictionaryStatus === 'loading'}
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

      <main
        className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-between gap-2 px-2 py-2"
        // Keys shrink a little on a short window, to a size that is still a 44 px touch target,
        // so the four visible rows and the keyboard fit together.
        style={{ '--size-key-height': 'clamp(2.75rem, 8dvh, 3.5rem)' } as React.CSSProperties}
      >
        {/* A11Y-17: one polite region for rungs, undo, solve and give up. */}
        <div role="status" aria-live="polite" className="sr-only">
          {/* A trailing non-breaking space makes a repeated message differ, so it is read again. */}
          {announcement.text}
          {announcement.flip ? ' ' : ''}
        </div>

        <div className="flex w-full flex-1 flex-col items-center justify-center gap-2">
          {body}

          {showControls ? (
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="secondary" onClick={undo} disabled={!canUndo}>
                Undo
              </Button>
              <Button
                variant="secondary"
                onClick={handleGiveUp}
                disabled={state.status !== 'playing'}
              >
                Give up
              </Button>
              <Button variant="secondary" onClick={handleNewPuzzle}>
                New puzzle
              </Button>
            </div>
          ) : null}
        </div>

        {showControls ? (
          <Keyboard keyStates={NO_KEY_STATES} disabled={inputLocked} onKeyPress={handleKeyPress} />
        ) : null}
      </main>

      <WeaverHelpModal
        isOpen={isHelpOpen}
        length={length}
        onClose={() => {
          setHelpOpen(false);
        }}
      />
      <WeaverStatsModal
        isOpen={isStatsOpen}
        onClose={() => {
          setStatsOpen(false);
        }}
      />
      <ConfirmDialog
        isOpen={pending !== null}
        title={confirmCopy.title}
        confirmLabel={confirmCopy.confirm}
        destructive={confirmCopy.destructive}
        onConfirm={confirmPending}
        onCancel={() => {
          setPending(null);
        }}
      >
        {confirmCopy.body}
      </ConfirmDialog>
    </>
  );
}

/**
 * The WordWeaver view (`#/weaver`).
 *
 * Its providers mount only here, so leaving for Home or another game unmounts
 * them, which flushes the session first (FR-65, ADR-021).
 */
export function WeaverView(): React.JSX.Element {
  return (
    <WeaverStatsProvider>
      <WeaverProvider>
        <WeaverScreen />
      </WeaverProvider>
    </WeaverStatsProvider>
  );
}
