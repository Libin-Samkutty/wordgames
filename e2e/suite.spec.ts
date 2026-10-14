import { expect, test, type Page } from '@playwright/test';

import { openWordwright } from './helpers';
import { openWeaver } from './weaverHelpers';

/**
 * Whole-suite checks (T-72: AC-41, EC-18, EC-28, FR-59, AC-22): every view at
 * every width, a keyboard-only round trip through each game, and two tabs open
 * on different games.
 */

const VIEWPORTS = [
  { name: '320px (smallest phone)', width: 320, height: 568 },
  { name: '375px (iPhone SE)', width: 375, height: 667 },
  { name: '768px (tablet)', width: 768, height: 1024 },
  { name: '1440px (laptop)', width: 1440, height: 900 },
  { name: '2560px (desktop)', width: 2560, height: 1440 },
  { name: '740 × 360 (landscape phone)', width: 740, height: 360 },
];

const heading = (page: Page) => page.getByRole('heading', { level: 1 });

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

test.describe('every view fits at every width (FR-59, AC-22, EC-18)', () => {
  for (const viewport of VIEWPORTS) {
    test(`Home at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');

      await expect(page.getByRole('link', { name: 'Play WordWeaver' })).toBeInViewport();
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    });

    test(`WordWeaver at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openWeaver(page);

      await expect(page.getByRole('grid', { name: 'Word ladder' })).toBeInViewport();
      await expect(page.getByRole('button', { name: 'Enter' })).toBeInViewport();
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    });

    test(`WordWeaver at 5 letters at ${viewport.name}`, async ({ page }) => {
      await page.addInitScript(() => {
        localStorage.setItem('wordgames:v1:weaver:prefs', '{"defaultWordLength":5}');
      });
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openWeaver(page);

      await expect(page.getByRole('button', { name: 'Enter' })).toBeInViewport();
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    });

    test(`Wordwright at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openWordwright(page);

      await expect(page.getByRole('button', { name: 'Enter' })).toBeInViewport();
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    });
  }
});

test.describe('keyboard only through Wordwright (AC-41)', () => {
  test('Home → Wordwright → play to a result → Home', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');

    await page.keyboard.press('Tab'); // Settings
    await page.keyboard.press('Tab'); // Play WordWright
    await expect(page.getByRole('link', { name: 'Play WordWright' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(heading(page)).toHaveText('WordWright');
    await expect(page.getByRole('grid', { name: 'Guess board' })).toBeVisible();

    // Six valid guesses end the game whatever the answer is.
    for (const word of ['crane', 'slate', 'brick', 'pound', 'light', 'mango']) {
      await page.keyboard.type(word);
      await page.keyboard.press('Enter');
      await expect(page.getByRole('button', { name: 'Enter' }))
        .toBeEnabled({ timeout: 3000 })
        .catch(() => undefined);
    }
    await expect(page.getByRole('heading', { name: /You won!|Out of guesses/ })).toBeVisible();

    // The Enter that ended the game did not start another; the next one does.
    await expect(page.getByRole('heading', { name: /You won!|Out of guesses/ })).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: /You won!|Out of guesses/ })).toBeHidden();

    await page.keyboard.press('Shift+Tab');
    await expect(page.getByRole('link', { name: 'All games' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(heading(page)).toHaveText('wordgames');
  });
});

test.describe('two tabs on different games (EC-28)', () => {
  test('keep their game keys apart and sync appearance settings', async ({ context }) => {
    const wordwright = await context.newPage();
    const weaver = await context.newPage();
    await wordwright.emulateMedia({ reducedMotion: 'reduce' });
    await weaver.emulateMedia({ reducedMotion: 'reduce' });

    await openWordwright(wordwright);
    await openWeaver(weaver);

    // Play in each, so each has a session to keep.
    await wordwright.keyboard.type('crane');
    await wordwright.keyboard.press('Enter');
    await expect(wordwright.getByRole('gridcell', { name: /letter 1: C/ }).first()).toBeVisible();
    await weaver.keyboard.type('c');
    await expect(
      weaver.getByRole('gridcell', { name: 'Next rung, letter 1: C, entered' }),
    ).toBeVisible();
    await wordwright.waitForTimeout(400);
    await weaver.waitForTimeout(400);

    const keys = await wordwright.evaluate(() => Object.keys({ ...localStorage }).sort());
    expect(keys).toContain('wordgames:v1:wordwright:session');
    expect(keys).toContain('wordgames:v1:weaver:session');

    // Each tab's session holds its own game.
    const sessions = await wordwright.evaluate(() => ({
      wordwright: JSON.parse(localStorage.getItem('wordgames:v1:wordwright:session') ?? 'null'),
      weaver: JSON.parse(localStorage.getItem('wordgames:v1:weaver:session') ?? 'null'),
    }));
    expect((sessions.wordwright as { guesses: unknown[] }).guesses).toHaveLength(1);
    expect((sessions.weaver as { currentInput: string }).currentInput).toBe('C');

    // Appearance is shared: switching to dark in one tab reaches the other.
    await expect(weaver.locator('html')).not.toHaveClass(/dark/);
    await wordwright.getByRole('button', { name: 'Settings' }).click();
    await wordwright.getByRole('radio', { name: 'Dark' }).click();
    await expect(weaver.locator('html')).toHaveClass(/dark/);
  });
});
