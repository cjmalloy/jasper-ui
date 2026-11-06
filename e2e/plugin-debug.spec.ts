import { type APIRequestContext, expect } from '@playwright/test';
import { adminHeaders, localOrigin, mod, openSidebar, test } from './setup';

test.describe.serial('Debug Plugin', () => {
  const tag = 'debugselect' + Date.now();
  const api = (process.env.MAIN_API || 'http://localhost:8081') + '/api/v1';

  async function headers(request: APIRequestContext) {
    await request.get(`${api}/plugin/page`);
    const { cookies } = await request.storageState();
    const xsrf = cookies.find(c => c.name === 'XSRF-TOKEN')?.value || '';
    return { Authorization: 'Bearer ' + adminHeaders.jwt, 'X-XSRF-TOKEN': xsrf };
  }

  test('enable mods', async ({ page }) => {
    await mod(page, '#mod-experiments', '#mod-debug');
  });

  test('create refs with select values', async ({ request }) => {
    for (const [title, select] of [['One', '1'], ['Two', '2'], ['Another Two', '2'], ['Three', '3']]) {
      const res = await request.post(`${api}/ref`, {
        headers: await headers(request),
        data: {
          url: `comment:${tag}/${title}`,
          title,
          tags: ['public', tag, 'plugin/debug'],
          plugins: { 'plugin/debug': { select } },
          origin: localOrigin(),
        },
      });
      expect(res.ok(), await res.text()).toBeTruthy();
    }
  });

  test('filters equal to a select option', async ({ page }) => {
    await page.goto(`/tag/${tag}?debug=USER&sort=title`, { waitUntil: 'networkidle' });
    const links = page.locator('.ref-list-item .link a');
    await expect(links).toHaveText(['Another Two', 'One', 'Three', 'Two']);
    await openSidebar(page);
    await page.locator('.filter select.big').selectOption({ label: '🐞️ select' });
    const option = page.locator('.filter .filter-option');
    await expect(option).toHaveValue('1');
    await expect(links).toHaveText(['One']);

    const request = page.waitForRequest(req => req.url().includes('/api/v1/ref/page') && req.url().includes('filterEquals'));
    await option.selectOption({ label: 'Option 2' });
    expect(new URL((await request).url()).searchParams.getAll('filterEquals')).toEqual(['plugins->plugin/debug->select/2']);
    await expect(links).toHaveText(['Another Two', 'Two']);
    expect(new URL(page.url()).searchParams.getAll('filter')).toEqual(['plugins->plugin/debug->select/equals/2']);
  });

  test('reads the option from the URL', async ({ page }) => {
    await page.goto(`/tag/${tag}?debug=USER&sort=title&filter=plugins->plugin/debug->select/equals/3`, { waitUntil: 'networkidle' });
    await expect(page.locator('.ref-list-item .link a')).toHaveText(['Three']);
    await openSidebar(page);
    await expect(page.locator('.filter #filter-0 option:checked')).toHaveText('🐞️ select');
    await expect(page.locator('.filter .filter-option')).toHaveValue('3');
  });
});
