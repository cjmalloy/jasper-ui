import { type APIRequestContext, expect } from '@playwright/test';
import JSZip from 'jszip';
import { adminHeaders, isolatedOrigin, mod, openSidebar, test } from './setup';

test.describe.serial('Tags page origin', () => {
  const api = (process.env.MAIN_API || 'http://localhost:8081') + '/api/v1';
  const runId = Date.now().toString(36);
  let origin = '';
  let remote = '';
  const backupId = `tagsorigin-${runId}`;
  const tag = `tagsorigin${runId}`;

  async function headers(request: APIRequestContext) {
    await request.get(`${api}/plugin/page`);
    const { cookies } = await request.storageState();
    const xsrf = cookies.find(c => c.name === 'XSRF-TOKEN')?.value || '';
    return { Authorization: 'Bearer ' + adminHeaders.jwt, 'X-XSRF-TOKEN': xsrf };
  }

  test.beforeAll(({}, info) => {
    origin = isolatedOrigin(info);
    remote = origin + '.tagsorigin';
  });

  test('setup', async ({ page, request }) => {
    await mod(page, '#mod-root', '#mod-origin');
    const res = await request.post(`${api}/ext`, {
      headers: await headers(request),
      data: { tag, origin, name: 'Local Ext' },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    // Remote origins cannot be written directly, so restore a backup into the remote origin
    const zip = new JSZip();
    zip.file('ext.json', JSON.stringify([{ tag, origin: remote, name: 'Remote Ext' }]));
    const upload = await request.post(`${api}/backup/upload/${backupId}.zip`, {
      headers: { ...await headers(request), 'Content-Type': 'application/octet-stream' },
      params: { origin: remote },
      data: await zip.generateAsync({ type: 'nodebuffer' }),
    });
    expect(upload.ok()).toBeTruthy();
    const restore = await request.post(`${api}/backup/restore/${backupId}`, {
      headers: await headers(request),
      params: { origin: remote },
      data: { ext: true },
    });
    expect(restore.ok()).toBeTruthy();
    await expect.poll(async () => (await request.get(`${api}/ext`, {
      headers: await headers(request),
      params: { tag: tag + remote },
    })).status()).toBe(200);
  });

  test('origin qualified tag checks show remotes on page load', async ({ page }) => {
    await page.goto(`/tags/${tag}${remote}?debug=ADMIN&search=${tag}`, { waitUntil: 'networkidle' });
    const items = page.locator('.ext.list-item');
    await expect(items).toHaveCount(1);
    await expect(items.locator('.link.remote')).toContainText('Remote Ext');
    await openSidebar(page);
    await expect(page.locator('#show-remotes')).toBeChecked();
  });

  test('unchecking show remotes on an origin qualified tag sticks', async ({ page }) => {
    await page.goto(`/tags/${tag}${remote}?debug=ADMIN&search=${tag}`, { waitUntil: 'networkidle' });
    await openSidebar(page);
    await expect(page.locator('#show-remotes')).toBeChecked();
    await page.locator('#show-remotes').uncheck();
    await expect(page.locator('.no-results')).toBeVisible();
    await expect(page.locator('#show-remotes')).not.toBeChecked();
  });

  test('explicit showRemotes=false is respected', async ({ page }) => {
    await page.goto(`/tags/${tag}${remote}?debug=ADMIN&search=${tag}&showRemotes=false`, { waitUntil: 'networkidle' });
    await openSidebar(page);
    await expect(page.locator('#show-remotes')).not.toBeChecked();
  });

  test('wildcard origin keeps the toggle and hides remotes', async ({ page }) => {
    await page.goto(`/tags?debug=ADMIN&search=${tag}`, { waitUntil: 'networkidle' });
    const items = page.locator('.ext.list-item');
    await expect(items).toHaveCount(1);
    await expect(items.locator('.link:not(.remote)')).toContainText('Local Ext');
    await openSidebar(page);
    await expect(page.locator('.sidebar .show-remotes')).toBeVisible();
    await page.locator('#show-remotes').check();
    await expect(items).toHaveCount(2);
    await expect(items.locator('.link.remote')).toContainText('Remote Ext');
    await expect(items.locator('.link:not(.remote)')).toContainText('Local Ext');
  });
});
