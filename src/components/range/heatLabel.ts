import { HEAT_LEVELS, type Heat } from '@/engine/range';

/** The heat level as a word, since colour never carries it alone (FR-121, A11Y-22). */
export const HEAT_LABEL: Record<Heat, string> = {
  burning: 'Burning',
  hot: 'Hot',
  warm: 'Warm',
  cold: 'Cold',
  freezing: 'Freezing',
};

/** Filled pips out of five: Burning is 5, Freezing is 1. A second cue beside the word. */
export function heatPips(heat: Heat): number {
  return HEAT_LEVELS.length - HEAT_LEVELS.indexOf(heat);
}
