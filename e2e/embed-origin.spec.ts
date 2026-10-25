import { type APIRequestContext, expect, type FrameLocator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { adminHeaders, mod, test } from './setup';

/**
 * Every embed iframe is a security boundary: nothing embedded can reach the app window,
 * even content served from our own cache. The embed sandbox only blocks top navigation,
 * so sites keep their own origin and keep working.
 * Uses real domains instead of localhost. The proxy client serves the UI and the API
 * (including the file cache) from one origin, like a production deployment with
 * JASPER_API=. and JASPER_API_PROXY.
 */
const app = process.env.PROXY_URL || 'http://jasper.test:8084';
const other = 'http://other.test';
test.use({
  baseURL: app,
  // The headless shell ignores --unsafely-treat-insecure-origin-as-secure and has no PDF viewer
  channel: 'chromium',
  launchOptions: {
    args: [
      '--host-resolver-rules=MAP *.test 127.0.0.1',
      // Debug login signs JWTs with crypto.subtle, which needs a secure context
      `--unsafely-treat-insecure-origin-as-secure=${app}`,
      // Routed other.test pages count as public, and jasper.test resolves to 127.0.0.1, so Chrome
      // would block other.test from navigating into jasper.test. Real deployments are not on loopback.
      '--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessForNavigations',
    ],
  },
});

test.describe.serial('Embed iframe origin', () => {
  const api = (process.env.MAIN_API || 'http://localhost:8081') + '/api/v1';
  const id = Date.now();
  const pdf = readFileSync('e2e/fixtures/test.pdf');
  const probeScript = (name: string) => `
    const probe = { protocol: location.protocol, origin: self.origin };
    try {
      probe.parentTitle = parent.document.title;
      parent.document.body.dataset.${name} = 'escaped';
    } catch (e) {
      probe.parentTitle = 'blocked';
    }
    try {
      probe.topTitle = top.document.title;
      top.document.body.dataset.${name} = 'escaped';
    } catch (e) {
      probe.topTitle = 'blocked';
    }
    try {
      probe.localStorage = typeof localStorage.length;
    } catch (e) {
      probe.localStorage = 'blocked';
    }
    document.querySelector('.probe').textContent = JSON.stringify(probe);`;
  const probeHtml = (name: string) => `<p class="probe">waiting</p><script>${probeScript(name)}</script>`;

  async function headers(request: APIRequestContext) {
    await request.get(`${api}/plugin/page`);
    const { cookies } = await request.storageState();
    const xsrf = cookies.find(c => c.name === 'XSRF-TOKEN')?.value || '';
    return { Authorization: 'Bearer ' + adminHeaders.jwt, 'X-XSRF-TOKEN': xsrf };
  }

  async function createRef(request: APIRequestContext, url: string, tags = ['public', 'plugin/embed']) {
    const res = await request.post(`${api}/ref`, {
      headers: await headers(request),
      data: { url, title: 'Embed origin', tags },
    });
    expect(res.ok()).toBe(true);
  }

  async function cache(request: APIRequestContext, title: string, mime: string, data: string | Buffer) {
    const res = await request.post(`${api}/proxy`, {
      headers: { ...await headers(request), 'Content-Type': mime },
      params: { title, mime },
      data,
    });
    expect(res.ok()).toBe(true);
    return (await res.json()).url as string;
  }

  async function setPdfProxy(request: APIRequestContext, proxy: boolean) {
    const plugin = await (await request.get(`${api}/plugin`, { headers: await headers(request), params: { tag: 'plugin/pdf' } })).json();
    const res = await request.put(`${api}/plugin`, { headers: await headers(request), data: { ...plugin, config: { ...plugin.config, proxy } } });
    expect(res.ok(), await res.text()).toBe(true);
  }

  async function open(page: Page, url: string) {
    await page.goto(`/ref/e/${encodeURIComponent(url)}?debug=USER`, { waitUntil: 'networkidle' });
    await expect(page.locator('body:not(.init-theme)')).toBeVisible();
  }

  function embed(page: Page) {
    return page.locator('.full-page.ref .embed-expand');
  }

  async function probe(frame: FrameLocator) {
    const p = frame.locator('.probe');
    await expect(p).not.toHaveText('waiting');
    return JSON.parse((await p.textContent())!);
  }

  async function expectSandbox(page: Page) {
    const sandbox = (await embed(page).getAttribute('sandbox'))!.split(' ');
    expect(sandbox).toEqual(expect.arrayContaining(['allow-same-origin', 'allow-scripts', 'allow-popups', 'allow-forms']));
    expect(sandbox).not.toContain('allow-top-navigation');
    expect(sandbox).not.toContain('allow-top-navigation-by-user-activation');
  }

  function expectIsolated(result: any) {
    expect(result.parentTitle).toBe('blocked');
    expect(result.topTitle).toBe('blocked');
  }

  async function expectPdfViewer(page: Page) {
    await expect.poll(() => page.frames().some(f => f.url().startsWith('chrome-extension://'))).toBe(true);
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

  test('normal iframe on another domain keeps its origin and cannot reach the app', async ({ page, request }) => {
    const url = `${other}/page-${id}`;
    await page.route(`${other}/**`, route => route.fulfill({ contentType: 'text/html', body: probeHtml('otherProbe') }));
    await createRef(request, url);
    await open(page, url);
    await expectSandbox(page);
    const result = await probe(page.frameLocator('.full-page.ref .embed-expand'));
    expect(result.protocol).toBe('http:');
    expect(result.origin).toBe(other);
    expectIsolated(result);
    expect(result.localStorage).toBe('number');
    await expect(page.locator('body')).not.toHaveAttribute('data-other-probe');
  });

  test('external page that needs its own origin works in the sandbox', async ({ page, request }) => {
    // Like GWT apps (e.g. the NCTM Isometric Drawing Tool), which load into a child iframe that
    // reads its parent document and break with an opaque origin from a sandbox.
    const url = `${other}/app-${id}`;
    await page.route(`${other}/**`, route => route.fulfill({
      contentType: 'text/html',
      body: route.request().url().endsWith('/child')
        ? `<script>parent.document.querySelector('.probe').textContent = JSON.stringify({
            origin: self.origin,
            parentOrigin: parent.location.origin,
            localStorage: typeof localStorage.length,
          });</script>`
        : `<p class="probe">waiting</p><iframe src="/child"></iframe>`,
    }));
    await createRef(request, url);
    await open(page, url);
    await expectSandbox(page);
    const result = await probe(page.frameLocator('.full-page.ref .embed-expand'));
    expect(result.origin).toBe(other);
    expect(result.parentOrigin).toBe(other);
    expect(result.localStorage).toBe('number');
  });

  test('oEmbed HTML gets an opaque origin, runs scripts and reports its height', async ({ page, request }) => {
    const url = `${other}/post-${id}`;
    await createRef(request, url);
    await page.route('**/api/v1/oembed?**', route => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        type: 'rich', version: '1.0', provider_name: 'Example',
        html: probeHtml('oembedProbe') + '<div style="height: 2000px"></div>',
      }),
    }));
    await open(page, url);
    await expectSandbox(page);
    const result = await probe(page.frameLocator('.full-page.ref .embed-expand'));
    expect(result.protocol).toBe('data:');
    expect(result.origin).toBe('null');
    expectIsolated(result);
    expect(result.localStorage).toBe('blocked');
    await expect(page.locator('body')).not.toHaveAttribute('data-oembed-probe');
    await expect.poll(async () => (await embed(page).boundingBox())?.height).toBeGreaterThan(2000);
  });

  test('embedded page cannot navigate the app, even after a click', async ({ page, request }) => {
    const url = `${other}/top-${id}`;
    await page.route(`${other}/**`, route => route.fulfill({
      contentType: 'text/html',
      body: `<a class="phish" href="${other}/phish" target="_top">Continue</a>
        <script>try { top.location = '${other}/phish' } catch (e) {}</script>`,
    }));
    await createRef(request, url);
    await open(page, url);
    await expectSandbox(page);
    const frame = page.frameLocator('.full-page.ref .embed-expand');
    await frame.locator('.phish').click();
    await page.waitForTimeout(1000);
    expect(page.url()).toContain(app);
    await expect(page.locator('.full-page.ref')).toBeVisible();
  });

  test('X oEmbed gets the twitter styles', async ({ page, request }) => {
    const url = `${other}/x-${id}`;
    await createRef(request, url);
    await page.route('**/api/v1/oembed?**', route => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        type: 'rich', version: '1.0', provider_name: 'X', provider_url: 'https://x.com',
        html: '<blockquote class="twitter-tweet"><p>Post</p></blockquote>',
      }),
    }));
    await open(page, url);
    await expect(page.locator('.full-page.ref .embed-container.twitter')).toBeVisible();
  });

  test('oEmbed widget scripts allowed by the CSP still load', async ({ page, request }) => {
    const url = `${other}/status-${id}`;
    await createRef(request, url);
    await page.route('https://platform.twitter.com/widgets.js', route => route.fulfill({
      contentType: 'text/javascript',
      body: probeScript('widgetProbe'),
    }));
    await page.route('**/api/v1/oembed?**', route => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        type: 'rich', version: '1.0', provider_name: 'Twitter',
        html: '<blockquote class="twitter-tweet"><p class="probe">waiting</p></blockquote><script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>',
      }),
    }));
    await open(page, url);
    const result = await probe(page.frameLocator('.full-page.ref .embed-expand'));
    expect(result.origin).toBe('null');
    expectIsolated(result);
    await expect(page.locator('body')).not.toHaveAttribute('data-widget-probe');
  });

  test('javascript: URLs are not run in embeds', async ({ page, request }) => {
    const url = `${other}/js-${id}`;
    await createRef(request, url);
    await page.route('**/api/v1/oembed?**', route => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        type: 'video', version: '1.0', provider_name: 'Example',
        html: `<iframe src="javascript:parent.document.body.dataset.jsProbe='escaped'"></iframe>`,
      }),
    }));
    await open(page, url);
    await expect(embed(page)).toHaveClass(/ready/);
    await expect(page.locator('body')).not.toHaveAttribute('data-js-probe');
  });

  test('cached HTML from our own cache gets an opaque origin in an iframe', async ({ page, request }) => {
    const url = `${app}/api/v1/proxy/probe.html?url=${encodeURIComponent(await cache(request, 'probe.html', 'text/html', probeHtml('cacheProbe')))}&origin=`;
    await createRef(request, url);
    await open(page, url);
    await expectSandbox(page);
    const result = await probe(page.frameLocator('.full-page.ref .embed-expand'));
    expect(result.protocol).toBe('http:');
    expect(result.origin).toBe('null');
    expectIsolated(result);
    await expect(page.locator('body')).not.toHaveAttribute('data-cache-probe');
  });

  test('cached HTML from our own cache gets an opaque origin in a tab', async ({ page, request }) => {
    const url = `${app}/api/v1/proxy/tab.html?url=${encodeURIComponent(await cache(request, 'tab.html', 'text/html', probeHtml('tabProbe')))}&origin=`;
    await page.goto('/?debug=USER', { waitUntil: 'networkidle' });
    await expect(page.locator('body:not(.init-theme)')).toBeVisible();
    await page.goto(url);
    const p = page.locator('.probe');
    await expect(p).not.toHaveText('waiting');
    const result = JSON.parse((await p.textContent())!);
    expect(result.origin).toBe('null');
    expect(result.localStorage).toBe('blocked');
  });

  test('external page cannot navigate its iframe into our cache to reach the app', async ({ page, request }) => {
    const cached = `${app}/api/v1/proxy/nav.html?url=${encodeURIComponent(await cache(request, 'nav.html', 'text/html', probeHtml('navProbe')))}&origin=`;
    const url = `${other}/nav-${id}`;
    await page.route(`${other}/**`, route => route.fulfill({
      contentType: 'text/html',
      body: `<script>location.replace(${JSON.stringify(cached)})</script>`,
    }));
    await createRef(request, url);
    await open(page, url);
    const result = await probe(page.frameLocator('.full-page.ref .embed-expand'));
    expect(result.origin).toBe('null');
    expectIsolated(result);
    await expect(page.locator('body')).not.toHaveAttribute('data-nav-probe');
  });

  test('external page cannot redirect its iframe into our cache to reach the app', async ({ page, request }) => {
    const cached = `${app}/api/v1/proxy/redirect.html?url=${encodeURIComponent(await cache(request, 'redirect.html', 'text/html', probeHtml('redirectProbe')))}&origin=`;
    const url = `${other}/redirect-${id}`;
    await page.route(`${other}/**`, route => route.fulfill({ status: 302, headers: { Location: cached } }));
    await createRef(request, url);
    await open(page, url);
    const result = await probe(page.frameLocator('.full-page.ref .embed-expand'));
    expect(result.origin).toBe('null');
    expectIsolated(result);
    await expect(page.locator('body')).not.toHaveAttribute('data-redirect-probe');
  });

  test('PDF from our own cache streams with range requests', async ({ page, request }) => {
    const url = await cache(request, `paper-${id}.pdf`, 'application/pdf', pdf);
    const res = await request.post(`${api}/tags`, { headers: await headers(request), params: { url, tag: 'plugin/pdf' } });
    expect(res.ok()).toBe(true);
    const document = page.waitForResponse(res => res.url().startsWith(`${app}/api/v1/proxy/`) && res.request().resourceType() === 'document');
    await open(page, url);
    await expectPdfViewer(page);
    const iframe = page.locator('.full-page.ref .embed-container .embed-expand');
    await expect(iframe).not.toHaveAttribute('sandbox');
    const frame = (await (await iframe.elementHandle())!.contentFrame())!;
    // Framed by URL, not fetched as bytes first, so the viewer can stream large PDFs
    expect(frame.url()).toContain(`${app}/api/v1/proxy/`);
    const pdfHeaders = await (await document).allHeaders();
    expect(pdfHeaders['accept-ranges']).toBe('bytes');
    expect(pdfHeaders['content-security-policy']).toContain('sandbox');
  });

  test('HTML disguised as a PDF in our own cache cannot reach the app', async ({ page, request }) => {
    const url = await cache(request, `fake-${id}.pdf`, 'text/html', probeHtml('pdfProbe'));
    const res = await request.post(`${api}/tags`, { headers: await headers(request), params: { url, tag: 'plugin/pdf' } });
    expect(res.ok()).toBe(true);
    await open(page, url);
    const result = await probe(page.frameLocator('.full-page.ref .embed-container .embed-expand'));
    expect(result.origin).toBe('null');
    expectIsolated(result);
    await expect(page.locator('body')).not.toHaveAttribute('data-pdf-probe');
  });

  test('PDF from another domain renders with its own origin', async ({ page, request }) => {
    await setPdfProxy(request, false);
    try {
      const url = `${other}/paper-${id}.pdf`;
      await page.route(`${other}/**`, route => route.fulfill({ contentType: 'application/pdf', body: pdf }));
      await createRef(request, url, ['public', 'plugin/pdf']);
      await open(page, url);
      await expectPdfViewer(page);
      const frame = page.frames().find(f => f.url() === url)!;
      expect(frame.parentFrame()!.url()).toMatch(/^data:/);
      expect(await frame.evaluate(() => self.origin)).toBe(other);
    } finally {
      await setPdfProxy(request, true);
    }
  });
});
