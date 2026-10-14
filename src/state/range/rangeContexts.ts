import { createContext, useContext } from 'react';

import type { RangeContextValue } from './RangeProvider';
import type { RangeStatsContextValue } from './RangeStatsProvider';

/**
 * WordRange's contexts and hooks, apart from their providers so Fast Refresh
 * keeps working and the provider/hook import cycle never forms. Same pattern
 * as WordStack's `stackContexts.ts`.
 */

export const RangeContext = createContext<RangeContextValue | null>(null);
export const RangeStatsContext = createContext<RangeStatsContextValue | null>(null);

export function useRange(): RangeContextValue {
  const value = useContext(RangeContext);
  if (!value) throw new Error('useRange must be used within a RangeProvider');
  return value;
}

export function useRangeStats(): RangeStatsContextValue {
  const value = useContext(RangeStatsContext);
  if (!value) throw new Error('useRangeStats must be used within a RangeStatsProvider');
  return value;
}
