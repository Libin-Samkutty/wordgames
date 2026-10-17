import { useCallback, useState } from 'react';

import type { WordLength } from '@/engine';
import { HANG_LENGTHS, missedLetters, misses } from '@/engine/hang';
import { usePhysicalKeyboard } from '@/hooks/usePhysicalKeyboard';
import { clampDuration } from '@/lib/clock';
import { useSettings } from '@/state';
import { HangProvider, HangStatsProvider, useHang } from '@/state/hang';

import { BoardSkeleton } from '../board/BoardSkeleton';
import { DictionaryError } from '../game/DictionaryError';
import { LengthSelector } from '../game/LengthSelector';
import { HeaderIconButton } from '../layout/Header';
import { HeaderControls } from '../layout/HeaderControls';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { HangFigure } from './HangFigure';
import { HangHelpModal } from './HangHelpModal';
import { HangKeyboard } from './HangKeyboard';
import { missesLabel } from './hangLabels';
import { HangResultPanel } from './HangResultPanel';
import { HangStatsModal } from './HangStatsModal';
import { HangWord } from './HangWord';

type Pending = { readonly kind: 'restart' } | { readonly kind: 'length'; readonly to: WordLength };

/** Does nothing: a guess needs no Enter and no Backspace (FR-169). */
function ignore(): void {
  /* nothing to do */
}

/** A row is never "empty" here, so a focused button always keeps its own Enter. */
function alwaysEmpty(): boolean {
  return true;
}

/** Everything inside WordHang's own providers. */
function HangScreen(): React.JSX.Element {
  const {
    state,
    length,
    dictionaryStatus,
    isGameOver,
    letterStates,
    announcement,
    guessLetter,
    restart,
    setLength,
    retryDictionary,
  } = useHang();
  const { prefersReducedMotion } = useSettings();

  const [isHelpOpen, setHelpOpen] = useState(false);
  const [isStatsOpen, setStatsOpen] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);

  const isReady = dictionaryStatus === 'ready';
  // Input is locked while loading and once the game ends.
  const inputLocked = isGameOver || !isReady;

  // Abandoning is only costly once a letter has been tried, and a finished game
  // has nothing left to abandon (FR-173).
  const needsConfirm = state.tried.length >= 1 && !isGameOver;

  usePhysicalKeyboard({
    onLetter: guessLetter,
    onBackspace: ignore,
    onEnter: ignore,
    isRowEmpty: alwaysEmpty,
    disabled: inputLocked,
  });

  const handleGuess = useCallback(
    (letter: string): void => {
      if (!inputLocked) guessLetter(letter);
    },
    [inputLocked, guessLetter],
  );

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
    const missed = missedLetters(state);

    body = (
      <>
        <div className="flex items-center justify-center gap-6">
          <HangFigure misses={misses(state)} />
          <div className="flex min-w-0 flex-col gap-1 text-sm">
            <p className="font-bold tabular-nums">{missesLabel(state)}</p>
            <p className="text-text-muted">
              {missed.length === 0 ? (
                'No wrong letters yet'
              ) : (
                <>
                  Wrong:{' '}
                  <span className="font-mono font-bold tracking-widest">{missed.join(' ')}</span>
                </>
              )}
            </p>
          </div>
        </div>

        <HangWord state={state} reducedMotion={prefersReducedMotion} />

        {isGameOver ? (
          <HangResultPanel
            won={state.status === 'won'}
            length={length}
            secret={state.secret}
            misses={misses(state)}
            elapsedMs={
              state.startedAt === null
                ? null
                : clampDuration((state.finishedAt ?? 0) - state.startedAt)
            }
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
          lengths={HANG_LENGTHS}
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
        {/* A11Y-27: one polite region, one message per letter. */}
        <div role="status" aria-live="polite" className="sr-only">
          {/* A trailing space makes a repeated message differ, so it is read again. */}
          {announcement.text}
          {announcement.flip ? ' ' : ''}
        </div>

        <div className="flex w-full flex-1 flex-col items-center justify-center gap-4">{body}</div>

        {isReady && !isGameOver ? (
          <HangKeyboard letterStates={letterStates} disabled={inputLocked} onGuess={handleGuess} />
        ) : null}
      </main>

      <HangHelpModal
        isOpen={isHelpOpen}
        length={length}
        onClose={() => {
          setHelpOpen(false);
        }}
      />
      <HangStatsModal
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
 * The WordHang view (`#/hang`).
 *
 * Its providers mount only here, so leaving for Home or another game unmounts
 * them, which flushes the session first (FR-65, ADR-021).
 */
export function HangView(): React.JSX.Element {
  return (
    <HangStatsProvider>
      <HangProvider>
        <HangScreen />
      </HangProvider>
    </HangStatsProvider>
  );
}
