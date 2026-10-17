import { createContext, useContext } from 'react';

import type { DodgeContextValue } from './DodgeProvider';
import type { DodgeStatsContextValue } from './DodgeStatsProvider';

/**
 * WordDodge's contexts and hooks, apart from their providers so Fast Refresh
 * keeps working and the provider/hook import cycle never forms. Same pattern
 * as WordCode's `codeContexts.ts`.
 */

export const DodgeContext = createContext<DodgeContextValue | null>(null);
export const DodgeStatsContext = createContext<DodgeStatsContextValue | null>(null);

export function useDodge(): DodgeContextValue {
  const value = useContext(DodgeContext);
  if (!value) throw new Error('useDodge must be used within a DodgeProvider');
  return value;
}

export function useDodgeStats(): DodgeStatsContextValue {
  const value = useContext(DodgeStatsContext);
  if (!value) throw new Error('useDodgeStats must be used within a DodgeStatsProvider');
  return value;
}
