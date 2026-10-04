import { type APIRequestContext, expect, type Page, test } from '@playwright/test';
import { adminHeaders, mod } from './setup';

test.describe.serial('Masonry Template', () => {
  const tag = 'masonry' + Date.now();
  const api = (process.env.MAIN_API || 'http://localhost:8081') + '/api/v1';

  async function headers(request: APIRequestContext) {
    await request.get(`${api}/plugin/page`);
    const { cookies } = await request.storageState();
    const xsrf = cookies.find(c => c.name === 'XSRF-TOKEN')?.value || '';
    return { Authorization: 'Bearer ' + adminHeaders.jwt, 'X-XSRF-TOKEN': xsrf };
  }

  async function listDisplay(page: Page) {
    await page.goto(`/tag/plugin/image:${tag}?debug=ADMIN`, { waitUntil: 'networkidle' });
    const list = page.locator('.list-container').first();
    await expect(list).toBeVisible();
    return list.evaluate(el => getComputedStyle(el).display);
  }

  test('enable images and masonry mods', async ({ page }) => {
    await mod(page, '#mod-images', '#mod-masonry');
  });

  test('create image refs', async ({ request }) => {
    for (let i = 0; i < 3; i++) {
      const res = await request.post(`${api}/ref`, {
        headers: await headers(request),
        data: { url: `https://example.com/${tag}/${i}.png`, title: `Image ${i}`, tags: ['public', 'plugin/image', tag] },
      });
      expect(res.ok(), await res.text()).toBeTruthy();
    }
  });

  test('renders images in masonry columns', async ({ page }) => {
    const display = await listDisplay(page);
    const list = page.locator('.list-container').first();
    if (await page.evaluate(() => CSS.supports('display', 'grid-lanes'))) {
      expect(display).toBe('grid-lanes');
    } else if (await page.evaluate(() => CSS.supports('grid-template-rows', 'masonry'))) {
      await expect(list).toHaveCSS('grid-template-rows', 'masonry');
    } else {
      expect(display).toBe('block');
      await expect(list).toHaveCSS('column-width', '300px');
    }
  });

  test('removing masonry restores image grid', async ({ page }) => {
    await page.goto('/settings/setup?debug=ADMIN', { waitUntil: 'networkidle' });
    await expect(page.locator('#mod-masonry')).toBeChecked();
    await page.locator('#mod-masonry').uncheck();
    await page.locator('button', { hasText: 'Save' }).click();
    await page.locator('.log div', { hasText: 'Success.' }).first().waitFor({ timeout: 15_000, state: 'attached' });
    await page.goto('/settings/setup?debug=ADMIN', { waitUntil: 'networkidle' });
    await expect(page.locator('#mod-masonry')).not.toBeChecked();
    await expect(page.locator('#mod-images')).toBeChecked();
    expect(await listDisplay(page)).toBe('grid');
  });
});
