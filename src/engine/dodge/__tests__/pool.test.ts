import { describe, expect, it } from 'vitest';

import { candidatePool } from '../pool';

/** The candidate pool (T-104: FR-149). */

describe('candidatePool', () => {
  it('joins the answers and the shuffle list, sorted', () => {
    expect(candidatePool(['PLANT', 'MUSIC'], ['CRANE', 'STORM'])).toEqual([
      'CRANE',
      'MUSIC',
      'PLANT',
      'STORM',
    ]);
  });

  it('lists a word that is in both once', () => {
    expect(candidatePool(['PLANT', 'MUSIC'], ['MUSIC', 'PLANT', 'CRANE'])).toEqual([
      'CRANE',
      'MUSIC',
      'PLANT',
    ]);
  });

  it('gives the answers alone, sorted, when there is no shuffle list', () => {
    expect(candidatePool(['PLANT', 'MUSIC'])).toEqual(['MUSIC', 'PLANT']);
    expect(candidatePool(['PLANT', 'MUSIC'], undefined)).toEqual(['MUSIC', 'PLANT']);
  });

  it('does not change the lists it is given', () => {
    const answers = ['PLANT', 'MUSIC'];
    const shuffle = ['CRANE'];

    candidatePool(answers, shuffle);

    expect(answers).toEqual(['PLANT', 'MUSIC']);
    expect(shuffle).toEqual(['CRANE']);
  });

  it('is empty for two empty lists', () => {
    expect(candidatePool([], [])).toEqual([]);
  });
});
