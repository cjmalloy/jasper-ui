import { type APIRequestContext, expect } from '@playwright/test';
import { adminHeaders, localOrigin, openSidebar, test } from './setup';

test.describe.serial('Relative date filter', () => {
  const tag = 'relativedate' + Date.now();
  const api = (process.env.MAIN_API || 'http://localhost:8081') + '/api/v1';

  async function headers(request: APIRequestContext) {
    await request.get(`${api}/plugin/page`);
    const { cookies } = await request.storageState();
    const xsrf = cookies.find(c => c.name === 'XSRF-TOKEN')?.value || '';
    return { Authorization: 'Bearer ' + adminHeaders.jwt, 'X-XSRF-TOKEN': xsrf };
  }

  test('create refs with published dates', async ({ request }) => {
    for (const [title, days] of [['Recent', 2], ['Old', 30]] as const) {
      const res = await request.post(`${api}/ref`, {
        headers: await headers(request),
        data: {
          url: `comment:${tag}/${title}`,
          title,
          tags: ['public', tag],
          published: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
          origin: localOrigin(),
        },
      });
      expect(res.ok(), await res.text()).toBeTruthy();
    }
  });

  test('slides a relative date filter', async ({ page }) => {
    await page.goto(`/tag/${tag}?debug=USER&sort=published&filter=published/after/P7D`, { waitUntil: 'networkidle' });
    const links = page.locator('.ref-list-item .link a');
    await expect(links).toHaveText(['Recent']);
    await openSidebar(page);
    await expect(page.locator('.filter input[type="datetime-local"]')).toHaveCount(0);
    await expect(page.locator('.filter .relative-date-label')).toHaveText('7 days');

    await page.locator('.filter .relative-date-range').press('End');
    await expect(page.locator('.filter .relative-date-label')).toHaveText('100 years');
    await expect(links).toHaveText(['Recent', 'Old']);
    expect(new URL(page.url()).searchParams.getAll('filter')).toEqual(['published/after/P100Y']);
  });

  test('hotkey switches a date to a relative date', async ({ page }) => {
    const date = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    await page.goto(`/tag/${tag}?debug=USER&sort=published&filter=published/after/${date}`, { waitUntil: 'networkidle' });
    const links = page.locator('.ref-list-item .link a');
    await expect(links).toHaveText(['Recent', 'Old']);
    await openSidebar(page);
    await expect(page.locator('.filter input[type="datetime-local"]')).toBeVisible();
    await expect(page.locator('.filter .relative-date-range')).toHaveCount(0);

    await page.keyboard.down('Control');
    const range = page.locator('.filter .relative-date-range');
    await expect(range).toBeVisible();
    // P7D
    await range.fill('7');
    await page.keyboard.up('Control');
    await expect(range).toBeVisible();
    await expect(page.locator('.filter .relative-date-label')).toHaveText('7 days');
    await expect(links).toHaveText(['Recent']);
    expect(new URL(page.url()).searchParams.getAll('filter')).toEqual(['published/after/P7D']);
  });
});
