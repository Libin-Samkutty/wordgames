import { createContext, useContext } from 'react';

import type { CodeContextValue } from './CodeProvider';
import type { CodeStatsContextValue } from './CodeStatsProvider';

/**
 * WordCode's contexts and hooks, apart from their providers so Fast Refresh
 * keeps working and the provider/hook import cycle never forms. Same pattern
 * as WordStack's `stackContexts.ts`.
 */

export const CodeContext = createContext<CodeContextValue | null>(null);
export const CodeStatsContext = createContext<CodeStatsContextValue | null>(null);

export function useCode(): CodeContextValue {
  const value = useContext(CodeContext);
  if (!value) throw new Error('useCode must be used within a CodeProvider');
  return value;
}

export function useCodeStats(): CodeStatsContextValue {
  const value = useContext(CodeStatsContext);
  if (!value) throw new Error('useCodeStats must be used within a CodeStatsProvider');
  return value;
}
