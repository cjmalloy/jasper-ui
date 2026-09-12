import { expect, test } from '@playwright/test';
import { deleteRef, mod } from './setup';

test.describe.serial('RSS Feed Submission', () => {
  test('enable feed and thumbnail mods', async ({ page }) => {
    await mod(page, '#mod-root', '#mod-feeds', '[id="mod-plugin/repost"]', '#mod-thumbnail', '#mod-images');
  });

  for (const theme of ['light', 'dark']) {
    test(`does not cache an unsaved feed for its thumbnail in ${theme} mode`, async ({ page }, testInfo) => {
      const sourceUrl = `https://example.com/rss-preview-${theme}-${Date.now()}`;
      const feedUrl = `${sourceUrl}/feed.xml`;
      const title = `RSS preview ${theme}`;
      const prematureCacheRequests: string[] = [];
      let submitted = false;

      await page.addInitScript(value => localStorage.setItem('theme', `${value}-theme`), theme);
      // Keep discovery deterministic without depending on an external feed server.
      await page.route('**/api/v1/scrape/rss?**', route => route.fulfill({
        contentType: 'text/plain',
        body: feedUrl,
      }));
      await page.route('**/api/v1/scrape/web?**', route => route.fulfill({
        json: { url: sourceUrl, title, tags: ['plugin/thumbnail'], plugins: {} },
      }));
      await page.route('**/api/v1/oembed?**', route => route.fulfill({ status: 404, body: '' }));
      await page.route('**/api/v1/proxy**', async route => {
        const url = new URL(route.request().url()).searchParams.get('url');
        if (!submitted && (url === feedUrl || url === sourceUrl)) {
          prematureCacheRequests.push(url);
          await route.fulfill({ status: 404, body: '' });
        } else {
          await route.continue();
        }
      });

      await page.goto(`/submit/web?debug=ADMIN&tag=plugin/script/feed&url=${encodeURIComponent(sourceUrl)}`,
        { waitUntil: 'networkidle' });
      await expect(page.locator('body')).toHaveClass(new RegExp(`${theme}-theme`));
      await expect(page.locator('[name=url][formcontrolname=url]')).toHaveValue(feedUrl);
      await expect(page.locator('[name=title]')).toHaveValue(title);
      await expect(page.locator('.thumbnail-preview .thumbnail')).toHaveCSS('background-image', 'none');
      expect(prematureCacheRequests).toEqual([]);
      const screenshot = testInfo.outputPath(`feed-preview-${theme}.png`);
      await page.screenshot({ path: screenshot, fullPage: true });
      await testInfo.attach(`feed-preview-${theme}`, {
        path: screenshot,
        contentType: 'image/png',
      });

      const createResponse = page.waitForResponse(response =>
        new URL(response.url()).pathname === '/api/v1/ref' && response.request().method() === 'POST');
      submitted = true;
      await page.getByRole('button', { name: 'Submit', exact: true }).click();
      const response = await createResponse;
      expect(response.ok()).toBe(true);
      expect(response.request().postDataJSON().tags).toContain('plugin/script/feed');
      await expect(page.locator('.full-page.ref .link a')).toHaveText(title);
      await deleteRef(page, feedUrl);
    });
  }
});
