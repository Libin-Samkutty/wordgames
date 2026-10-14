import { useState } from 'react';

import type { WordLength } from '@/engine';
import { GameProvider, StatsProvider, useGame } from '@/state';

import { HeaderControls } from '../layout/HeaderControls';

import { HelpModal } from '../help/HelpModal';
import { HeaderIconButton } from '../layout/Header';
import { StatsModal } from '../stats/StatsModal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { GameView } from './GameView';
import { LengthSelector } from './LengthSelector';

type Pending = { kind: 'restart' } | { kind: 'length'; to: WordLength };

/** Everything inside Wordwright's own providers. */
function WordwrightScreen(): React.JSX.Element {
  const { state, wordLength, setWordLength, restart, dictionaryStatus } = useGame();

  const [isHelpOpen, setHelpOpen] = useState(false);
  const [isStatsOpen, setStatsOpen] = useState(false);

  // What the confirmation dialog is asking about, if anything (FR-34).
  const [pending, setPending] = useState<Pending | null>(null);

  // Abandoning is only costly once a guess has been made, and a finished game
  // has nothing left to abandon.
  const needsConfirm =
    state.guesses.length >= 1 && (state.status === 'playing' || state.status === 'revealing');

  const handleLengthChange = (length: WordLength): void => {
    if (length === wordLength) return;
    if (needsConfirm) setPending({ kind: 'length', to: length });
    else setWordLength(length);
  };

  const handleRestart = (): void => {
    if (needsConfirm) setPending({ kind: 'restart' });
    else restart();
  };

  const confirmPending = (): void => {
    if (pending?.kind === 'restart') restart();
    else if (pending?.kind === 'length') setWordLength(pending.to);
    setPending(null);
  };

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

        <HeaderIconButton
          label="New game"
          onClick={handleRestart}
          disabled={dictionaryStatus !== 'ready'}
        >
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
          value={wordLength}
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

      <GameView />

      <HelpModal
        isOpen={isHelpOpen}
        wordLength={wordLength}
        onClose={() => {
          setHelpOpen(false);
        }}
      />
      <StatsModal
        isOpen={isStatsOpen}
        onClose={() => {
          setStatsOpen(false);
        }}
      />
      <ConfirmDialog
        isOpen={pending !== null}
        title={
          pending?.kind === 'length'
            ? `Switch to ${String(pending.to)} letters?`
            : 'Start a new game?'
        }
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
 * The Wordwright view (`#/wordwright`).
 *
 * Its providers mount only here, so leaving for Home or another game unmounts
 * them, which flushes the session first (FR-65, ADR-021).
 */
export function WordwrightView(): React.JSX.Element {
  return (
    <StatsProvider>
      <GameProvider>
        <WordwrightScreen />
      </GameProvider>
    </StatsProvider>
  );
}
