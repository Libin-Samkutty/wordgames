import type { Evaluation, WordLength } from '../types';

/** `revealing` holds a just-answered guess while its tiles flip (FR-52). */
export type DodgeStatus = 'playing' | 'revealing' | 'won' | 'gave-up';

/** An accepted guess and the colours the game chose to answer with (FR-149). */
export interface DodgeGuess {
  /** Uppercase, exactly `wordLength` characters. */
  readonly word: string;
  readonly evaluation: Evaluation;
}

/**
 * What is saved for a game in progress (FR-153). The candidate words are not in
 * it: they follow from the guesses, so a restore rebuilds them (`restoreGame`).
 */
export interface DodgeSession {
  /** Stable id; the idempotency key for recording statistics (FR-155). */
  readonly id: string;
  readonly wordLength: WordLength;
  readonly guesses: readonly DodgeGuess[];
  /** Letters typed into the active row but not yet submitted. */
  readonly currentInput: string;
  readonly status: DodgeStatus;
  /** Epoch ms of the first keystroke; null until the player starts typing. */
  readonly startedAt: number | null;
  /** Epoch ms when the game reached `won` or `gave-up`. */
  readonly finishedAt: number | null;
}

/** The complete state of one game. */
export interface DodgeState extends DodgeSession {
  /**
   * Every answer still consistent with all the colours shown so far, in list
   * order. The game has not picked one of them yet (FR-149).
   */
  readonly candidates: readonly string[];
}

/** A finished game, as recorded into statistics (FR-155). */
export interface DodgeRecord {
  readonly id: string;
  readonly playedAt: number;
  readonly length: WordLength;
  /** The word found, or the word the game showed after a give up. */
  readonly word: string;
  readonly guessesUsed: number;
  readonly won: boolean;
  /** Time from the first keystroke to the end, in ms. */
  readonly solveMs: number;
  /** The first word guessed. */
  readonly opener?: string;
}
