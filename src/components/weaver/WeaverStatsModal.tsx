import { useState } from 'react';

import { WEAVER_LENGTHS, overParBucketIndex, type WeaverLength } from '@/engine/weaver';
import { RECENT_GAMES_LIMIT } from '@/engine/constants';
import {
  EMPTY_VALUE,
  formatAverage,
  formatDuration,
  formatNumber,
  formatPercent,
} from '@/lib/format';
import { useWeaverStats } from '@/state/weaver';
import {
  averageOverPar,
  averageTimedSolveMs,
  weaverAverageUndos,
  weaverDetailSolves,
  weaverGaveUp,
  weaverSolvePercentage,
  type WeaverStatsBucket,
} from '@/storage';

import { Distribution } from '../stats/Distribution';
import { ResetStatsSection } from '../stats/ResetStatsSection';
import { StatTile } from '../stats/StatTile';
import { ViewSwitcher } from '../stats/ViewSwitcher';
import { Modal } from '../ui/Modal';

type View = 'all' | WeaverLength;

const VIEWS: readonly { value: View; label: string }[] = [
  { value: 'all', label: 'All' },
  ...WEAVER_LENGTHS.map((length) => ({ value: length, label: `${String(length)} letters` })),
];

const OVER_PAR_LABELS = ['Par', '+1', '+2', '+3', '+4 +'] as const;

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

  // Mark the bar of the puzzle just solved, when it is in the chosen view.
  const lastGame = stats.recentGames.at(0);
  const highlightIndex =
    lastGame?.solved && (view === 'all' || lastGame.length === view)
      ? overParBucketIndex(lastGame.moves - lastGame.par)
      : null;

  return (
    <Modal isOpen={isOpen} title="Statistics" onClose={onClose}>
      {hasGames ? (
        <div className="flex flex-col gap-6">
          <ViewSwitcher views={VIEWS} value={view} onChange={setView} />

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
            <StatTile label="Avg time" value={formatDuration(averageTimedSolveMs(bucket))} />
            <StatTile label="Fastest" value={formatDuration(bucket.fastestSolveMs)} />
            <StatTile label="Undos per solve" value={formatAverage(weaverAverageUndos(bucket))} />
          </dl>

          {weaverDetailSolves(bucket) > 0 ? (
            <section>
              <h3 className="mb-2 text-xs font-bold tracking-wide uppercase">
                Solves by moves over par
              </h3>
              <Distribution
                counts={bucket.overParDistribution}
                labels={OVER_PAR_LABELS}
                highlightIndex={highlightIndex}
              />
              {bucket.hardestParSolved === null ? null : (
                <p className="mt-2 text-sm text-text-muted">
                  Hardest puzzle solved: par {bucket.hardestParSolved}.
                </p>
              )}
            </section>
          ) : null}

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
                      {record.solved && record.solveMs !== undefined
                        ? ` · ${formatDuration(record.solveMs)}`
                        : ''}
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
            statisticsDescription="puzzles played, solved and given up, par hits, times, average over par and streaks"
            onResetStatistics={resetStatistics}
            onResetHistory={resetHistory}
          />
        </div>
      ) : null}
    </Modal>
  );
}
