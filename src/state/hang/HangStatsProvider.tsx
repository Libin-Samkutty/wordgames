import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { HangRecord } from '@/engine/hang';
import {
  createHangStatsRepository,
  recordHangGame,
  resetHangHistory,
  resetHangStatistics,
  type HangStatsState,
} from '@/storage';

import { reportStorageIssue } from '../storageIssues';
import { HangStatsContext } from './hangContexts';

export interface HangStatsContextValue {
  readonly stats: HangStatsState;
  /** Idempotent by game id (FR-174). */
  readonly recordGame: (record: HangRecord) => void;
  readonly resetStatistics: () => void;
  readonly resetHistory: () => void;
}

/**
 * WordHang's statistics, apart from every other game's (FR-67, FR-174).
 * Resetting these can only reach `wordgames:v1:hang:stats`.
 */
export function HangStatsProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [repository] = useState(() => createHangStatsRepository(reportStorageIssue));
  const [stats, setStats] = useState<HangStatsState>(() => repository.read());

  // Another tab finished a game (EC-16, EC-28).
  useEffect(() => repository.subscribe(setStats), [repository]);

  const commit = useCallback(
    (transform: (current: HangStatsState) => HangStatsState): void => {
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

  const value = useMemo<HangStatsContextValue>(
    () => ({
      stats,
      recordGame: (record) => {
        commit((current) => recordHangGame(current, record));
      },
      resetStatistics: () => {
        commit(resetHangStatistics);
      },
      resetHistory: () => {
        commit(resetHangHistory);
      },
    }),
    [stats, commit],
  );

  return <HangStatsContext.Provider value={value}>{children}</HangStatsContext.Provider>;
}
