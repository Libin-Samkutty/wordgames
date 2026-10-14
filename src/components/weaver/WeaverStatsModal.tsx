import { useState } from 'react';

import { WEAVER_LENGTHS, type WeaverLength } from '@/engine/weaver';
import { RECENT_GAMES_LIMIT } from '@/engine/constants';
import { cn } from '@/lib/cn';
import { EMPTY_VALUE, formatAverage, formatNumber, formatPercent } from '@/lib/format';
import { useWeaverStats } from '@/state/weaver';
import {
  averageOverPar,
  weaverGaveUp,
  weaverSolvePercentage,
  type WeaverStatsBucket,
} from '@/storage';

import { ResetStatsSection } from '../stats/ResetStatsSection';
import { StatTile } from '../stats/StatTile';
import { Modal } from '../ui/Modal';

type View = 'all' | WeaverLength;

const VIEWS: readonly { value: View; label: string }[] = [
  { value: 'all', label: 'All' },
  ...WEAVER_LENGTHS.map((length) => ({ value: length, label: `${String(length)} letters` })),
];

/** Rows shown in the recent-games list; the log itself keeps 50 (FR-92). */
const RECENT_SHOWN = 8;

/** Average over par with an explicit sign, so +1.5 and -0.5 read as what they are. */
function formatOverPar(bucket: WeaverStatsBucket): string {
  const average = averageOverPar(bucket);
  if (average === null) return formatAverage(null);
  return `${average > 0 ? '+' : ''}${formatAverage(average)}`;
}

/** The best solve against par: `Par`, `-1` for one under, `+2` for two over, or the em dash. */
function formatBestVsPar(bucket: WeaverStatsBucket): string {
  const best = bucket.bestOverPar;
  if (best === null) return EMPTY_VALUE;
  if (best === 0) return 'Par';
  return best < 0 ? `−${String(-best)}` : `+${String(best)}`;
}

export interface WeaverStatsModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

/**
 * WordWeaver statistics (FR-92, US-30): the metrics overall and per length,
 * the recent puzzles, an empty state that never shows NaN (FR-41), and scoped
 * reset actions that can only reach this game's data (FR-47, FR-67).
 */
export function WeaverStatsModal({ isOpen, onClose }: WeaverStatsModalProps): React.JSX.Element {
  const { stats, resetStatistics, resetHistory } = useWeaverStats();
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

          <dl className="grid grid-cols-3 gap-x-2 gap-y-4">
            <StatTile label="Played" value={formatNumber(bucket.gamesPlayed)} />
            <StatTile label="Solved" value={formatNumber(bucket.gamesSolved)} />
            <StatTile label="Gave up" value={formatNumber(weaverGaveUp(bucket))} />
            <StatTile label="Solve %" value={formatPercent(weaverSolvePercentage(bucket))} />
            <StatTile label="Par hits" value={formatNumber(bucket.parHits)} />
            <StatTile label="Avg over par" value={formatOverPar(bucket)} />
            <StatTile label="Best vs par" value={formatBestVsPar(bucket)} />
            <StatTile label="Current streak" value={formatNumber(bucket.currentStreak)} />
            <StatTile label="Best streak" value={formatNumber(bucket.bestStreak)} />
          </dl>

          {games.length > 0 ? (
            <section>
              <h3 className="mb-2 text-xs font-bold tracking-wide uppercase">Recent puzzles</h3>
              <ul className="flex flex-col gap-1 text-sm">
                {games.slice(0, RECENT_SHOWN).map((record) => (
                  <li key={record.id} className="flex items-center justify-between gap-2">
                    <span className="font-mono tracking-wider uppercase">
                      {record.start} → {record.end}
                    </span>
                    <span className="text-text-muted">
                      {record.solved ? `${String(record.moves)}/${String(record.par)}` : 'Gave up'}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-text-muted">
                Moves against par. The last {RECENT_GAMES_LIMIT} puzzles are kept.
              </p>
            </section>
          ) : null}
        </div>
      ) : (
        // FR-41: never show zeros and NaN to a first-time player.
        <p className="py-6 text-center text-sm text-text-muted">
          No puzzles yet. Finish a puzzle and your statistics will appear here.
        </p>
      )}

      {/* Offered whenever there is something to delete, including a kept history after a stats reset. */}
      {hasGames || stats.recentGames.length > 0 ? (
        <div className="mt-6">
          <ResetStatsSection
            statisticsDescription="puzzles played, solved and given up, par hits, average over par and streaks"
            onResetStatistics={resetStatistics}
            onResetHistory={resetHistory}
          />
        </div>
      ) : null}
    </Modal>
  );
}
