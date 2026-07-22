import { expect, test } from '@playwright/test';
import JSZip from 'jszip';
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

  test('excludes unchecked refs from bulk downloads', async ({ page }) => {
    test.setTimeout(60_000);
    const selectedUrl = 'https://jasperkm.info/bulk-selected';
    const deleteSelectedRef = async () => {
      await page.goto(`/ref/e/${encodeURIComponent(selectedUrl)}?debug=ADMIN`);
      const deleteLink = page.locator('.full-page.ref .actions .fake-link', { hasText: 'delete' }).first();
      if (!(await deleteLink.isVisible({ timeout: 10_000 }).catch(() => false))) return;
      const deletePromise = page.waitForResponse(resp => (
        resp.url().includes('/api/v1/ref') && resp.request().method() === 'DELETE' && resp.ok()
      ));
      await deleteLink.focus();
      await deleteLink.press('Enter');
      const confirmLink = page.locator('.full-page.ref .actions .fake-link', { hasText: 'yes' }).first();
      await confirmLink.focus();
      await confirmLink.press('Space');
      await deletePromise;
    };
    await deleteSelectedRef();
    try {
      await page.goto('/?debug=ADMIN');
      await openSidebar(page);
      await page.locator('.sidebar .submit-button', { hasText: 'Submit' }).first().click();
      await page.locator('#url').fill(selectedUrl);
      await page.getByText('Next').click();
      await page.locator('[name=title]').fill('Bulk selected');
      const submitPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/ref'));
      await page.locator('button', { hasText: 'Submit' }).click();
      await submitPromise;

      await page.goto('/tag/@*?debug=ADMIN', { waitUntil: 'networkidle' });
      await openSidebar(page);
      await page.locator('.bulk summary').click();

      const checkboxes = page.locator('.bulk-select');
      const unchecked = page.getByRole('checkbox', { name: 'Select Title' });
      await expect(checkboxes).toHaveCount(2);
      await expect(checkboxes.first()).toBeChecked();
      await expect(checkboxes.last()).toBeChecked();
      await expect(unchecked).toBeChecked();
      await unchecked.uncheck();

      const downloadPromise = page.waitForEvent('download');
      await page.locator('.bulk .fake-link', { hasText: 'download' }).click();
      const download = await downloadPromise;
      const stream = await download.createReadStream();
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(chunk);
      const archive = await JSZip.loadAsync(Buffer.concat(chunks));
      const refs = JSON.parse(await archive.file('ref.json')!.async('string'));
      expect(refs).toContainEqual(expect.objectContaining({ url: selectedUrl }));
      expect(refs).not.toContainEqual(expect.objectContaining({ url: 'https://jasperkm.info/' }));
    } finally {
      await deleteSelectedRef();
    }
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
