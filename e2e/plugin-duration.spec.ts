import { type APIRequestContext, expect } from '@playwright/test';
import { adminHeaders, localOrigin, mod, openSidebar, test } from './setup';

test.describe.serial('Duration Plugin', () => {
  const tag = 'durationfilter' + Date.now();
  const api = (process.env.MAIN_API || 'http://localhost:8081') + '/api/v1';

  async function headers(request: APIRequestContext) {
    await request.get(`${api}/plugin/page`);
    const { cookies } = await request.storageState();
    const xsrf = cookies.find(c => c.name === 'XSRF-TOKEN')?.value || '';
    return { Authorization: 'Bearer ' + adminHeaders.jwt, 'X-XSRF-TOKEN': xsrf };
  }

  test('enable mods', async ({ page }) => {
    await mod(page, '[id="mod-plugin/duration"]');
  });

  test('create refs with durations', async ({ request }) => {
    for (const [title, duration] of [['Short', 'pt2m'], ['Medium', 'pt30m'], ['Long', 'pt2h']]) {
      const res = await request.post(`${api}/ref`, {
        headers: await headers(request),
        data: {
          url: `comment:${tag}/${duration}`,
          title,
          tags: ['public', tag, `plugin/duration/${duration}`],
          origin: localOrigin(),
        },
      });
      expect(res.ok(), await res.text()).toBeTruthy();
    }
  });

  test('filters shorter than a duration', async ({ page }) => {
    await page.goto(`/tag/${tag}?debug=USER&sort=tags->plugin/duration:dur`, { waitUntil: 'networkidle' });
    const links = page.locator('.ref-list-item .link a');
    await expect(links).toHaveText(['Short', 'Medium', 'Long']);
    await openSidebar(page);
    await page.locator('.filter select.big').selectOption({ label: '⏱️ shorter than' });
    const value = page.locator('.filter .filter-value');
    await expect(value).toHaveValue('pt5m');
    await expect(links).toHaveText(['Short']);

    await value.fill('pt1h');
    await value.press('Enter');
    await expect(links).toHaveText(['Short', 'Medium']);
    expect(new URL(page.url()).searchParams.getAll('filter')).toEqual(['tags->plugin/duration:dur/before/pt1h']);
  });

  test('filters longer than a duration', async ({ page }) => {
    const request = page.waitForRequest(req => req.url().includes('/api/v1/ref/page') && req.url().includes('tagAfter'));
    await page.goto(`/tag/${tag}?debug=USER&sort=tags->plugin/duration:dur&filter=tags->plugin/duration:dur/after/PT10M`, { waitUntil: 'networkidle' });
    expect(new URL((await request).url()).searchParams.getAll('tagAfter')).toEqual(['tags->plugin/duration:dur/pt10m']);
    await expect(page.locator('.ref-list-item .link a')).toHaveText(['Medium', 'Long']);
  });
});
