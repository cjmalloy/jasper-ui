import { type APIRequestContext, expect, type Page, test } from '@playwright/test';
import { adminHeaders } from './setup';

/**
 * Checks the row structure documented in docs/STRUCTURE.md, which custom themes rely on:
 * every `.ref.list-item` / `.tag.list-item` row has `.thumbnail?` → `.link` → `.info` → `.actions?`
 * in document order.
 */
function checkStructure() {
  const rowSelector = '.ref.list-item, .tag.list-item';
  const errors: string[] = [];
  const rows = Array.from(document.querySelectorAll(rowSelector));
  const before = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
  for (const row of rows) {
    const own = (sel: string) => Array.from(row.querySelectorAll(sel)).find(e => e.closest(rowSelector) === row);
    const name = Array.from(row.classList).join('.');
    const thumbnail = own('.thumbnail');
    const link = own('.link');
    const info = own('.info');
    const actions = own('.actions');
    if (!link) errors.push(`${name}: missing .link`);
    if (!info) errors.push(`${name}: missing .info`);
    if (thumbnail && link && !before(thumbnail, link)) errors.push(`${name}: .thumbnail must come before .link`);
    if (link && info && !before(link, info)) errors.push(`${name}: .link must come before .info`);
    if (info && actions && !before(info, actions)) errors.push(`${name}: .info must come before .actions`);
  }
  return { count: rows.length, errors };
}

async function expectStructure(page: Page, rowSelector: string) {
  await page.locator('body:not(.init-theme)').waitFor();
  await expect(page.locator(rowSelector).first()).toBeVisible();
  const result = await page.evaluate(checkStructure);
  expect(result.count).toBeGreaterThan(0);
  expect(result.errors).toEqual([]);
}

test.describe.serial('Ref / Tag structure', () => {
  const api = (process.env.MAIN_API || 'http://localhost:8081') + '/api/v1';
  const runId = Date.now().toString(36);
  const tag = `structuretest${runId}`;
  const url = `https://structure.test/${runId}`;

  async function headers(request: APIRequestContext) {
    await request.get(`${api}/plugin/page`);
    const { cookies } = await request.storageState();
    const xsrf = cookies.find(c => c.name === 'XSRF-TOKEN')?.value || '';
    return { Authorization: 'Bearer ' + adminHeaders.jwt, 'X-XSRF-TOKEN': xsrf };
  }

  test.afterAll(async ({ request }) => {
    await request.delete(`${api}/ref`, { headers: await headers(request), params: { url } });
    await request.delete(`${api}/ext`, { headers: await headers(request), params: { tag } });
    await request.delete(`${api}/plugin`, { headers: await headers(request), params: { tag: `plugin/${tag}` } });
    await request.delete(`${api}/template`, { headers: await headers(request), params: { tag } });
    await request.delete(`${api}/user`, { headers: await headers(request), params: { tag: `+user/${tag}` } });
  });

  test('setup', async ({ request }) => {
    const posts: [string, object][] = [
      ['ref', { url, title: 'Structure Test', tags: ['public', tag] }],
      ['ext', { tag, name: 'Structure Test' }],
      ['plugin', { tag: `plugin/${tag}`, name: 'Structure Test' }],
      ['template', { tag, name: 'Structure Test' }],
      ['user', { tag: `+user/${tag}`, name: 'Structure Test' }],
    ];
    for (const [type, data] of posts) {
      const res = await request.post(`${api}/${type}`, { headers: await headers(request), data });
      expect(res.ok(), `create ${type}`).toBeTruthy();
    }
  });

  test('ref list', async ({ page }) => {
    await page.goto(`/tag/${tag}?debug=ADMIN`, { waitUntil: 'networkidle' });
    await expectStructure(page, '.ref.ref-list-item');
  });

  test('full page ref', async ({ page }) => {
    await page.goto(`/ref/e/${encodeURIComponent(url)}?debug=ADMIN`, { waitUntil: 'networkidle' });
    await expectStructure(page, '.ref.full-page');
  });

  test('ext list', async ({ page }) => {
    await page.goto(`/tags/@*?debug=ADMIN`, { waitUntil: 'networkidle' });
    await expectStructure(page, '.tag.ext');
  });

  test('plugin list', async ({ page }) => {
    await page.goto(`/settings/plugin?debug=ADMIN`, { waitUntil: 'networkidle' });
    await expectStructure(page, '.tag.plugin');
  });

  test('template list', async ({ page }) => {
    await page.goto(`/settings/template?debug=ADMIN`, { waitUntil: 'networkidle' });
    await expectStructure(page, '.tag.template');
  });

  test('user list', async ({ page }) => {
    await page.goto(`/settings/user?debug=ADMIN`, { waitUntil: 'networkidle' });
    await expectStructure(page, '.tag.profile');
  });
});
