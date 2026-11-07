import { type APIRequestContext, expect } from '@playwright/test';
import { adminHeaders, localOrigin, mod, test } from './setup';

test.describe.serial('PDF Plugin', () => {
  const runId = Date.now().toString(36);
  const api = (process.env.MAIN_API || 'http://localhost:8081') + '/api/v1';
  const paper = `https://example.com/pdf-${runId}/paper/`;
  const page2 = `https://example.com/pdf-${runId}/page/`;
  const url = `comment:pdf-${runId}`;
  const external = `https://example.com/pdf-${runId}/external.pdf`;
  const webPdf = `https://example.com/pdf-${runId}/web/`;
  const proxyUrl = `comment:pdf-proxy-${runId}`;

  async function headers(request: APIRequestContext) {
    await request.get(`${api}/plugin/page`);
    const { cookies } = await request.storageState();
    const xsrf = cookies.find(c => c.name === 'XSRF-TOKEN')?.value || '';
    return { Authorization: 'Bearer ' + adminHeaders.jwt, 'X-XSRF-TOKEN': xsrf };
  }

  test('enable mods', async ({ page }) => {
    await mod(page, '#mod-root', '#mod-pdf');
  });

  test('create refs', async ({ request }) => {
    for (const data of [
      { url: paper, title: 'Paper', tags: ['public', 'plugin/pdf'], plugins: { 'plugin/pdf': { url: `cache:pdf-${runId}` } } },
      { url: page2, title: 'Page', tags: ['public'] },
      { url, title: 'Links', tags: ['public'], comment: `[paper](${paper}) [page](${page2})` },
    ]) {
      const res = await request.post(`${api}/ref`, {
        headers: await headers(request),
        data: { ...data, origin: localOrigin() },
      });
      expect(res.ok(), await res.text()).toBeTruthy();
    }
  });

  test('shows an embed toggle for links to PDF Refs', async ({ page }) => {
    await page.goto(`/ref/e/${encodeURIComponent(url)}?debug=USER`, { waitUntil: 'networkidle' });
    const md = page.locator('.full-page.ref .md');
    await expect(md.locator('a', { hasText: 'paper' })).toBeVisible();
    const toggle = md.locator('.toggle.embed');
    await expect(toggle).toHaveCount(1);
    await expect(toggle).toHaveAttribute('title', paper);
    await toggle.click();
    await expect(md.locator('.embed-container iframe')).toHaveCount(1);
    await toggle.click();
    await expect(md.locator('.embed-container iframe')).toHaveCount(0);
  });

  test('hides toggles for external PDFs without the proxy', async ({ page, request }) => {
    const plugin = await (await request.get(`${api}/plugin`, { headers: await headers(request), params: { tag: 'plugin/pdf' + localOrigin() } })).json();
    for (const data of [
      { url: webPdf, title: 'Web PDF', tags: ['public', 'plugin/pdf'] },
      { url: proxyUrl, title: 'Proxy Links', tags: ['public'], comment: `[external](${external}) [web](${webPdf}) [paper](${paper})` },
    ]) {
      const res = await request.post(`${api}/ref`, { headers: await headers(request), data: { ...data, origin: localOrigin() } });
      expect(res.ok(), await res.text()).toBeTruthy();
    }
    const md = page.locator('.full-page.ref .md');
    await page.goto(`/ref/e/${encodeURIComponent(proxyUrl)}?debug=USER`, { waitUntil: 'networkidle' });
    await expect(md.locator('.toggle.embed')).toHaveCount(3);

    const res = await request.put(`${api}/plugin`, { headers: await headers(request), data: { ...plugin, config: { ...plugin.config, proxy: false } } });
    expect(res.ok(), await res.text()).toBeTruthy();
    await page.goto(`/ref/e/${encodeURIComponent(proxyUrl)}?debug=USER`, { waitUntil: 'networkidle' });
    await expect(md.locator('a', { hasText: 'web' })).toBeVisible();
    // Only the cached PDF can still be embedded
    await expect(md.locator('.toggle.embed')).toHaveCount(1);
    await expect(md.locator('.toggle.embed')).toHaveAttribute('title', paper);
  });
});
