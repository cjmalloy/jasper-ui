import { type APIRequestContext, expect } from '@playwright/test';
import JSZip from 'jszip';
import { adminHeaders, isolatedOrigin, test } from './setup';

test.describe.serial('Ref page origin', () => {
  test.setTimeout(120_000);
  const api = (process.env.MAIN_API || 'http://localhost:8081') + '/api/v1';
  const runId = Date.now().toString(36);
  let origin = '';
  let remote = '';
  const backupId = `reforigin-${runId}`;
  const url = `comment:ref-origin-${runId}`;
  const refPage = `/ref/e/${encodeURIComponent(url)}`;

  async function headers(request: APIRequestContext) {
    await request.get(`${api}/plugin/page`);
    const { cookies } = await request.storageState();
    const xsrf = cookies.find(c => c.name === 'XSRF-TOKEN')?.value || '';
    return { Authorization: 'Bearer ' + adminHeaders.jwt, 'X-XSRF-TOKEN': xsrf };
  }

  test.beforeAll(({}, info) => {
    origin = isolatedOrigin(info);
    remote = origin + '.reforigin';
  });

  test('setup obsolete local version', async ({ request }) => {
    const res = await request.post(`${api}/ref`, {
      headers: await headers(request),
      data: { url, origin, title: 'Origin Test', comment: 'local version', tags: ['public'] },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    // Remote origins cannot be written directly, so restore a newer version from a backup into the remote origin
    const zip = new JSZip();
    zip.file('ref.json', JSON.stringify([{
      url,
      origin: remote,
      title: 'Origin Test',
      comment: 'remote version',
      tags: ['public'],
      modified: new Date(Date.now() + 1000).toISOString(),
    }]));
    const upload = await request.post(`${api}/backup/upload/${backupId}.zip`, {
      headers: { ...await headers(request), 'Content-Type': 'application/octet-stream' },
      params: { origin: remote },
      data: await zip.generateAsync({ type: 'nodebuffer' }),
    });
    expect(upload.ok()).toBeTruthy();
    const restore = await request.post(`${api}/backup/restore/${backupId}`, {
      headers: await headers(request),
      params: { origin: remote },
      data: { ref: true },
    });
    expect(restore.ok()).toBeTruthy();
    // The local version is marked obsolete when metadata is backfilled
    await expect.poll(async () => (await request.get(`${api}/ref/count`, {
      headers: await headers(request),
      params: { url, obsolete: true },
    })).text(), { timeout: 100_000 }).toBe('1');
  });

  test('loads the obsolete local version for the local origin', async ({ page }) => {
    await page.goto(`${refPage}?debug=USER&origin=${encodeURIComponent(origin)}`, { waitUntil: 'networkidle' });
    await expect(page.locator('.full-page.ref')).toContainText('local version');
    await expect(page.locator('.full-page.ref')).not.toContainText('remote version');
  });

  test('loads the remote version for a remote origin', async ({ page }) => {
    await page.goto(`${refPage}?debug=USER&origin=${encodeURIComponent(remote)}`, { waitUntil: 'networkidle' });
    await expect(page.locator('.full-page.ref')).toContainText('remote version');
  });

  test('loads the newest version without an origin', async ({ page }) => {
    await page.goto(`${refPage}?debug=USER`, { waitUntil: 'networkidle' });
    await expect(page.locator('.full-page.ref')).toContainText('remote version');
  });
});

test.describe.serial('Ref versions with a remote written under its own origin', () => {
  const api = (process.env.MAIN_API || 'http://localhost:8081') + '/api/v1';
  const runId = Date.now().toString(36);
  let origin = '';
  let remote = '';
  const url = `https://versions.test/${runId}`;

  async function headers(request: APIRequestContext, localOrigin: string) {
    await request.get(`${api}/plugin/page`);
    const { cookies } = await request.storageState();
    const xsrf = cookies.find(c => c.name === 'XSRF-TOKEN')?.value || '';
    return { Authorization: 'Bearer ' + adminHeaders.jwt, 'X-XSRF-TOKEN': xsrf, 'Local-Origin': localOrigin };
  }

  test.beforeAll(({}, info) => {
    origin = isolatedOrigin(info);
    remote = origin + '.versions';
  });

  test('setup local and remote versions', async ({ request }) => {
    const local = await request.post(`${api}/ref`, {
      headers: await headers(request, origin),
      data: { url, origin, title: 'Local Version', tags: ['public'] },
    });
    expect(local.ok(), await local.text()).toBeTruthy();
    // Written with the remote as its root origin, so the local version is not marked obsolete
    const res = await request.post(`${api}/ref`, {
      headers: await headers(request, remote),
      data: { url, origin: remote, title: 'Remote Version', tags: ['public'] },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    expect(await (await request.get(`${api}/ref/count`, {
      headers: await headers(request, origin),
      params: { url, obsolete: false },
    })).text()).toBe('2');
  });

  test('shows every version on the versions page', async ({ page }) => {
    await page.goto(`/ref/e/${encodeURIComponent(url)}?debug=USER`, { waitUntil: 'networkidle' });
    await expect(page.locator('.full-page.ref .link')).toContainText('Remote Version');
    await page.locator('.tabs a', { hasText: 'versions' }).click();
    const links = page.locator('.ref-list-item .link a');
    await expect(links.filter({ hasText: 'Local Version' })).toBeVisible();
    await expect(links.filter({ hasText: 'Remote Version' })).toBeVisible();
  });
});
