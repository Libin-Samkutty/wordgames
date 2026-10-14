import { describe, expect, it } from 'vitest';

import { anagramKey, anagramsOf, buildAnagramIndex } from '../anagram';

/** The anagram index (T-88: FR-141, FR-144, ADR-032). */

describe('anagramKey', () => {
  it('is the letters in sorted order, the same for every anagram', () => {
    expect(anagramKey('LISTEN')).toBe('EILNST');
    expect(anagramKey('SILENT')).toBe('EILNST');
    expect(anagramKey('TINSEL')).toBe(anagramKey('LISTEN'));
  });

  it('keeps repeated letters, so a different multiset is a different key', () => {
    expect(anagramKey('SPEED')).toBe('DEEPS');
    expect(anagramKey('SPEND')).not.toBe(anagramKey('SPEED'));
  });

  it('is empty for an empty word', () => {
    expect(anagramKey('')).toBe('');
  });
});

describe('buildAnagramIndex and anagramsOf', () => {
  const index = buildAnagramIndex(['ENLIST', 'INLETS', 'LISTEN', 'PLANT', 'SILENT', 'TINSEL']);

  it('groups words with the same letters, in the order given', () => {
    expect(anagramsOf(index, 'LISTEN')).toEqual(['ENLIST', 'INLETS', 'LISTEN', 'SILENT', 'TINSEL']);
  });

  it('finds the group from any anagram, including one that is not listed', () => {
    expect(anagramsOf(index, 'ELINTS')).toEqual(anagramsOf(index, 'LISTEN'));
  });

  it('lists a word that has no anagram by itself', () => {
    expect(anagramsOf(index, 'PLANT')).toEqual(['PLANT']);
  });

  it('is empty for letters no word uses', () => {
    expect(anagramsOf(index, 'ZZZZZ')).toEqual([]);
    expect(anagramsOf(buildAnagramIndex([]), 'LISTEN')).toEqual([]);
  });

  it('accepts any iterable, such as a Set', () => {
    expect(anagramsOf(buildAnagramIndex(new Set(['SILENT', 'LISTEN'])), 'LISTEN')).toEqual([
      'SILENT',
      'LISTEN',
    ]);
  });
});
