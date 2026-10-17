import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { HuntRecord } from '@/engine/hunt';
import {
  createHuntStatsRepository,
  recordHuntGame,
  resetHuntHistory,
  resetHuntStatistics,
  type HuntStatsState,
} from '@/storage';

import { reportStorageIssue } from '../storageIssues';
import { HuntStatsContext } from './huntContexts';

export interface HuntStatsContextValue {
  readonly stats: HuntStatsState;
  /** Idempotent by game id (FR-165). */
  readonly recordGame: (record: HuntRecord) => void;
  readonly resetStatistics: () => void;
  readonly resetHistory: () => void;
}

/**
 * WordHunt's statistics, apart from every other game's (FR-67, FR-165).
 * Resetting these can only reach `wordgames:v1:hunt:stats`.
 */
export function HuntStatsProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [repository] = useState(() => createHuntStatsRepository(reportStorageIssue));
  const [stats, setStats] = useState<HuntStatsState>(() => repository.read());

  // Another tab finished a puzzle (EC-16, EC-28).
  useEffect(() => repository.subscribe(setStats), [repository]);

  const commit = useCallback(
    (transform: (current: HuntStatsState) => HuntStatsState): void => {
      setStats((current) => {
        const next = transform(current);
        // Nothing changed (a duplicate record); skip the write and the re-render.
        if (next === current) return current;

        repository.write(next);
        return next;
      });
    },
    [repository],
  );

  const value = useMemo<HuntStatsContextValue>(
    () => ({
      stats,
      recordGame: (record) => {
        commit((current) => recordHuntGame(current, record));
      },
      resetStatistics: () => {
        commit(resetHuntStatistics);
      },
      resetHistory: () => {
        commit(resetHuntHistory);
      },
    }),
    [stats, commit],
  );

  return <HuntStatsContext.Provider value={value}>{children}</HuntStatsContext.Provider>;
}
