import { expect, type Page } from '@playwright/test';

/** The Wordwright view's URL. The app lives under `/wordgames/`, which `baseURL` resolves. */
export const WORDWRIGHT_URL = '/#/wordwright';

/**
 * Opens Wordwright directly and waits for the board.
 *
 * The root URL is Home now, so every spec that plays Wordwright goes through
 * here rather than `page.goto('/')`.
 */
export async function openWordwright(page: Page): Promise<void> {
  await page.goto(WORDWRIGHT_URL);
  await expect(page.getByRole('grid', { name: 'Guess board' })).toBeVisible();
}
