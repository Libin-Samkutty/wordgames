import { useState } from 'react';

import { RECENT_GAMES_LIMIT } from '@/engine/constants';
import { CODE_LENGTHS, CODE_MAX_GUESSES } from '@/engine/code';
import type { WordLength } from '@/engine';
import { cn } from '@/lib/cn';
import { formatNumber, formatPercent } from '@/lib/format';
import { useCodeStats } from '@/state/code';
import { codeWinPercentage } from '@/storage';

import { ResetStatsSection } from '../stats/ResetStatsSection';
import { StatTile } from '../stats/StatTile';
import { Modal } from '../ui/Modal';

type View = 'all' | WordLength;

const VIEWS: readonly { value: View; label: string }[] = [
  { value: 'all', label: 'All' },
  ...CODE_LENGTHS.map((length) => ({ value: length, label: `${String(length)} letters` })),
];

/** Rows shown in the recent-games list; the log itself keeps 50 (FR-134). */
const RECENT_SHOWN = 8;

/** Wins by guess count, 1 to 10 (FR-134). */
function Distribution({ counts }: { counts: readonly number[] }): React.JSX.Element {
  const max = Math.max(1, ...counts);

  return (
    <div className="flex flex-col gap-1">
      {counts.map((count, index) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <span className="w-4 tabular-nums">{index + 1}</span>
          <div className="flex-1">
            <div
              className="flex justify-end rounded-sm bg-tile-absent px-1.5 py-0.5 text-xs font-bold text-tile-text-revealed data-[has-count=true]:bg-tile-correct"
              style={{ width: `${String(Math.max(7, (count / max) * 100))}%` }}
              data-has-count={count > 0}
            >
              {count}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export interface CodeStatsModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

/**
 * WordCode statistics (FR-134, US-38): overall and per length, the win
 * distribution over guesses 1 to 10, recent games, an empty state that never
 * shows NaN (FR-41), and scoped reset actions that can only reach this game's
 * data (FR-47, FR-67).
 */
export function CodeStatsModal({ isOpen, onClose }: CodeStatsModalProps): React.JSX.Element {
  const { stats, resetStatistics, resetHistory } = useCodeStats();
  const [view, setView] = useState<View>('all');

  const bucket = view === 'all' ? stats.overall : stats.perLength[view];
  const games = stats.recentGames.filter((record) => view === 'all' || record.length === view);
  const hasGames = stats.overall.gamesPlayed > 0;

  return (
    <Modal isOpen={isOpen} title="Statistics" onClose={onClose}>
      {hasGames ? (
        <div className="flex flex-col gap-6">
          <div role="radiogroup" aria-label="Statistics for" className="flex gap-1">
            {VIEWS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={view === value}
                onClick={() => {
                  setView(value);
                }}
                className={cn(
                  'min-h-9 rounded px-2.5 text-xs font-semibold text-text-muted',
                  'aria-checked:bg-surface-sunken aria-checked:text-text',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <dl className="grid grid-cols-4 gap-2">
            <StatTile label="Played" value={formatNumber(bucket.gamesPlayed)} />
            <StatTile label="Win %" value={formatPercent(codeWinPercentage(bucket))} />
            <StatTile label="Current streak" value={formatNumber(bucket.currentStreak)} />
            <StatTile label="Best streak" value={formatNumber(bucket.bestStreak)} />
          </dl>

          <section>
            <h3 className="mb-2 text-xs font-bold tracking-wide uppercase">
              Wins by guesses (1 to {CODE_MAX_GUESSES})
            </h3>
            <Distribution counts={bucket.distribution} />
          </section>

          {games.length > 0 ? (
            <section>
              <h3 className="mb-2 text-xs font-bold tracking-wide uppercase">Recent games</h3>
              <ul className="flex flex-col gap-1 text-sm">
                {games.slice(0, RECENT_SHOWN).map((record) => (
                  <li key={record.id} className="flex items-center justify-between gap-2">
                    <span className="font-mono tracking-wider uppercase">{record.secret}</span>
                    <span className="text-text-muted">
                      {record.won
                        ? `${String(record.guessesUsed)}/${String(CODE_MAX_GUESSES)}`
                        : 'Not found'}
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
            statisticsDescription="games played, win percentages, streaks and the guess distributions"
            onResetStatistics={resetStatistics}
            onResetHistory={resetHistory}
          />
        </div>
      ) : null}
    </Modal>
  );
}
