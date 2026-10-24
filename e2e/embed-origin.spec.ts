import { type APIRequestContext, expect } from '@playwright/test';
import { adminHeaders, mod, test, upload } from './setup';

/**
 * Documents the origin of the iframes the viewer creates.
 * oEmbed HTML and the PDF wrapper are written into blob: URLs, which the browser gives the app's origin.
 */
test.describe.serial('Embed iframe origin', () => {
  const api = (process.env.MAIN_API || 'http://localhost:8081') + '/api/v1';
  const url = 'https://embed-origin.example.com/post/' + Date.now();
  // Stand-in for third party oEmbed HTML, like Twitter's blockquote + widgets.js
  const html = `<p class="probe">waiting</p><script>
    const probe = { protocol: location.protocol, origin: self.origin };
    try {
      probe.parentTitle = parent.document.title;
      parent.document.body.dataset.embedProbe = 'written by embed';
    } catch (e) {
      probe.parentTitle = 'blocked';
    }
    try {
      probe.localStorage = typeof localStorage.length;
    } catch (e) {
      probe.localStorage = 'blocked';
    }
    document.querySelector('.probe').textContent = JSON.stringify(probe);
  </script>`;

  async function headers(request: APIRequestContext) {
    await request.get(`${api}/plugin/page`);
    const { cookies } = await request.storageState();
    const xsrf = cookies.find(c => c.name === 'XSRF-TOKEN')?.value || '';
    return { Authorization: 'Bearer ' + adminHeaders.jwt, 'X-XSRF-TOKEN': xsrf };
  }

  const cacheProbe = `<p class="probe">waiting</p><script>
    const probe = { origin: self.origin };
    try {
      probe.parentTitle = parent.document.title;
      parent.document.body.dataset.cacheProbe = 'written by cached page';
    } catch (e) {
      probe.parentTitle = 'blocked';
    }
    document.querySelector('.probe').textContent = JSON.stringify(probe);
  </script>`;
  let cache = '';

  test('enable mods', async ({ page }) => {
    await mod(page, '#mod-root', '#mod-pdf', '#mod-cache', '#mod-filecache');
  });

  test('create embed ref', async ({ request }) => {
    const res = await request.post(`${api}/ref`, {
      headers: await headers(request),
      data: { url, title: 'Embed origin', tags: ['public', 'plugin/embed'] },
    });
    expect(res.ok()).toBe(true);
  });

  test('oEmbed HTML runs with the app origin and can reach the parent page', async ({ page, baseURL }) => {
    await page.route('**/api/v1/oembed?**', route => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ type: 'rich', version: '1.0', provider_name: 'Example', html }),
    }));
    await page.goto(`/ref/e/${encodeURIComponent(url)}?debug=USER`, { waitUntil: 'networkidle' });
    const probe = page.frameLocator('.full-page.ref .embed-expand').locator('.probe');
    await expect(probe).not.toHaveText('waiting');
    const result = JSON.parse((await probe.textContent())!);
    expect(result.protocol).toBe('blob:');
    expect(result.origin).toBe(new URL(baseURL!).origin);
    expect(result.parentTitle).toBe(await page.title());
    expect(result.localStorage).toBe('number');
    await expect(page.locator('body')).toHaveAttribute('data-embed-probe', 'written by embed');
  });

  test('PDF wrapper is a blob iframe with the app origin', async ({ page, baseURL }) => {
    const pdf = await upload(page, 'e2e/fixtures/test.pdf');
    await page.goto(pdf + '?debug=USER', { waitUntil: 'networkidle' });
    const iframe = page.locator('.full-page.ref .embed-expand');
    await expect(page.frameLocator('.full-page.ref .embed-expand').locator('embed[type="application/pdf"]')).toBeAttached();
    const frame = (await (await iframe.elementHandle())!.contentFrame())!;
    const result = await frame.evaluate(() => ({
      protocol: location.protocol,
      origin: self.origin,
      parentTitle: parent.document.title,
    }));
    expect(result.protocol).toBe('blob:');
    expect(result.origin).toBe(new URL(baseURL!).origin);
    expect(result.parentTitle).toBe(await page.title());
  });

  test('cache an HTML page', async ({ request }) => {
    const res = await request.post(`${api}/proxy`, {
      headers: { ...await headers(request), 'Content-Type': 'text/html' },
      params: { title: 'probe.html', mime: 'text/html' },
      data: cacheProbe,
    });
    expect(res.ok()).toBe(true);
    cache = (await res.json()).url;
  });

  test('cached page served from the app origin can reach the parent page', async ({ page, request, baseURL }) => {
    // Simulates the default deployment (JASPER_API=.) where the API, and so the cache, shares the app origin
    const appOrigin = new URL(baseURL!).origin;
    const proxyUrl = `${appOrigin}/api/v1/proxy/probe.html?url=${encodeURIComponent(cache)}&origin=`;
    await page.route(`${appOrigin}/api/v1/proxy/**`, async route => route.fulfill({
      response: await route.fetch({ url: route.request().url().replace(appOrigin, new URL(api).origin) }),
    }));
    const res = await request.post(`${api}/ref`, {
      headers: await headers(request),
      data: { url: proxyUrl, title: 'Cached probe', tags: ['public', 'plugin/embed'] },
    });
    expect(res.ok()).toBe(true);
    await page.goto(`/ref/e/${encodeURIComponent(proxyUrl)}?debug=USER`, { waitUntil: 'networkidle' });
    const probe = page.frameLocator('.full-page.ref .embed-expand').locator('.probe');
    await expect(probe).not.toHaveText('waiting');
    const result = JSON.parse((await probe.textContent())!);
    expect(result.origin).toBe(appOrigin);
    expect(result.parentTitle).toBe(await page.title());
    await expect(page.locator('body')).toHaveAttribute('data-cache-probe', 'written by cached page');
  });
});
