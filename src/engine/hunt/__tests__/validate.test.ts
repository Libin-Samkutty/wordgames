import { describe, expect, it } from 'vitest';

import { createHuntGame } from '../reducer';
import type { HuntState } from '../types';
import { isFormableFrom, validateWord } from '../validate';

/** The word check (T-96: FR-161). */

const state = (over: Partial<HuntState> = {}): HuntState => ({
  ...createHuntGame('g', {
    seed: 'STAPLE',
    tray: 'PLATES',
    required: ['LEAP', 'PALE', 'STALE'],
  }),
  ...over,
});

const isWord = (word: string): boolean => ['LEAP', 'PALE', 'STALE', 'PEAL', 'SALEP'].includes(word);

describe('isFormableFrom', () => {
  it('is true when the letters are in the tray, each used no more often than it appears', () => {
    expect(isFormableFrom('LEAP', 'PLATES')).toBe(true);
    expect(isFormableFrom('PLATES', 'PLATES')).toBe(true);
  });

  it('is false for a letter the tray lacks', () => {
    expect(isFormableFrom('LEAK', 'PLATES')).toBe(false);
  });

  it('is false for a letter used more often than the tray has it', () => {
    expect(isFormableFrom('PEEL', 'PLATES')).toBe(false);
    expect(isFormableFrom('SASS', 'PLATES')).toBe(false);
  });

  it('counts a repeated letter in the tray', () => {
    expect(isFormableFrom('EASE', 'SEAELE')).toBe(true);
  });
});

describe('validateWord, in the FR-161 order', () => {
  it('rejects a word under four letters first, even if it is also not from the tray', () => {
    expect(validateWord('QI', state(), isWord)).toEqual({ ok: false, error: 'too-short' });
    expect(validateWord('', state(), isWord)).toEqual({ ok: false, error: 'too-short' });
  });

  it('then a word the tray cannot spell, even if it is also not a word', () => {
    expect(validateWord('ZZZZ', state(), isWord)).toEqual({ ok: false, error: 'not-from-tray' });
  });

  it('then a word already found, as a required word or a bonus one', () => {
    expect(validateWord('LEAP', state({ found: ['LEAP'] }), isWord)).toEqual({
      ok: false,
      error: 'already-found',
    });
    expect(validateWord('PEAL', state({ bonus: ['PEAL'] }), isWord)).toEqual({
      ok: false,
      error: 'already-found',
    });
  });

  it('then a word that is not in the list', () => {
    expect(validateWord('TALP', state(), isWord)).toEqual({ ok: false, error: 'not-a-word' });
  });

  it('accepts a required word, and says so', () => {
    expect(validateWord('leap', state(), isWord)).toEqual({
      ok: true,
      value: { word: 'LEAP', isRequired: true },
    });
  });

  it('accepts a valid word that is not required as a bonus word', () => {
    expect(validateWord('PEAL', state(), isWord)).toEqual({
      ok: true,
      value: { word: 'PEAL', isRequired: false },
    });
  });
});
