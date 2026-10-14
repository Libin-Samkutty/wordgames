import { createContext } from 'react';

/**
 * The element inside the shell's header where a game puts its controls.
 *
 * The header belongs to the shell, but a game's controls (How to play, the
 * length selector, Statistics) need that game's context, which exists only
 * below the shell. A portal resolves both: the controls render inside the
 * header in the right tab order, yet read their own provider through React's
 * tree (FR-64, ARCHITECTURE §4.1).
 */
export const HeaderSlotContext = createContext<HTMLElement | null>(null);
