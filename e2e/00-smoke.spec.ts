import { expect, test } from '@playwright/test';
import { clearMods, deleteRef, openSidebar } from './setup';

test.describe.serial('Smoke Tests', () => {
  test('loads the page', async ({ page }) => {
    await page.goto('/?debug=USER', { waitUntil: 'networkidle' });
    await expect(page.getByText('Powered by Jasper')).toBeVisible();
  });

  test('electron back button returns to the previous page', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'userAgent', { value: `${navigator.userAgent} Electron` });
    });
    await page.goto('/?debug=USER', { waitUntil: 'networkidle' });
    await page.waitForURL(url => url.pathname !== '/');
    const initialUrl = page.url();
    await page.locator('.subscription-bar a').first().click();
    await expect(page).not.toHaveURL(initialUrl);
    await page.locator('.back-button').click();
    await expect(page).toHaveURL(initialUrl);
  });

  test('@\u{ff20}main : clear mods', async ({ page }) => {
    await clearMods(page);
  });

  test('@\u{ff20}repl : clear mods', async ({ page }) => {
    await clearMods(page, process.env.REPL_URL || 'http://localhost:8082');
  });

  test('removes a focused sidebar date filter with one click', async ({ page }) => {
    await page.goto('/?debug=ADMIN', { waitUntil: 'networkidle' });
    await openSidebar(page);
    const filter = page.locator('.filter');
    const filteredQuery = page.waitForRequest(request => {
      const url = new URL(request.url());
      return url.pathname.endsWith('/api/v1/ref/page') && url.searchParams.has('publishedBefore');
    });
    await filter.locator('select.big').selectOption({ label: '📅️ published before' });
    await filteredQuery;

    const filters = filter.locator('.controls');
    await expect(filters).toHaveCount(1);
    const date = filter.locator('input[type="datetime-local"]');
    await date.focus();
    await expect(date).toBeFocused();

    const remove = filters.locator('.remove-filter');
    const box = await remove.boundingBox();
    expect(box).not.toBeNull();
    const unfilteredQuery = page.waitForRequest(request => {
      const url = new URL(request.url());
      return url.pathname.endsWith('/api/v1/ref/page') && !url.searchParams.has('publishedBefore');
    });
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await unfilteredQuery;

    await expect(filters).toHaveCount(0);
  });

  test('creates a ref', async ({ page }) => {
    // Clean up any existing ref from a previous failed run/retry
    await deleteRef(page, 'https://jasperkm.info/');
    await page.goto('/?debug=ADMIN');
    await openSidebar(page);
    await page.locator('.sidebar .submit-button', { hasText: 'Submit' }).first().click();
    await page.locator('#url').fill('https://jasperkm.info/');
    await page.getByText('Next').click();
    await page.locator('[name=title]').fill('Title');
    const submitPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/ref'));
    await page.locator('button', { hasText: 'Submit' }).click();
    await submitPromise;
    await expect(page.locator('.full-page.ref .link a')).toHaveText('Title');
  });

  test('deletes a ref', async ({ page }) => {
    await page.goto(`/ref/e/${encodeURIComponent('https://jasperkm.info/')}?debug=ADMIN`);
    const deleteLink = page.locator('.full-page.ref .actions .fake-link', { hasText: 'delete' }).first();
    await expect(deleteLink).toHaveAttribute('role', 'button');
    await deleteLink.focus();
    await deleteLink.press('Enter');
    const confirmLink = page.locator('.full-page.ref .actions .fake-link', { hasText: 'yes' }).first();
    await confirmLink.focus();
    await confirmLink.press('Space');
    await page.goto(`/ref/e/${encodeURIComponent('https://jasperkm.info/')}?debug=USER`);
    await expect(page.locator('.error-404', { hasText: 'Not Found' })).toBeVisible();
  });

  test('loads the ADMIN user', async ({ page }) => {
    const whoamiPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/user/whoami'));
    await page.goto('/?debug=ADMIN');
    const response = await whoamiPromise;
    const body = await response.json();
    expect(body).toMatchObject({
      tag: '+user/debug',
      admin: true,
      mod: true,
      editor: true,
      user: true,
      viewer: true,
      banned: false,
    });
  });

  test('loads the MOD user', async ({ page }) => {
    const whoamiPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/user/whoami'));
    await page.goto('/?debug=MOD');
    const response = await whoamiPromise;
    const body = await response.json();
    expect(body).toMatchObject({
      tag: '+user/debug',
      admin: false,
      mod: true,
      editor: true,
      user: true,
      viewer: true,
      banned: false,
    });
  });

  test('loads the EDITOR user', async ({ page }) => {
    const whoamiPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/user/whoami'));
    await page.goto('/?debug=EDITOR');
    const response = await whoamiPromise;
    const body = await response.json();
    expect(body).toMatchObject({
      tag: '+user/debug',
      admin: false,
      mod: false,
      editor: true,
      user: true,
      viewer: true,
      banned: false,
    });
  });

  test('loads the USER user', async ({ page }) => {
    const whoamiPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/user/whoami'));
    await page.goto('/?debug=USER');
    const response = await whoamiPromise;
    const body = await response.json();
    expect(body).toMatchObject({
      tag: '+user/debug',
      admin: false,
      mod: false,
      editor: false,
      user: true,
      viewer: true,
      banned: false,
    });
  });

  test('loads the VIEWER user', async ({ page }) => {
    const whoamiPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/user/whoami'));
    await page.goto('/?debug=VIEWER');
    const response = await whoamiPromise;
    const body = await response.json();
    expect(body).toMatchObject({
      tag: '+user/debug',
      admin: false,
      mod: false,
      editor: false,
      user: false,
      viewer: true,
      banned: false,
    });
  });

  test('loads the ANON user', async ({ page }) => {
    const whoamiPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/user/whoami'));
    await page.goto('/?debug=ANON');
    const response = await whoamiPromise;
    const body = await response.json();
    expect(body).toMatchObject({
      tag: '+user/debug',
      admin: false,
      mod: false,
      editor: false,
      user: false,
      viewer: false,
      banned: false,
    });
  });
});
