import { describe, expect, it } from 'vitest';

import type { RawLists } from '../types';
import { listProblems } from './listInvariants';

/**
 * The invariant checker has to be able to fail, or a passing data test proves
 * nothing (T-58). Each case corrupts a sound fixture in exactly one way.
 */

const SOUND: RawLists = {
  answers: ['COLD', 'WARM'],
  ladder: ['CARD', 'COLD', 'CORD', 'WARD', 'WARM'],
  guesses: ['CARD', 'COLD', 'CORD', 'WARD', 'WARM', 'WORD'],
};

function withLadder(ladder: string[]): RawLists {
  return { ...SOUND, ladder };
}

describe('listProblems', () => {
  it('accepts sound lists', () => {
    expect(listProblems(SOUND, 4)).toEqual([]);
  });

  it('accepts a sound shuffle list', () => {
    expect(listProblems({ ...SOUND, shuffle: ['CARD', 'WORD'] }, 4)).toEqual([]);
  });

  it('accepts lists with no ladder, as for 6 letters', () => {
    const withoutLadder: RawLists = { answers: SOUND.answers, guesses: SOUND.guesses };

    expect(listProblems(withoutLadder, 4)).toEqual([]);
  });

  it.each<[string, RawLists, string]>([
    [
      'a lowercase ladder word',
      withLadder(['CARD', 'COLD', 'CORD', 'WARD', 'warm']),
      'ladder is not uppercase A-Z',
    ],
    [
      'a wrong-length ladder word',
      withLadder(['CARD', 'COLD', 'CORDS', 'WARD', 'WARM']),
      'ladder has a word that is not 4 letters',
    ],
    [
      'a duplicate ladder word',
      withLadder(['CARD', 'COLD', 'COLD', 'WARD', 'WARM']),
      'ladder has duplicates',
    ],
    [
      'an unsorted ladder',
      withLadder(['COLD', 'CARD', 'CORD', 'WARD', 'WARM']),
      'ladder is not sorted',
    ],
    ['an empty ladder', withLadder([]), 'ladder is empty'],
    [
      'an answer missing from the ladder',
      withLadder(['CARD', 'COLD', 'CORD', 'WARD']),
      'an answer is not in ladder',
    ],
    [
      'a ladder word missing from the guesses',
      withLadder(['CARD', 'COLD', 'CORD', 'WARD', 'WARM', 'ZZZZ']),
      'a ladder word is not a guess',
    ],
    [
      'an answer missing from the guesses',
      { ...SOUND, answers: ['COLD', 'WARM', 'ZZZZ'] },
      'an answer is not a guess',
    ],
    [
      'a shuffle word missing from the guesses',
      { ...SOUND, shuffle: ['WORD', 'ZZZZ'] },
      'a shuffle word is not a guess',
    ],
    [
      'an answer in the shuffle list',
      { ...SOUND, shuffle: ['COLD', 'WORD'] },
      'a shuffle word is also an answer',
    ],
    ['an empty shuffle list', { ...SOUND, shuffle: [] }, 'shuffle is empty'],
    ['an unsorted shuffle list', { ...SOUND, shuffle: ['WORD', 'CARD'] }, 'shuffle is not sorted'],
    [
      'an unsorted guess list',
      { ...SOUND, guesses: ['WARM', 'CARD', 'COLD', 'CORD', 'WARD', 'WORD'] },
      'guesses is not sorted',
    ],
  ])('rejects %s', (_label, lists, problem) => {
    expect(listProblems(lists, 4)).toContain(problem);
  });
});
