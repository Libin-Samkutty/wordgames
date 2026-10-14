import { describe, expect, it } from 'vitest';

import { validateAnswer, type AnswerContext } from '../validate';

/** Answer validation in the FR-140 order (T-88: FR-140, FR-141, EC-47, EC-48, AC-54). */

const WORDS = new Set(['ENLIST', 'LISTEN', 'SILENT', 'TINSEL']);

function context(over: Partial<AnswerContext> = {}): AnswerContext {
  return { target: 'LISTEN', hinted: [], isAllowed: (word) => WORDS.has(word), ...over };
}

const row = (word: string): (string | null)[] => [...word];

describe('validateAnswer (FR-140)', () => {
  it('accepts a full row that is a word', () => {
    expect(validateAnswer(row('LISTEN'), context())).toEqual({ ok: true, value: 'LISTEN' });
  });

  it('accepts a different anagram, not only the target (FR-141, EC-47, AC-53)', () => {
    expect(validateAnswer(row('SILENT'), context())).toEqual({ ok: true, value: 'SILENT' });
  });

  it('1. rejects a row with an empty slot as too-short', () => {
    expect(validateAnswer(['L', 'I', null, 'T', 'E', 'N'], context())).toEqual({
      ok: false,
      error: 'too-short',
    });
    expect(validateAnswer([null, null, null, null, null, null], context())).toEqual({
      ok: false,
      error: 'too-short',
    });
  });

  it('2. rejects an answer that moves a hinted letter as hint-moved (AC-54, EC-48)', () => {
    // The first letter is hinted as L, and SILENT starts with S.
    expect(validateAnswer(row('SILENT'), context({ hinted: [0] }))).toEqual({
      ok: false,
      error: 'hint-moved',
    });
  });

  it('2. accepts an anagram that keeps the hinted letters in place', () => {
    // TINSEL ends in L, but the hint is on the last letter N: LISTEN ends in N, TINSEL does not.
    expect(validateAnswer(row('LISTEN'), context({ hinted: [0, 5] }))).toEqual({
      ok: true,
      value: 'LISTEN',
    });
    expect(validateAnswer(row('ENLIST'), context({ hinted: [0] }))).toEqual({
      ok: false,
      error: 'hint-moved',
    });
  });

  it('3. rejects a word that is not in the guess list as not-a-word', () => {
    expect(validateAnswer(row('ELINTS'), context())).toEqual({ ok: false, error: 'not-a-word' });
  });

  it('reports rules in order: an empty slot beats a moved hint', () => {
    expect(validateAnswer(['S', null, null, null, null, null], context({ hinted: [0] }))).toEqual({
      ok: false,
      error: 'too-short',
    });
  });

  it('reports a moved hint before an unknown word', () => {
    expect(validateAnswer(row('NTLISE'), context({ hinted: [0] }))).toEqual({
      ok: false,
      error: 'hint-moved',
    });
  });
});
