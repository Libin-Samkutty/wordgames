import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { longSession, openWeaver, rowWord, solveLadder } from './weaverHelpers';

/**
 * WordWeaver in a real browser (T-71, T-72: AC-37, AC-41, AC-43, FR-58, FR-88).
 * It plays real puzzles from the shipped lists.
 */

const heading = (page: Page) => page.getByRole('heading', { level: 1 });

async function scan(page: Page) {
  return new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
}

/** Types a word with the physical keyboard and waits for the board to settle. */
async function submit(page: Page, word: string): Promise<void> {
  await page.keyboard.type(word.toLowerCase());
  await page.keyboard.press('Enter');
}

/** Solves the puzzle on screen, whatever it is. */
async function solveOnScreen(page: Page, length: 4 | 5 = 4): Promise<void> {
  const start = await rowWord(page, 'Start');
  const end = await rowWord(page, 'End');
  const ladder = solveLadder(length, start, end);

  for (const [index, rung] of ladder.entries()) {
    await submit(page, rung);
    await expect(
      page.getByRole('row', { name: `Rung ${String(index + 1)}`, exact: true }),
    ).toBeVisible();
    // The last rung ends the puzzle, which disables the keyboard for good.
    if (index < ladder.length - 1)
      await expect(page.getByRole('button', { name: 'Enter' })).toBeEnabled();
  }
  await expect(page.getByRole('heading', { name: 'Solved!' })).toBeVisible();
}

