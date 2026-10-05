import { expect, type Page, test } from '@playwright/test';
import { clearAll, mod } from './setup';

test.describe.serial('Ref Browse', () => {
  let page: Page;
  let refUrl: string;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('clear all', async () => {
    await clearAll(page);
  });

  test('enable mods', async () => {
    await mod(page, '#mod-root', '#mod-comment');
  });

  test('creates a ref', async () => {
    await page.goto('/submit/text?tag=public&debug=MOD', { waitUntil: 'networkidle' });
    await expect(page.locator('.tag-field input.preview[title="public"]')).toBeAttached();
    await page.locator('[name=title]').fill('Browse Target');
    await page.locator('.editor textarea').fill('Browse body text');
    await page.locator('button', { hasText: 'Submit' }).click({ force: true });
    await expect(page.locator('.full-page.ref .link a')).toHaveText('Browse Target');
    refUrl = (await page.locator('.full-page.ref').getAttribute('data-ref-url'))!;
    expect(refUrl).toBeTruthy();
  });

  test('opens browse popup', async () => {
    await page.goto(`/ref/e/${encodeURIComponent(refUrl)}?debug=MOD`, { waitUntil: 'networkidle' });
    await page.locator('.full-page.ref .actions .show-more').click();
    const popupPromise = page.context().waitForEvent('page');
    await page.locator('.advanced-actions .fake-link', { hasText: 'browse' }).click();
    const popup = await popupPromise;
    try {
      await popup.waitForLoadState();
      expect(decodeURIComponent(new URL(popup.url()).pathname)).toBe('/browse/' + refUrl);
      await expect(popup.locator('h1.browse')).toHaveText('Browse Target');
      await expect(popup.locator('.browse .md-container')).toContainText('Browse body text');
      await expect(popup.locator('.full-page.ref')).toHaveCount(0);
      await expect(popup.locator('.tabs')).toHaveCount(0);
      await expect(popup.locator('.comment-reply')).toHaveCount(0);
    } finally {
      await popup.close();
    }
  });

  test('posts a comment in the browser', async () => {
    await page.goto(`/browse/e/${encodeURIComponent(refUrl)}?debug=MOD`, { waitUntil: 'networkidle' });
    await expect(page.locator('h1.browse')).toHaveText('Browse Target');
    await page.locator('.comment-reply textarea').fill('Browse comment');
    const replyPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/ref') && resp.request().method() === 'POST');
    await page.locator('.comment-reply button', { hasText: 'reply' }).click();
    await replyPromise;
    await expect(page.locator('.comment', { hasText: 'Browse comment' })).toBeVisible();
    await expect(page.locator('.comment .user.tag').first()).toHaveAttribute('href', /^\/browse\/tag:\//);
  });

  test('follows comment permalink inside the browser', async () => {
    await page.locator('.comment', { hasText: 'Browse comment' }).locator('.actions a', { hasText: 'permalink' }).first().click();
    await expect(page).toHaveURL(/\/browse\/comment:/);
    await expect(page.locator('h1.browse')).toBeVisible();
    await expect(page.locator('.browse .md-container').first()).toContainText('Browse comment');
    await expect(page.locator('.full-page.ref')).toHaveCount(0);
  });

  test('returns to parent inside the browser', async () => {
    await page.locator('.parent-link', { hasText: 'parent' }).click();
    await expect(page).toHaveURL(/\/browse\//);
    await expect(page).not.toHaveURL(/\/ref\//);
    await expect(page.locator('h1.browse')).toHaveText('Browse Target');
  });

  test('follows author link inside the browser', async () => {
    await page.locator('.comment .user.tag').first().click();
    await expect(page).toHaveURL(/\/browse\/tag:\//);
    await expect(page.locator('h1.browse')).toBeVisible();
    await expect(page.locator('.tabs')).toHaveCount(0);
  });
});
