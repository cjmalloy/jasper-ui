import { expect, test } from '@playwright/test';
import { mod } from './setup';

test.describe.serial('Feed submission', () => {
  test('enable feed and thumbnail plugins', async ({ page }) => {
    await mod(page, '#mod-root', '#mod-feeds', '#mod-thumbnail', '#mod-images', '#mod-filecache');
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`submits a feed without caching its URL for an empty thumbnail (${theme})`, async ({ page }, testInfo) => {
      await page.emulateMedia({ colorScheme: theme });
      const sourceUrl = `https://example.com/feed-preview-${theme}-${Date.now()}`;
      const feedUrl = `${sourceUrl}/feed.xml`;
      const title = `Feed thumbnail regression (${theme})`;
      const previewRequests: string[] = [];

      page.on('request', request => {
        const url = new URL(request.url());
        if (url.pathname.startsWith('/api/v1/proxy') &&
            [sourceUrl, feedUrl].includes(url.searchParams.get('url') || '')) {
          previewRequests.push(request.url());
        }
      });
      // Keep feed discovery and metadata deterministic; creation still uses the real backend.
      await page.route('**/api/v1/scrape/rss?**', route => route.fulfill({
        contentType: 'text/plain',
        body: feedUrl,
      }));
      await page.route('**/api/v1/scrape/web?**', route => route.fulfill({
        json: { url: sourceUrl, title, tags: ['plugin/thumbnail'], plugins: { 'plugin/thumbnail': {} } },
      }));
      await page.route('**/api/v1/oembed?**', route => route.fulfill({ status: 404 }));

      await page.goto(`/submit?debug=ADMIN&tag=plugin/script/feed&url=${encodeURIComponent(sourceUrl)}`, {
        waitUntil: 'networkidle',
      });
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await expect(page.locator('[name=url][type=text]')).toHaveValue(feedUrl);
      await expect(page.locator('[name=title]')).toHaveValue(title);
      await expect(page.locator('body')).toHaveClass(new RegExp(`${theme}-theme`));
      await expect(page.locator('.thumbnail-preview .thumbnail')).toBeVisible();
      await page.waitForLoadState('networkidle');
      expect(previewRequests).toEqual([]);
      await expect(page.locator('.thumbnail-preview .thumbnail')).toHaveCSS('background-image', 'none');
      await testInfo.attach(`feed-preview-${theme}`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });

      const created = page.waitForResponse(response => (
        new URL(response.url()).pathname === '/api/v1/ref' && response.request().method() === 'POST'
      ));
      await page.getByRole('button', { name: 'Submit', exact: true }).click();
      const response = await created;
      expect(response.ok()).toBe(true);
      expect(response.request().postDataJSON()).toMatchObject({
        url: feedUrl,
        title,
        tags: expect.arrayContaining(['plugin/script/feed']),
      });
      await expect(page.locator('.full-page.ref .link a').first()).toHaveText(title);
      await expect(page.getByRole('button', { name: 'Repost', exact: true })).not.toBeVisible();
    });
  }
});
