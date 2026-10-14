import { useState } from 'react';

import { RECENT_GAMES_LIMIT } from '@/engine/constants';
import { STACK_MODE_IDS, STACK_MODES, type StackMode, type StackRecord } from '@/engine/stack';
import { formatAverage, formatDuration, formatNumber, formatPercent } from '@/lib/format';
import { useStackStats } from '@/state/stack';
import {
  STACK_MIN_WIN_GUESSES,
  averageTimedSolveMs,
  stackAverageBoardsOnLoss,
  stackAverageFirstBoard,
  stackSpareDistribution,
  stackWinPercentage,
  type StackModeStats,
  type StackStatsBucket,
} from '@/storage';

import { Distribution } from '../stats/Distribution';
import { ResetStatsSection } from '../stats/ResetStatsSection';
import { StatTile } from '../stats/StatTile';
import { ViewSwitcher } from '../stats/ViewSwitcher';
import { Modal } from '../ui/Modal';

type View = 'all' | StackMode;

const MODE_LABEL: Record<StackMode, string> = { duo: 'Duo', quad: 'Quad' };

const VIEWS: readonly { value: View; label: string }[] = [
  { value: 'all', label: 'All' },
  ...STACK_MODE_IDS.map((mode) => ({ value: mode, label: MODE_LABEL[mode] })),
];

/** Rows shown in the recent-games list; the log itself keeps 50 (FR-111). */
const RECENT_SHOWN = 8;

/** Mean guesses over a mode's wins, read off its distribution, or null with no wins. */
function averageWinGuesses(mode: StackMode, stats: StackModeStats): number | null {
  const wins = stats.distribution.reduce((sum, count) => sum + count, 0);
  if (wins === 0) return null;
  const first = STACK_MIN_WIN_GUESSES[mode];
  const total = stats.distribution.reduce((sum, count, index) => sum + count * (first + index), 0);
  return total / wins;
}

/** The row to mark for the game just finished: its guesses to spare, in the chosen view. */
function highlightFor(record: StackRecord | undefined, view: View): number | null {
  if (!record?.won || (view !== 'all' && record.mode !== view)) return null;
  // Rows run from the fewest guesses (most spare) down, in both modes.
  return record.guessesUsed - STACK_MIN_WIN_GUESSES[record.mode];
}

function BucketTiles({ bucket }: { bucket: StackStatsBucket }): React.JSX.Element {
  return (
    <dl className="grid grid-cols-4 gap-2">
      <StatTile label="Avg time" value={formatDuration(averageTimedSolveMs(bucket))} />
      <StatTile label="Fastest" value={formatDuration(bucket.fastestSolveMs)} />
      <StatTile label="So close" value={formatNumber(bucket.nearMisses)} />
      <StatTile label="First board by" value={formatAverage(stackAverageFirstBoard(bucket))} />
    </dl>
  );
}

export interface StackStatsModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

/**
 * WordStack statistics (FR-111, US-38): overall and per mode, the win
 * distribution for a chosen mode, recent games, an empty state that never shows
 * NaN (FR-41), and scoped reset actions that can only reach this game's data
 * (FR-47, FR-67).
 */
export function StackStatsModal({ isOpen, onClose }: StackStatsModalProps): React.JSX.Element {
  const { stats, resetStatistics, resetHistory } = useStackStats();
  const [view, setView] = useState<View>('all');

  const bucket = view === 'all' ? stats.overall : stats.perMode[view];
  const games = stats.recentGames.filter((record) => view === 'all' || record.mode === view);
  const hasGames = stats.overall.gamesPlayed > 0;
  const lastGame = stats.recentGames.at(0);

  return (
    <Modal isOpen={isOpen} title="Statistics" onClose={onClose}>
      {hasGames ? (
        <div className="flex flex-col gap-6">
          <ViewSwitcher views={VIEWS} value={view} onChange={setView} />

          <dl className="grid grid-cols-4 gap-2">
            <StatTile label="Played" value={formatNumber(bucket.gamesPlayed)} />
            <StatTile label="Win %" value={formatPercent(stackWinPercentage(bucket))} />
            <StatTile label="Current streak" value={formatNumber(bucket.currentStreak)} />
            <StatTile label="Best streak" value={formatNumber(bucket.bestStreak)} />
          </dl>

          <BucketTiles bucket={bucket} />

          {view === 'all' ? null : (
            <p className="text-sm text-text-muted">
              {`Average guesses on a win: ${formatAverage(averageWinGuesses(view, stats.perMode[view]))}. `}
              {`Boards solved in a loss: ${formatAverage(stackAverageBoardsOnLoss(bucket))}.`}
            </p>
          )}

          {view === 'all' ? (
            <section>
              <h3 className="mb-2 text-xs font-bold tracking-wide uppercase">
                Wins by guesses to spare
              </h3>
              <Distribution
                counts={stackSpareDistribution(stats)}
                labels={stackSpareDistribution(stats).map((_count, index, all) =>
                  String(all.length - 1 - index),
                )}
                highlightIndex={highlightFor(lastGame, view)}
              />
            </section>
          ) : (
            <section>
              <h3 className="mb-2 text-xs font-bold tracking-wide uppercase">
                {MODE_LABEL[view]} wins by guesses ({STACK_MIN_WIN_GUESSES[view]} to{' '}
                {STACK_MODES[view].maxGuesses})
              </h3>
              <Distribution
                counts={stats.perMode[view].distribution}
                firstLabel={STACK_MIN_WIN_GUESSES[view]}
                highlightIndex={highlightFor(lastGame, view)}
              />
            </section>
          )}

          {games.length > 0 ? (
            <section>
              <h3 className="mb-2 text-xs font-bold tracking-wide uppercase">Recent games</h3>
              <ul className="flex flex-col gap-1 text-sm">
                {games.slice(0, RECENT_SHOWN).map((record) => (
                  <li key={record.id} className="flex items-center justify-between gap-2">
                    <span className="font-mono tracking-wider uppercase">
                      {record.answers.join(' ')}
                    </span>
                    <span className="text-text-muted">
                      {MODE_LABEL[record.mode]} ·{' '}
                      {record.won
                        ? `${String(record.guessesUsed)}/${String(STACK_MODES[record.mode].maxGuesses)}`
                        : `${String(record.boardsSolved)}/${String(record.answers.length)} solved`}
                      {record.won && record.solveMs !== undefined
                        ? ` · ${formatDuration(record.solveMs)}`
                        : ''}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-text-muted">
                The last {RECENT_GAMES_LIMIT} games are kept.
              </p>
            </section>
          ) : null}
        </div>
      ) : (
        // FR-41: never show zeros and NaN to a first-time player.
        <p className="py-6 text-center text-sm text-text-muted">
          No games yet. Finish a game and your statistics will appear here.
        </p>
      )}

      {/* Offered whenever there is something to delete, including a kept history after a stats reset. */}
      {hasGames || stats.recentGames.length > 0 ? (
        <div className="mt-6">
          <ResetStatsSection
            statisticsDescription="games played, win percentages, streaks, times and the guess distributions"
            onResetStatistics={resetStatistics}
            onResetHistory={resetHistory}
          />
        </div>
      ) : null}
    </Modal>
  );
}
