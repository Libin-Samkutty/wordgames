import { describe, expect, it } from 'vitest';

import { evaluateGuess } from '../../evaluate';
import { chooseReply, isAllCorrect } from '../adversary';

/** The adversary (T-92: FR-149, AC-58). */

describe('chooseReply', () => {
  it('keeps the largest group of words that share a reply', () => {
    // PLANK scores PLANT, PLANE and PLANS alike (four green, K grey).
    // STORM and MUSIC share a different reply (all grey), and there are fewer of them.
    const candidates = ['PLANT', 'STORM', 'MUSIC', 'PLANE', 'PLANS'];
    const reply = chooseReply('PLANK', candidates);

    expect(reply.candidates).toEqual(['PLANT', 'PLANE', 'PLANS']);
    expect(reply.evaluation).toEqual(evaluateGuess('PLANK', 'PLANT'));
  });

  it('always returns a reply that every surviving word would have got', () => {
    const candidates = ['LAMB', 'PLUM', 'SLAB', 'CLAM', 'BALM', 'LAMP'];
    const reply = chooseReply('BLAM', candidates);

    for (const word of reply.candidates) {
      expect(evaluateGuess('BLAM', word)).toEqual(reply.evaluation);
    }
  });

  it('on a tie in size, gives away less: fewer greens and yellows win', () => {
    // Guess AB: AB would be all green, BA would be two yellows. One word each.
    const reply = chooseReply('AB', ['AB', 'BA']);

    expect(reply.candidates).toEqual(['BA']);
    expect(reply.evaluation).toEqual(['present', 'present']);
  });

  it('on a tie in size, a reply with no hits beats one with hits', () => {
    // PLANK splits these two and two: ccccA for PLANT and PLANE, all grey for STORM and MUSIC.
    const reply = chooseReply('PLANK', ['PLANT', 'PLANE', 'STORM', 'MUSIC']);

    expect(reply.candidates).toEqual(['STORM', 'MUSIC']);
    expect(reply.evaluation.every((state) => state === 'absent')).toBe(true);
  });

  it('on a tie in size and hits, takes the smaller pattern key, whatever the order', () => {
    // Guess AB. AC gets green then grey ("ca") and CB gets grey then green ("ac").
    // One word each and two hits each, so the smaller key "ac" wins.
    const reply = chooseReply('AB', ['AC', 'CB']);

    expect(reply.candidates).toEqual(['CB']);
    expect(reply.evaluation).toEqual(['absent', 'correct']);
    expect(chooseReply('AB', ['CB', 'AC']).candidates).toEqual(['CB']);
  });

  it('keeps words that share a reply in the order they came in', () => {
    const first = chooseReply('ZZ', ['AB', 'CD']);
    const second = chooseReply('ZZ', ['CD', 'AB']);

    expect(first.candidates).toEqual(['AB', 'CD']);
    expect(second.candidates).toEqual(['CD', 'AB']);
  });

  it('follows the Wordle scorer for repeated letters', () => {
    const candidates = ['ERASE', 'ABIDE', 'SPEED', 'STEEL'];
    const reply = chooseReply('EERIE', candidates);

    for (const word of reply.candidates) {
      expect(evaluateGuess('EERIE', word)).toEqual(reply.evaluation);
    }
  });

  it('is all green only when the guess is the last word standing', () => {
    const reply = chooseReply('PLANT', ['PLANT']);

    expect(reply.candidates).toEqual(['PLANT']);
    expect(isAllCorrect(reply.evaluation)).toBe(true);
  });

  it('is not all green while another word is still possible', () => {
    const reply = chooseReply('PLANT', ['PLANT', 'PLANE']);

    expect(isAllCorrect(reply.evaluation)).toBe(false);
    expect(reply.candidates).toEqual(['PLANE']);
  });

  it('throws when there are no words to answer with', () => {
    expect(() => chooseReply('PLANT', [])).toThrow('at least one candidate');
  });
});

describe('isAllCorrect', () => {
  it('is true only when every letter is correct', () => {
    expect(isAllCorrect(['correct', 'correct'])).toBe(true);
    expect(isAllCorrect(['correct', 'present'])).toBe(false);
    expect(isAllCorrect(['absent', 'absent'])).toBe(false);
  });
});
