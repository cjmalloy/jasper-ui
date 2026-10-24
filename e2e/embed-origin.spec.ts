import { type APIRequestContext, expect, type FrameLocator } from '@playwright/test';
import { adminHeaders, mod, test } from './setup';

/**
 * Documents which embeds can reach the app window, using real domains instead of localhost.
 * The proxy client serves the UI and the API (including the file cache) from one origin, like a
 * production deployment with JASPER_API=. and JASPER_API_PROXY.
 */
const app = process.env.PROXY_URL || 'http://jasper.test:8084';
const other = 'http://other.test';
test.use({
  baseURL: app,
  // The headless shell ignores --unsafely-treat-insecure-origin-as-secure
  channel: 'chromium',
  launchOptions: {
    args: [
      '--host-resolver-rules=MAP *.test 127.0.0.1',
      // Debug login signs JWTs with crypto.subtle, which needs a secure context
      `--unsafely-treat-insecure-origin-as-secure=${app}`,
    ],
  },
});

test.describe.serial('Embed iframe origin', () => {
  const api = (process.env.MAIN_API || 'http://localhost:8081') + '/api/v1';
  const id = Date.now();
  const probeHtml = (name: string) => `<p class="probe">waiting</p><script>
    const probe = { protocol: location.protocol, origin: self.origin };
    try {
      probe.parentTitle = parent.document.title;
      parent.document.body.dataset.${name} = 'escaped';
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

  async function createEmbed(request: APIRequestContext, url: string) {
    const res = await request.post(`${api}/ref`, {
      headers: await headers(request),
      data: { url, title: 'Embed origin', tags: ['public', 'plugin/embed'] },
    });
    expect(res.ok()).toBe(true);
  }

  async function probe(frame: FrameLocator) {
    const p = frame.locator('.probe');
    await expect(p).not.toHaveText('waiting');
    return JSON.parse((await p.textContent())!);
  }

  test('enable mods', async ({ page }) => {
    await mod(page, '#mod-root', '#mod-pdf', '#mod-cache', '#mod-filecache');
  });

  test('UI and API share the jasper.test origin', async ({ page }) => {
    const config = page.waitForResponse(res => res.url().startsWith(`${app}/api/v1/`));
    await page.goto('/?debug=USER', { waitUntil: 'networkidle' });
    expect(new URL((await config).url()).origin).toBe(app);
    await expect(page.locator('body:not(.init-theme)')).toBeVisible();
  });

  test('normal iframe on another domain runs scripts but cannot reach the app', async ({ page, request }) => {
    const url = `${other}/page-${id}`;
    await page.route(`${other}/**`, route => route.fulfill({ contentType: 'text/html', body: probeHtml('otherProbe') }));
    await createEmbed(request, url);
    await page.goto(`/ref/e/${encodeURIComponent(url)}?debug=USER`, { waitUntil: 'networkidle' });
    const result = await probe(page.frameLocator('.full-page.ref .embed-expand'));
    expect(result.protocol).toBe('http:');
    expect(result.origin).toBe(other);
    expect(result.parentTitle).toBe('blocked');
    expect(result.localStorage).toBe('number');
    await expect(page.locator('body')).not.toHaveAttribute('data-other-probe');
  });

  test('oEmbed HTML in a blob iframe has the app origin and reaches the app', async ({ page, request }) => {
    const url = `${other}/post-${id}`;
    await createEmbed(request, url);
    await page.route('**/api/v1/oembed?**', route => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ type: 'rich', version: '1.0', provider_name: 'Example', html: probeHtml('oembedProbe') }),
    }));
    await page.goto(`/ref/e/${encodeURIComponent(url)}?debug=USER`, { waitUntil: 'networkidle' });
    const result = await probe(page.frameLocator('.full-page.ref .embed-expand'));
    expect(result.protocol).toBe('blob:');
    expect(result.origin).toBe(app);
    expect(result.parentTitle).toBe(await page.title());
    await expect(page.locator('body')).toHaveAttribute('data-oembed-probe', 'escaped');
  });

  test('PDF wrapper in a blob iframe has the app origin and reaches the app', async ({ page, request }) => {
    const url = `${other}/paper-${id}.pdf`;
    const res = await request.post(`${api}/ref`, {
      headers: await headers(request),
      data: { url, title: 'Embed origin PDF', tags: ['public', 'plugin/pdf'] },
    });
    expect(res.ok()).toBe(true);
    await page.goto(`/ref/e/${encodeURIComponent(url)}?debug=USER`, { waitUntil: 'networkidle' });
    const iframe = page.locator('.full-page.ref .embed-expand');
    await expect(page.frameLocator('.full-page.ref .embed-expand').locator('embed[type="application/pdf"]')).toBeAttached();
    const frame = (await (await iframe.elementHandle())!.contentFrame())!;
    const result = await frame.evaluate(() => ({ protocol: location.protocol, origin: self.origin, parentTitle: parent.document.title }));
    expect(result.protocol).toBe('blob:');
    expect(result.origin).toBe(app);
    expect(result.parentTitle).toBe(await page.title());
  });

  test('cached HTML embedded from our own cache reaches the app', async ({ page, request }) => {
    const res = await request.post(`${api}/proxy`, {
      headers: { ...await headers(request), 'Content-Type': 'text/html' },
      params: { title: 'probe.html', mime: 'text/html' },
      data: probeHtml('cacheProbe'),
    });
    expect(res.ok()).toBe(true);
    const cache = (await res.json()).url;
    const url = `${app}/api/v1/proxy/probe.html?url=${encodeURIComponent(cache)}&origin=`;
    await createEmbed(request, url);
    await page.goto(`/ref/e/${encodeURIComponent(url)}?debug=USER`, { waitUntil: 'networkidle' });
    const result = await probe(page.frameLocator('.full-page.ref .embed-expand'));
    expect(result.protocol).toBe('http:');
    expect(result.origin).toBe(app);
    expect(result.parentTitle).toBe(await page.title());
    await expect(page.locator('body')).toHaveAttribute('data-cache-probe', 'escaped');
  });
});
