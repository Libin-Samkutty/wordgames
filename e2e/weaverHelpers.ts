import { expect, type Page } from '@playwright/test';

import * as lists4 from '../src/dictionary/data/lists-4';
import * as lists5 from '../src/dictionary/data/lists-5';

/**
 * Helpers for the WordWeaver specs. They read the shipped word lists straight
 * from the repository, so the browser tests play real puzzles: the page picks
 * the puzzle, and the test works out a ladder for it independently.
 */

export const WEAVER_URL = '/#/weaver';

const LISTS = {
  4: lists4 as {
    answers: readonly string[];
    guesses: readonly string[];
    ladder: readonly string[];
  },
  5: lists5 as {
    answers: readonly string[];
    guesses: readonly string[];
    ladder: readonly string[];
  },
};

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function neighbours(word: string, words: ReadonlySet<string>): string[] {
  const found: string[] = [];
  for (let position = 0; position < word.length; position += 1) {
    for (const letter of ALPHABET) {
      if (letter === word[position]) continue;
      const candidate = word.slice(0, position) + letter + word.slice(position + 1);
      if (words.has(candidate)) found.push(candidate);
    }
  }
  return found.sort();
}

/** A shortest ladder from `start` to `end` over the ladder list, `start` excluded. */
export function solveLadder(length: 4 | 5, start: string, end: string): string[] {
  const words = new Set(LISTS[length].ladder);
  const parent = new Map<string, string>([[start, '']]);
  const queue = [start];

  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head] as string;
    if (current === end) break;
    for (const next of neighbours(current, words)) {
      if (parent.has(next)) continue;
      parent.set(next, current);
      queue.push(next);
    }
  }

  const path: string[] = [];
  for (let word = end; word !== start; word = parent.get(word) as string) path.unshift(word);
  return path;
}

/**
 * A saved WordWeaver session holding a long ladder, for the layout checks. It
 * walks the ladder list without revisiting a word, so every rung is a real word
 * one letter from the last, and the saved game passes FR-93 on restore.
 */
export function longSession(rungCount: number): Record<string, unknown> {
  const { answers, ladder } = LISTS[4];
  const words = new Set(ladder);
  const end = answers[answers.length - 1] as string;

  /** Depth-first walk without revisits, within a step budget so a dead end cannot hang. */
  const walkFrom = (start: string): string[] | null => {
    const walk = [start];
    const seen = new Set(walk);
    let steps = 0;

    const visit = (): boolean => {
      if (walk.length === rungCount + 1) return true;
      if ((steps += 1) > 20_000) return false;
      for (const next of neighbours(walk[walk.length - 1] as string, words)) {
        if (seen.has(next) || next === end) continue;
        walk.push(next);
        seen.add(next);
        if (visit()) return true;
        walk.pop();
        seen.delete(next);
      }
      return false;
    };

    return visit() ? walk : null;
  };

  let start = '';
  let walk: string[] | null = null;
  for (const candidate of answers) {
    if (candidate === end) continue;
    walk = walkFrom(candidate);
    if (walk) {
      start = candidate;
      break;
    }
  }
  if (!walk) throw new Error(`no ${String(rungCount)}-rung walk in the 4-letter ladder list`);

  const rungs = walk.slice(1).map((word) => ({
    word,
    evaluation: [...word].map((letter, i) => (letter === end[i] ? 'correct' : 'absent')),
  }));

  return {
    id: 'e2e-long',
    length: 4,
    start,
    end,
    par: 5,
    rungs,
    moves: rungs.length,
    currentInput: '',
    status: 'playing',
    startedAt: 1,
    finishedAt: null,
    optimalLadder: null,
  };
}

/** Opens WordWeaver directly and waits for the ladder. */
export async function openWeaver(page: Page): Promise<void> {
  await page.goto(WEAVER_URL);
  await expect(page.getByRole('grid', { name: 'Word ladder' })).toBeVisible();
}

/** The word shown in a ladder row (`Start`, `End`), read from its tile labels. */
export async function rowWord(page: Page, label: string): Promise<string> {
  const labels = await page
    .getByRole('row', { name: label, exact: true })
    .getByRole('gridcell')
    .evaluateAll((cells) => cells.map((cell) => cell.getAttribute('aria-label') ?? ''));

  return labels.map((text) => /letter \d+: (\w),/.exec(text)?.[1] ?? '').join('');
}
