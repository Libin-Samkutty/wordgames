import { createContext, useContext } from 'react';

import type { HangContextValue } from './HangProvider';
import type { HangStatsContextValue } from './HangStatsProvider';

/**
 * WordHang's contexts and hooks, apart from their providers so Fast Refresh
 * keeps working and the provider/hook import cycle never forms. Same pattern
 * as WordCode's `codeContexts.ts`.
 */

export const HangContext = createContext<HangContextValue | null>(null);
export const HangStatsContext = createContext<HangStatsContextValue | null>(null);

export function useHang(): HangContextValue {
  const value = useContext(HangContext);
  if (!value) throw new Error('useHang must be used within a HangProvider');
  return value;
}

export function useHangStats(): HangStatsContextValue {
  const value = useContext(HangStatsContext);
  if (!value) throw new Error('useHangStats must be used within a HangStatsProvider');
  return value;
}
