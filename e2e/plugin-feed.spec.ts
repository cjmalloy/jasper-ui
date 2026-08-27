import { expect, test } from '@playwright/test';
import { clearMods, deleteRef, mod } from './setup';

test.describe.serial('Feed Plugin', () => {
  const channelUrl = 'https://www.youtube.com/@jasper-e2e';

  test('reposts an existing YouTube feed source', async ({ page }) => {
    test.setTimeout(120_000);
    await clearMods(page);
    await deleteRef(page, channelUrl);

    await page.goto(`/submit?debug=ADMIN&url=${encodeURIComponent(channelUrl)}`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Next' }).click();
    await page.locator('[name=title]').fill('Jasper E2E YouTube Channel');
    const createChannel = page.waitForResponse(response =>
      response.url().includes('/api/v1/ref') &&
      response.request().method() === 'POST' &&
      response.ok());
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    await createChannel;

    await mod(page, '#mod-feeds');
    await page.goto(`/submit?debug=ADMIN&url=${encodeURIComponent(channelUrl)}`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: /RSS\/Atom Feed/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Repost' })).toBeVisible();
    await page.getByRole('button', { name: 'Repost' }).click();

    const createRepost = page.waitForResponse(response =>
      response.url().includes('/api/v1/ref') &&
      response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    const response = await createRepost;
    expect(response.ok()).toBe(true);
    const repost = response.request().postDataJSON();
    expect(repost.url).toMatch(/^internal:/);
    expect(repost.sources).toContain(channelUrl);

    await deleteRef(page, repost.url);
    await deleteRef(page, channelUrl);
    await clearMods(page);
  });
});
