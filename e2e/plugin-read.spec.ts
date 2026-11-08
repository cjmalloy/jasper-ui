import { type APIRequestContext, expect } from '@playwright/test';
import { adminHeaders, localOrigin, mod, test } from './setup';

test.describe.serial('Read Plugin', () => {
  const tag = 'readtest' + Date.now();
  const api = (process.env.MAIN_API || 'http://localhost:8081') + '/api/v1';

  async function headers(request: APIRequestContext) {
    await request.get(`${api}/plugin/page`);
    const { cookies } = await request.storageState();
    const xsrf = cookies.find(c => c.name === 'XSRF-TOKEN')?.value || '';
    return { Authorization: 'Bearer ' + adminHeaders.jwt, 'X-XSRF-TOKEN': xsrf };
  }

  test('enable mods', async ({ page }) => {
    await mod(page, '#mod-plugin\\/user\\/read');
  });

  test('creates a ref', async ({ request }) => {
    const res = await request.post(`${api}/ref`, {
      headers: await headers(request),
      data: {
        url: `https://www.jasper.example/${tag}`,
        title: 'Read Test',
        tags: ['public', tag],
        origin: localOrigin(),
      },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
  });

  test('clicking the link marks the ref read', async ({ page }) => {
    await page.goto(`/tag/${tag}?debug=USER`, { waitUntil: 'networkidle' });
    const ref = page.locator('.ref-list-item.ref', { hasText: 'Read Test' });
    await ref.locator('.actions .show-more').click();
    const menu = page.locator('.advanced-actions');
    await expect(menu.locator('.fake-link', { hasText: /^read$/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);

    const read = page.waitForResponse(resp => (
      resp.url().includes('/api/v1/tags/response') && resp.request().method() === 'POST' && resp.ok()
    ));
    // Dispatch the mouseup handler without following the external link
    await ref.locator('.link a', { hasText: 'Read Test' }).dispatchEvent('mouseup', { button: 0 });
    await read;

    await ref.locator('.actions .show-more').click();
    await expect(menu.locator('.fake-link', { hasText: /^unread$/ })).toBeVisible();
    await expect(menu.locator('.fake-link', { hasText: /^read$/ })).toHaveCount(0);
  });
});
