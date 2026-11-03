import { type APIRequestContext, expect } from '@playwright/test';
import { adminHeaders, mod, test } from './setup';

test.describe.serial('Index Helper', () => {
  const api = (process.env.MAIN_API || 'http://localhost:8081') + '/api/v1';

  async function headers(request: APIRequestContext) {
    await request.get(`${api}/plugin/page`);
    const { cookies } = await request.storageState();
    const xsrf = cookies.find(c => c.name === 'XSRF-TOKEN')?.value || '';
    return { Authorization: 'Bearer ' + adminHeaders.jwt, 'X-XSRF-TOKEN': xsrf };
  }

  function sorted(sort: string, debug: string) {
    return '/tag/science?' + new URLSearchParams({ debug, sort });
  }

  test('enable mods', async ({ page }) => {
    await mod(page, '#mod-indexhelper');
  });

  test('setup tenant index config', async ({ request, origin }) => {
    const res = await request.post(`${api}/template`, {
      headers: await headers(request),
      data: { tag: '_config/index', origin, config: { hotTags: ['plugin/title'] } },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
  });

  test('index flags are on by default', async ({ page }) => {
    await page.goto('/tag/science?debug=ADMIN', { waitUntil: 'networkidle' });
    const helper = page.locator('.index-helper');
    await expect(helper.locator('summary')).toHaveText('⚡️ Indexed');
    await helper.locator('summary').click();
    await expect(helper.locator('.flag').first()).toHaveText('✅️ tags');
    await expect(helper.locator('.fix-indexes, .request-indexes')).toHaveCount(0);
  });

  test('tenant admin can only request root index', async ({ page }) => {
    await page.goto(sorted('tags->plugin/title', 'ADMIN'), { waitUntil: 'networkidle' });
    const helper = page.locator('.index-helper');
    await expect(helper.locator('summary')).toHaveText('⚡️ May not be indexed');
    await helper.locator('summary').click();
    await expect(helper.locator('.hot-tag')).toHaveText('❔ tags->plugin/title');
    await expect(helper.locator('.fix-indexes')).toHaveCount(0);
    await expect(helper.locator('.request-indexes')).toBeVisible();
  });

  test('hidden without read access', async ({ page }) => {
    await page.goto(sorted('tags->plugin/duration:dur', 'USER') + '&tag=alice', { waitUntil: 'networkidle' });
    await expect(page.locator('.bulk.actions')).toBeVisible();
    await expect(page.locator('.index-helper details')).toHaveCount(0);
  });

  test('grant read access', async ({ request, origin }) => {
    const res = await request.post(`${api}/user`, {
      headers: await headers(request),
      data: { tag: '+user/debug', origin, tagReadAccess: ['_index.helper', '_config/index'] },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
  });

  test('user requests missing hot tag', async ({ page }) => {
    await page.goto(sorted('tags->plugin/duration:dur', 'USER'), { waitUntil: 'networkidle' });
    const helper = page.locator('.index-helper');
    await helper.locator('summary').click();
    await expect(helper.locator('.hot-tag')).toHaveText('❔ tags->plugin/duration:dur');
    await expect(helper.locator('.fix-indexes')).toHaveCount(0);
    await helper.locator('.request-indexes').click();
    await expect(page).toHaveURL(/\/submit\/dm/);
    await expect(page.locator('#to')).toHaveValue(/^\+support/);
    await expect(page.locator('#title')).toHaveValue('Index request');
    const comment = page.locator('.editor textarea:not(.measurer)');
    await expect(comment).toHaveValue(/_config\/index/);
    await expect(comment).toHaveValue(/`hotTags`: `plugin\/duration:dur`/);
  });
});
