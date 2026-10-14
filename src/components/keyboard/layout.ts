import type { KeyValue } from './Key';

/**
 * The on-screen keyboard layout, shared by every game's keyboard (QWERTY with
 * Enter and Backspace on the bottom row). Kept apart from the components so a
 * game with its own key component, such as WordStack's split keys, lays out
 * exactly like the rest without forking this list.
 */
export const KEYBOARD_ROWS: readonly (readonly KeyValue[])[] = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACKSPACE'],
];
