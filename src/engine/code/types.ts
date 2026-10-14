import type { WordLength } from '../types';
import type { NOTE_MARKS } from './constants';

/** The player's own mark on a letter: ruled out, or in the word (FR-132). */
export type NoteMark = (typeof NOTE_MARKS)[number];

/**
 * The marks the player has set. A letter that is not a key is unmarked, so an
 * empty object is a clean notepad and the saved shape stays small.
 */
export type Notes = Readonly<Partial<Record<string, NoteMark>>>;

export type CodeStatus = 'playing' | 'won' | 'lost';

/** An accepted guess and what it scored (FR-129). */
export interface CodeGuess {
  /** Uppercase, exactly `wordLength` characters. */
  readonly word: string;
  /** Letters in the right place. */
  readonly bulls: number;
  /** Letters in the word but in the wrong place. */
  readonly cows: number;
}

/**
 * The complete state of one game. Serialised into LocalStorage for session
 * restore (FR-135), so every field is a plain JSON-safe value. The notes are
 * part of it, so a reload keeps them (EC-45).
 */
export interface CodeState {
  /** Stable id; the idempotency key for recording statistics (FR-134). */
  readonly id: string;
  readonly wordLength: WordLength;
  readonly secret: string;
  readonly guesses: readonly CodeGuess[];
  /** Letters typed into the active row but not yet submitted. */
  readonly currentInput: string;
  readonly notes: Notes;
  readonly status: CodeStatus;
  /** Epoch ms of the first keystroke; null until the player starts typing. */
  readonly startedAt: number | null;
  /** Epoch ms when the game reached `won` or `lost`. */
  readonly finishedAt: number | null;
}

/** A finished game, as recorded into statistics (FR-134). */
export interface CodeRecord {
  readonly id: string;
  readonly playedAt: number;
  readonly length: WordLength;
  readonly secret: string;
  readonly guessesUsed: number;
  readonly won: boolean;
  /**
   * The fields below were added later, so a row saved before then has none
   * (they read as undefined and are skipped when counting).
   */
  /** Time from the first keystroke to the end, in ms. */
  readonly solveMs?: number;
  /** The first guess whose bulls and cows added up to the word length, if any. */
  readonly lettersFoundAt?: number | null;
  /** Whether any letter was marked on the notepad. */
  readonly usedNotes?: boolean;
  /** The first word guessed. */
  readonly opener?: string;
}
