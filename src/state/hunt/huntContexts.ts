import { createContext, useContext } from 'react';

import type { HuntContextValue } from './HuntProvider';
import type { HuntStatsContextValue } from './HuntStatsProvider';

/**
 * WordHunt's contexts and hooks, apart from their providers so Fast Refresh
 * keeps working and the provider/hook import cycle never forms. Same pattern
 * as WordCode's `codeContexts.ts`.
 */

export const HuntContext = createContext<HuntContextValue | null>(null);
export const HuntStatsContext = createContext<HuntStatsContextValue | null>(null);

export function useHunt(): HuntContextValue {
  const value = useContext(HuntContext);
  if (!value) throw new Error('useHunt must be used within a HuntProvider');
  return value;
}

export function useHuntStats(): HuntStatsContextValue {
  const value = useContext(HuntStatsContext);
  if (!value) throw new Error('useHuntStats must be used within a HuntStatsProvider');
  return value;
}
