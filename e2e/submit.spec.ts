import { expect, test } from '@playwright/test';

test.describe('Submit', () => {
  test('offers to repost when a submitted ref already exists', async ({ page }) => {
    await page.route('**/api/v1/ref', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 409,
          contentType: 'application/problem+json',
          body: JSON.stringify({ detail: 'Already exists' }),
        });
      } else {
        await route.continue();
      }
    });
    await page.goto('/submit/web?url=https%3A%2F%2Fjasperkm.info%2F&debug=ADMIN');
    await page.locator('[name=title]').fill('Repost');

    await page.locator('button.submit-button', { hasText: 'Submit' }).click();
    const repost = page.locator('button.submit-button', { hasText: 'Repost' });
    await expect(repost).toBeEnabled();
    await repost.click();

    await expect(page.locator('button.submit-button', { hasText: 'Submit' })).toBeEnabled();
  });
});
