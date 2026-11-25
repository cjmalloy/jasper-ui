import { expect, type Page } from '@playwright/test';
import { mod, openTextSubmit, test } from './setup';

test.describe.serial('Graph Plugin', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('turn on graphing', async () => {
    await mod(page, '#mod-experiments', '#mod-graph');
  });

  test('creates a ref', async () => {
    // Clean up any existing ref from a previous failed run/retry
    await page.goto('/tag/@*?search=Title&debug=ADMIN');
    for (let i = 0; i < 5; i++) {
      const ref = page.locator('.ref-list .ref .actions .fake-link', { hasText: 'delete' }).first();
      if (!(await ref.isVisible({ timeout: 2_000 }).catch(() => false))) break;
      await ref.click();
      await page.locator('.ref-list .ref .actions .fake-link', { hasText: 'yes' }).first().click();
      await page.waitForTimeout(500);
      await page.reload();
    }
    await page.goto('/?debug=USER');
    await openTextSubmit(page, '+user/debug');
    await page.locator('[name=title]').fill('Title');
    await page.getByText('show advanced').click();
    await page.locator('[name=published]').fill('2020-01-01T00:00');
    const submitPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/ref'));
    await page.locator('button', { hasText: 'Submit' }).click();
    await submitPromise;
    await expect(page.locator('.full-page.ref .link a').first()).toHaveText('Title');
  });

  test('shows graph', async () => {
    await page.locator('.full-page .actions .fake-link', { hasText: 'edit' }).first().click();
    const url = await page.locator('[name=url]').inputValue();
    await page.goto('/tag/@*?search=' + url + '&debug=USER', { waitUntil: 'networkidle' });
    await page.locator('.tabs a', { hasText: 'graph' }).first().click();
    await expect(page.locator('.force-directed-graph circle').first()).toBeVisible();
    await expect(page.locator('.ref-list .link a').first()).toContainText('Title');
  });

  test('creates reply', async () => {
    await page.locator('.ref .actions .fake-link', { hasText: 'reply' }).first().click();
    await page.locator('.comment-reply textarea').fill('Reply');
    const replyPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/ref'));
    await page.locator('button', { hasText: 'reply' }).click();
    await replyPromise;
    await page.waitForTimeout(1000);
    await page.locator('.ref .actions a', { hasText: 'permalink' }).first().click();
    await page.locator('.tabs a', { hasText: 'responses' }).first().click();
    await page.locator('.ref-list-item.ref .actions a', { hasText: 'permalink' }).first().click();
    await expect(page.locator('.full-page.ref .link a').first()).toHaveText('Reply');
  });

  test('graphs reply', async () => {
    await page.locator('.full-page .actions .fake-link', { hasText: 'edit' }).first().click();
    const url = await page.locator('[name=url]').inputValue();
    await page.goto('/tag/@*?search=' + url + '&debug=USER', { waitUntil: 'networkidle' });
    await page.locator('.tabs a', { hasText: 'graph' }).first().click();
    await expect(page.locator('.force-directed-graph circle').first()).toBeVisible();
    await expect(page.locator('.ref-list .link a', { hasText: 'Reply' }).first()).toBeVisible();
    const loadMore = page.locator('.load-more');
    if (await loadMore.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await loadMore.click();
    }
    await page.locator('figure').click({ button: 'right' });
    await page.getByText('Select all').click();
    await expect(page.locator('.ref-list .link a', { hasText: 'Title' }).first()).toContainText('Title');
  });

  test('context menu stays on screen', async () => {
    const figure = page.locator('.force-directed-graph');
    await figure.scrollIntoViewIfNeeded();
    const box = (await figure.boundingBox())!;
    const viewport = page.viewportSize()!;
    await figure.click({
      button: 'right',
      position: { x: box.width - 2, y: Math.min(box.height - 40, viewport.height - box.y - 2) },
    });
    const menu = (await page.locator('.graph-context-menu').boundingBox())!;
    expect(menu.x + menu.width).toBeLessThanOrEqual(viewport.width);
    expect(menu.y + menu.height).toBeLessThanOrEqual(viewport.height);
    await page.keyboard.press('Escape');
    await page.mouse.click(1, 1);
    await expect(page.locator('.graph-context-menu')).toHaveCount(0);
  });

  test('context menu works with the keyboard', async () => {
    const figure = page.locator('.force-directed-graph');
    const arrows = page.locator('.graph-context-menu [role=menuitemcheckbox]', { hasText: 'arrow' });
    await figure.click({ button: 'right' });
    await expect(page.locator('.graph-context-menu [role^=menuitem]').first()).toBeFocused();
    const checked = await arrows.getAttribute('aria-checked');
    await arrows.focus();
    await page.keyboard.press(' ');
    await expect(page.locator('.graph-context-menu')).toHaveCount(0);
    await figure.click({ button: 'right' });
    await expect(arrows).toHaveAttribute('aria-checked', checked === 'true' ? 'false' : 'true');
    await page.keyboard.press('Escape');
    await expect(page.locator('.graph-context-menu')).toHaveCount(0);
  });

  test('context menu in fullscreen', async () => {
    const figure = page.locator('.force-directed-graph');
    await figure.click({ button: 'right' });
    await page.locator('.graph-context-menu div', { hasText: 'Fullscreen' }).click();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement?.classList.contains('force-directed-graph'))).toBe(true);
    await figure.click({ button: 'right' });
    await expect(figure.locator('.graph-context-menu')).toBeVisible();
    await page.locator('.graph-context-menu div', { hasText: 'Fullscreen' }).click();
    await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
  });
});
