import { type APIRequestContext, expect, test } from '@playwright/test';
import JSZip from 'jszip';
import { adminHeaders, mod } from './setup';

test.describe.serial('Remote Plugin/Template Diff', () => {
  const api = (process.env.MAIN_API || 'http://localhost:8081') + '/api/v1';
  const runId = Date.now().toString(36);
  const remote = '@difftest';
  const backupId = `difftest-${runId}`;
  const tags = {
    plugin: `plugin/difftest${runId}`,
    template: `difftest${runId}`,
  };

  async function headers(request: APIRequestContext) {
    await request.get(`${api}/plugin/page`);
    const { cookies } = await request.storageState();
    const xsrf = cookies.find(c => c.name === 'XSRF-TOKEN')?.value || '';
    return { Authorization: 'Bearer ' + adminHeaders.jwt, 'X-XSRF-TOKEN': xsrf };
  }

  test.afterAll(async ({ request }) => {
    await request.delete(`${api}/plugin`, { headers: await headers(request), params: { tag: tags.plugin } });
    await request.delete(`${api}/template`, { headers: await headers(request), params: { tag: tags.template } });
    await request.delete(`${api}/backup/${backupId}`, { headers: await headers(request), params: { origin: remote } });
    await request.delete(`${api}/origin`, { headers: await headers(request), params: { origin: remote } });
  });

  test('setup', async ({ page, request }) => {
    await mod(page, '#mod-root');
    for (const type of ['plugin', 'template'] as const) {
      const res = await request.post(`${api}/${type}`, {
        headers: await headers(request),
        data: { tag: tags[type], name: 'Diff Test', config: { local: true } },
      });
      expect(res.ok()).toBeTruthy();
    }
    // Remote origins cannot be written directly, so restore a backup into the remote origin
    const zip = new JSZip();
    zip.file('plugin.json', JSON.stringify([{ tag: tags.plugin, origin: remote, name: 'Diff Test', config: { remote: true } }]));
    zip.file('template.json', JSON.stringify([{ tag: tags.template, origin: remote, name: 'Diff Test', config: { remote: true } }]));
    const upload = await request.post(`${api}/backup/upload/${backupId}.zip`, {
      headers: { ...await headers(request), 'Content-Type': 'application/octet-stream' },
      params: { origin: remote },
      data: await zip.generateAsync({ type: 'nodebuffer' }),
    });
    expect(upload.ok()).toBeTruthy();
    const restore = await request.post(`${api}/backup/restore/${backupId}`, {
      headers: await headers(request),
      params: { origin: remote },
      data: { plugin: true, template: true },
    });
    expect(restore.ok()).toBeTruthy();
    for (const type of ['plugin', 'template'] as const) {
      await expect.poll(async () => (await request.get(`${api}/${type}`, {
        headers: await headers(request),
        params: { tag: tags[type] + remote },
      })).status()).toBe(200);
    }
  });

  for (const type of ['plugin', 'template'] as const) {
    test(`local ${type} has no diff action`, async ({ page }) => {
      await page.goto(`/settings/${type}?debug=ADMIN&showRemotes=true&search=difftest${runId}`, { waitUntil: 'networkidle' });
      const item = page.locator(`.${type}.list-item`).filter({ has: page.locator('.link:not(.remote)') });
      await expect(item).toHaveCount(1);
      await expect(item.locator('.diff-link')).toHaveCount(0);
    });

    test(`remote ${type} diffs against local and saves`, async ({ page, request }) => {
      await page.goto(`/settings/${type}?debug=ADMIN&showRemotes=true&search=difftest${runId}`, { waitUntil: 'networkidle' });
      const item = page.locator(`.${type}.list-item`).filter({ has: page.locator('.link.remote') });
      await expect(item).toHaveCount(1);
      await item.locator('.diff-link').click();
      await expect(item.locator('.diff-editor .monaco-diff-editor')).toBeVisible({ timeout: 15_000 });
      const savePromise = page.waitForResponse(resp => (
        resp.url().includes(`/api/v1/${type}`) && resp.request().method() === 'PUT' && resp.ok()
      ));
      await item.locator('button.save-diff').click();
      await savePromise;
      await expect(item.locator('.diff-editor')).toHaveCount(0);
      const res = await request.get(`${api}/${type}`, { headers: await headers(request), params: { tag: tags[type] } });
      expect(res.ok()).toBeTruthy();
      const local = await res.json();
      expect(local.origin || '').toBe('');
      expect(local.config.remote).toBe(true);
      expect(local.config.local).toBeUndefined();
    });
  }
});
