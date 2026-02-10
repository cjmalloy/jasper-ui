import { test, expect, type Page } from '@playwright/test';
import { clearMods, openSidebar } from './setup';

test.describe.serial('Smoke Tests', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('loads the page', async () => {
    await page.goto('/?debug=USER');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Powered by Jasper')).toBeVisible();
  });

  test('@\u{ff20}main : clear mods', async () => {
    await clearMods(page);
  });

  test('@\u{ff20}repl : clear mods', async () => {
    await clearMods(page, process.env.REPL_URL || 'http://localhost:8082');
  });

  test('creates a ref', async () => {
    await page.goto('/?debug=ADMIN');
    await openSidebar(page);
    await page.locator('.sidebar .submit-button', { hasText: 'Submit' }).first().click();
    await page.locator('#url').pressSequentially('https://jasperkm.info/', { delay: 100 });
    await page.getByText('Next').click();
    await page.waitForTimeout(1000); // First part of 'Title' getting truncated
    await page.locator('[name=title]').pressSequentially('Title', { delay: 100 });
    const submitPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/ref'));
    await page.locator('button', { hasText: 'Submit' }).click();
    await submitPromise;
    await expect(page.locator('.full-page.ref .link a')).toHaveText('Title');
  });

  test('deletes a ref', async () => {
    await page.goto(`/ref/e/${encodeURIComponent('https://jasperkm.info/')}?debug=ADMIN`);
    await page.locator('.full-page.ref .actions .fake-link', { hasText: 'delete' }).first().click();
    await page.locator('.full-page.ref .actions .fake-link', { hasText: 'yes' }).first().click();
    await page.goto(`/ref/e/${encodeURIComponent('https://jasperkm.info/')}?debug=USER`);
    await expect(page.locator('.error-404', { hasText: 'Not Found' })).toBeVisible();
  });

  test('loads the ADMIN user', async () => {
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

  test('loads the MOD user', async () => {
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

  test('loads the EDITOR user', async () => {
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

  test('loads the USER user', async () => {
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

  test('loads the VIEWER user', async () => {
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

  test('loads the ANON user', async () => {
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
