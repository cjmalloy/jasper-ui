import { expect, test } from '@playwright/test';
import { clearMods, deleteRef, mod } from './setup';

test.describe.serial('Feed Plugin', () => {
  const channelUrl = 'https://www.youtube.com/@jasper-e2e';
  const feedUrl = 'https://www.youtube.com/feeds/videos.xml?channel_id=jasper-e2e';

  test('swaps an existing YouTube channel for its feed URL', async ({ page }) => {
    test.setTimeout(120_000);
    await clearMods(page);
    await deleteRef(page, channelUrl);
    await deleteRef(page, feedUrl);

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
    await page.route(/\/api\/v1\/scrape\/rss\?/, route => route.fulfill({
      status: 200,
      contentType: 'text/plain',
      body: feedUrl,
    }));
    await page.goto(`/submit?debug=ADMIN&url=${encodeURIComponent(channelUrl)}`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: /RSS\/Atom Feed/ })).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.locator('[name=url]')).toHaveValue(feedUrl);

    const createFeed = page.waitForResponse(response =>
      response.url().includes('/api/v1/ref') &&
      response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    const response = await createFeed;
    expect(response.ok()).toBe(true);
    const feed = response.request().postDataJSON();
    expect(feed.url).toBe(feedUrl);
    expect(feed.sources).toContain(channelUrl);

    await deleteRef(page, feedUrl);
    await deleteRef(page, channelUrl);
    await clearMods(page);
  });
});
