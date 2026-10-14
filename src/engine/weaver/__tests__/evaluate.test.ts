import { describe, expect, it } from 'vitest';

import { evaluateRung } from '../evaluate';

/** Rung evaluation: green or grey only (T-61: FR-81, ADR-026, AC-34). */
describe('evaluateRung', () => {
  it('marks CARD against WARM [absent, correct, correct, absent] (AC-34)', () => {
    expect(evaluateRung('CARD', 'WARM')).toEqual(['absent', 'correct', 'correct', 'absent']);
  });

  it('marks COLD against WARM all absent (AC-34)', () => {
    expect(evaluateRung('COLD', 'WARM')).toEqual(['absent', 'absent', 'absent', 'absent']);
  });

  it('marks the end word against itself all correct (FR-81)', () => {
    expect(evaluateRung('WARM', 'WARM')).toEqual(['correct', 'correct', 'correct', 'correct']);
  });

  it('compares by position: a letter elsewhere in the end word is absent, never present', () => {
    // M is in WARM, but at position 3; here it is at position 0.
    expect(evaluateRung('MOLD', 'WARM')).toEqual(['absent', 'absent', 'absent', 'absent']);
  });

  it('never produces a present state', () => {
    for (const rung of ['MARW', 'WRAM', 'ARMW', 'WARM', 'COLD']) {
      expect(evaluateRung(rung, 'WARM')).not.toContain('present');
    }
  });

  it('marks repeated letters independently by position', () => {
    expect(evaluateRung('BOOK', 'BOOT')).toEqual(['correct', 'correct', 'correct', 'absent']);
    expect(evaluateRung('BOKO', 'BOOT')).toEqual(['correct', 'correct', 'absent', 'absent']);
  });

  it('scores the start word the same way as any rung', () => {
    expect(evaluateRung('COLD', 'CORD')).toEqual(['correct', 'correct', 'absent', 'correct']);
  });

  it('works for 5-letter words', () => {
    expect(evaluateRung('CRANE', 'CRATE')).toEqual([
      'correct',
      'correct',
      'correct',
      'absent',
      'correct',
    ]);
  });

  it('returns one state per letter', () => {
    expect(evaluateRung('COLD', 'WARM')).toHaveLength(4);
    expect(evaluateRung('CRANE', 'SLOTH')).toHaveLength(5);
  });
});