// Reduced motion keeps reveals instant and stops dialogs fading while axe reads
// their colours mid-animation.
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test.describe('keyboard only (AC-41)', () => {
  test('Home → WordWeaver → solve → play again → Home', async ({ page }) => {
    await page.goto('/');

    // Settings is the first stop; the second card is WordWeaver.
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Play WordWeaver' })).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(heading(page)).toHaveText('WordWeaver');
    await expect(heading(page)).toBeFocused();
    await expect(page.getByRole('grid', { name: 'Word ladder' })).toBeVisible();

    await solveOnScreen(page);

    // Enter starts the next puzzle: the first Enter, which solved, did not.
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Solved!' })).toBeHidden();
    await expect(page.getByRole('row', { name: 'Start', exact: true })).toBeVisible();

    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('link', { name: 'All games' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(heading(page)).toHaveText('WordGames');
  });
});

test.describe('a real puzzle', () => {
  test('is prepared from the shipped lists with a start, an end and a par inside the band', async ({
    page,
  }) => {
    await openWeaver(page);

    const start = await rowWord(page, 'Start');
    const end = await rowWord(page, 'End');
    expect(start).toHaveLength(4);
    expect(end).toHaveLength(4);
    expect(start).not.toBe(end);

    const par = solveLadder(4, start, end).length;
    expect(par).toBeGreaterThanOrEqual(4);
    expect(par).toBeLessThanOrEqual(6);
  });

  test('opens quickly on the 5-letter lists (NFR-13 smoke check)', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('wordgames:v1:weaver:prefs', '{"defaultWordLength":5}');
    });

    const begin = Date.now();
    await openWeaver(page);
    const elapsed = Date.now() - begin;

    expect(await rowWord(page, 'Start')).toHaveLength(5);
    // A loose bound on a desktop browser; the real budget is mobile-throttled (AC-37).
    expect(elapsed).toBeLessThan(5000);
  });

  test('gives up and shows a shortest ladder', async ({ page }) => {
    await openWeaver(page);
    const start = await rowWord(page, 'Start');
    const end = await rowWord(page, 'End');
    await submit(page, solveLadder(4, start, end)[0] as string);
    await expect(page.getByRole('button', { name: 'Enter' })).toBeEnabled();

    await page.getByRole('button', { name: 'Give up' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Give up' }).click();

    await expect(page.getByRole('heading', { name: 'Gave up' })).toBeVisible();
    const shortest = page.getByRole('heading', { name: 'A shortest ladder' }).locator('+ ol li');
    expect(await shortest.count()).toBe(solveLadder(4, start, end).length + 1);
  });
});

test.describe('accessibility (AC-43, A11Y-17, A11Y-19)', () => {
  for (const colorScheme of ['light', 'dark'] as const) {
    for (const palette of ['default', 'colourblind'] as const) {
      test(`the board has no violations in ${colorScheme} with the ${palette} palette`, async ({
        page,
      }) => {
        await page.emulateMedia({ colorScheme });
        await page.addInitScript((colourblind: boolean) => {
          localStorage.setItem(
            'wordgames:v1:settings',
            JSON.stringify({ theme: 'system', colorblind: colourblind, motion: 'reduced' }),
          );
        }, palette === 'colourblind');
        await openWeaver(page);
        // A played rung and typed letters, so every tile state is on screen.
        const start = await rowWord(page, 'Start');
        const end = await rowWord(page, 'End');
        await submit(page, solveLadder(4, start, end)[0] as string);
        await page.keyboard.type('c');
        await page.waitForTimeout(300);

        const results = await scan(page);

        expect(results.violations).toEqual([]);
      });
    }
  }

  test('the help dialog has no violations', async ({ page }) => {
    await openWeaver(page);
    await page.getByRole('button', { name: 'How to play' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    expect((await scan(page)).violations).toEqual([]);
  });

  test('the statistics dialog has no violations, empty and with a game', async ({ page }) => {
    await openWeaver(page);
    await page.getByRole('button', { name: 'Statistics' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect((await scan(page)).violations).toEqual([]);
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Give up' }).click();
    await expect(page.getByRole('heading', { name: 'Gave up' })).toBeVisible();
    await page.getByRole('button', { name: 'Statistics' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    expect((await scan(page)).violations).toEqual([]);
  });

  test('the result panel has no violations', async ({ page }) => {
    await openWeaver(page);
    await page.getByRole('button', { name: 'Give up' }).click();
    await expect(page.getByRole('heading', { name: 'Gave up' })).toBeVisible();

    expect((await scan(page)).violations).toEqual([]);
  });

  test('the confirmation dialog has no violations', async ({ page }) => {
    await openWeaver(page);
    const start = await rowWord(page, 'Start');
    const end = await rowWord(page, 'End');
    await submit(page, solveLadder(4, start, end)[0] as string);
    await expect(page.getByRole('button', { name: 'Enter' })).toBeEnabled();
    await page.getByRole('button', { name: 'Give up' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();

    expect((await scan(page)).violations).toEqual([]);
  });
});

test.describe('layout (FR-58, FR-88, AC-22)', () => {
  test('buttons are at least 44 × 44 px', async ({ page }) => {
    await openWeaver(page);

    for (const name of ['Undo', 'Give up', 'New puzzle', 'Enter', 'Backspace']) {
      const box = await page.getByRole('button', { name, exact: true }).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    }
    for (const name of ['How to play', 'Statistics', 'Settings']) {
      const box = await page.getByRole('button', { name }).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    }
  });

  test('fits at 320 px with no horizontal scroll, board and keyboard in view', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await openWeaver(page);

    await expect(page.getByRole('grid', { name: 'Word ladder' })).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Enter' })).toBeInViewport();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('fits in landscape on a short viewport', async ({ page }) => {
    await page.setViewportSize({ width: 740, height: 360 });
    await openWeaver(page);

    await expect(page.getByRole('grid', { name: 'Word ladder' })).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Enter' })).toBeInViewport();
  });

  test('with 15 rungs the input row, end row and keyboard stay visible (FR-88)', async ({
    page,
  }) => {
    await page.addInitScript((session: Record<string, unknown>) => {
      localStorage.setItem('wordgames:v1:weaver:session', JSON.stringify(session));
    }, longSession(15));
    await openWeaver(page);

    await expect(page.getByRole('row', { name: 'Rung 15', exact: true })).toHaveCount(1);
    await expect(page.getByRole('row', { name: 'Next rung', exact: true })).toBeInViewport();
    await expect(page.getByRole('row', { name: 'End', exact: true })).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Enter' })).toBeInViewport();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('with 15 rungs at 320 px the end row and keyboard still fit', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.addInitScript((session: Record<string, unknown>) => {
      localStorage.setItem('wordgames:v1:weaver:session', JSON.stringify(session));
    }, longSession(15));
    await openWeaver(page);

    await expect(page.getByRole('row', { name: 'End', exact: true })).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Enter' })).toBeInViewport();
  });
});
