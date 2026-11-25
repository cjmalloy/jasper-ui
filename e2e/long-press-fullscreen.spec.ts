import { type APIRequestContext, expect, type Page } from '@playwright/test';
import { adminHeaders, localOrigin, mod, test } from './setup';

/**
 * Without Picture-in-Picture (ex. Android), long-pressing the toggle opens
 * fullscreen once the finger lifts, since only then does touch grant user activation.
 */
test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

test.describe.serial('Long-press Fullscreen', () => {
  const runId = Date.now().toString(36);
  const api = (process.env.MAIN_API || 'http://localhost:8081') + '/api/v1';
  const url = `comment:long-press-${runId}`;

  async function headers(request: APIRequestContext) {
    await request.get(`${api}/plugin/page`);
    const { cookies } = await request.storageState();
    const xsrf = cookies.find(c => c.name === 'XSRF-TOKEN')?.value || '';
    return { Authorization: 'Bearer ' + adminHeaders.jwt, 'X-XSRF-TOKEN': xsrf };
  }

  /**
   * Long-press the toggle, then lift or cancel with a real touch.
   * Headless Chromium on Linux never turns a held touch into a contextmenu, so it is dispatched
   * without a user gesture like Android does before the finger lifts. The touch that follows is
   * trusted, so fullscreen depends on the real activation it grants.
   */
  async function longPress(page: Page, end: 'touchEnd' | 'touchCancel') {
    await page.goto(`/ref/e/${encodeURIComponent(url)}?debug=USER`, { waitUntil: 'networkidle' });
    const toggle = page.locator('.full-page.ref .toggle').first();
    await expect(toggle).toBeVisible();
    const b = (await toggle.boundingBox())!;
    const point = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    const cdp = await page.context().newCDPSession(page);
    const run = async (expression: string) =>
      (await cdp.send('Runtime.evaluate', { expression, userGesture: false, returnByValue: true })).result.value;
    // Playwright actions grant transient activation, wait for it to expire
    await expect.poll(() => run('navigator.userActivation.isActive'), { timeout: 15_000 }).toBe(false);
    await run(`document.querySelector('.full-page.ref .toggle').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))`);
    expect(await run('!!document.fullscreenElement')).toBe(false);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await cdp.send('Input.dispatchTouchEvent', { type: end, touchPoints: [] });
    return cdp;
  }

  test('enable mods', async ({ page }) => {
    await mod(page, '#mod-root', '[id="mod-plugin/fullscreen"]');
  });

  test('create ref', async ({ request }) => {
    const res = await request.post(`${api}/ref`, {
      headers: await headers(request),
      data: { url, title: 'Long Press', tags: ['public'], comment: 'Text', origin: localOrigin() },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
  });

  test('opens fullscreen when the finger lifts', async ({ page }) => {
    await longPress(page, 'touchEnd');
    await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
    await expect(page.locator('.embed:fullscreen')).toContainText('Text');
  });

  test('stays closed when the long-press is cancelled', async ({ page }) => {
    const cdp = await longPress(page, 'touchCancel');
    // A later tap elsewhere must not open the abandoned request
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 5, y: 600 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => !!document.fullscreenElement)).toBe(false);
    await expect(page.locator('.full-page.ref .toggle .toggle-fullscreen')).toHaveCount(0);
  });
});
