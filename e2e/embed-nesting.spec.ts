import { expect, test } from '@playwright/test';
import { clearMods } from './setup';

test.describe.serial('Embed nesting', () => {
  test.beforeEach(async ({ page }) => {
    await clearMods(page);
  });

  for (const theme of ['light', 'dark'] as const) {
    for (const max of [3, 1]) {
      test(`caps recursive embeds at ${max} in ${theme} mode`, async ({ page }, testInfo) => {
        await page.emulateMedia({ colorScheme: theme });
        if (max !== 3) {
          await page.route('**/assets/config.json', async route => {
            const response = await route.fetch();
            await route.fulfill({ json: { ...await response.json(), maxEmbedNesting: max } });
          });
        }
        const url = 'wiki:Embed_nesting';
        const href = `/ref/${url}`;
        const ref = {
          url,
          origin: '',
          title: 'Embed nesting',
          tags: ['public'],
          comment: `Recursive embed\n\n![](${href})\n\n[Open page](${href})`,
          created: '2026-01-01T00:00:00.000Z',
          modified: '2026-01-01T00:00:00.000Z',
        };
        let requests = 0;
        await page.route('**/api/v1/ref/page**', async route => {
          const params = new URL(route.request().url()).searchParams;
          if (params.get('url') !== url || params.has('query')) {
            await route.fallback();
            return;
          }
          requests++;
          await route.fulfill({
            json: {
              content: [ref],
              page: { number: 0, size: 1, totalElements: 1, totalPages: 1 },
            },
          });
        });

        await page.goto(`/ref/e/${encodeURIComponent(url)}?debug=ADMIN`, { waitUntil: 'networkidle' });
        await expect(page.locator('body')).toHaveClass(new RegExp(`${theme}-theme`));
        const markdown = page.locator('.full-page.ref .md').first();
        await expect(markdown.getByText('Recursive embed', { exact: true })).toHaveCount(max + 1);
        await expect(markdown.locator('a.embed-limit')).toHaveAttribute('href', href);
        await expect(markdown.locator('.loading')).toHaveCount(0);
        const deepest = markdown.locator('.md').last();
        await expect(deepest.getByRole('link', { name: 'Open page', exact: true })).toBeVisible();
        await expect(deepest.locator('.toggle.embed')).toHaveCount(0);
        expect(requests).toBe(max + 1);

        await testInfo.attach(`embed-nesting-${theme}-${max}`, {
          path: await page.screenshot({ path: `/tmp/embed-nesting-${theme}-${max}.png`, fullPage: true })
            .then(() => `/tmp/embed-nesting-${theme}-${max}.png`),
          contentType: 'image/png',
        });

        const toggle = markdown.locator(':scope > p > .toggle.embed').first();
        await toggle.click();
        await expect(markdown.getByText('Recursive embed', { exact: true })).toHaveCount(2 * max + 1);
        await expect(markdown.locator('a.embed-limit')).toHaveCount(2);
        await toggle.click();
        await expect(markdown.getByText('Recursive embed', { exact: true })).toHaveCount(max + 1);
      });
    }
  }
});
