import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { WeaverRecord } from '@/engine/weaver';
import {
  createWeaverStatsRepository,
  recordWeaverGame,
  resetWeaverHistory,
  resetWeaverStatistics,
  type WeaverStatsState,
} from '@/storage';

import { reportStorageIssue } from '../storageIssues';
import { WeaverStatsContext } from './weaverContexts';

export interface WeaverStatsContextValue {
  readonly stats: WeaverStatsState;
  /** Idempotent by game id (FR-92). */
  readonly recordGame: (record: WeaverRecord) => void;
  readonly resetStatistics: () => void;
  readonly resetHistory: () => void;
}

/**
 * WordWeaver's statistics, apart from Wordwright's (FR-67, FR-92). Resetting
 * these can only reach `wordgames:v1:weaver:stats`.
 */
export function WeaverStatsProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [repository] = useState(() => createWeaverStatsRepository(reportStorageIssue));
  const [stats, setStats] = useState<WeaverStatsState>(() => repository.read());

  // Another tab finished a puzzle (EC-16, EC-28).
  useEffect(() => repository.subscribe(setStats), [repository]);

  const commit = useCallback(
    (transform: (current: WeaverStatsState) => WeaverStatsState): void => {
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

  const value = useMemo<WeaverStatsContextValue>(
    () => ({
      stats,
      recordGame: (record) => {
        commit((current) => recordWeaverGame(current, record));
      },
      resetStatistics: () => {
        commit(resetWeaverStatistics);
      },
      resetHistory: () => {
        commit(resetWeaverHistory);
      },
    }),
    [stats, commit],
  );

  return <WeaverStatsContext.Provider value={value}>{children}</WeaverStatsContext.Provider>;
}
