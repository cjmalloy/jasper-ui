import { expect, type Page, test } from '@playwright/test';
import { mod, openSidebar } from './setup';

test.describe.serial('JezzBall Plugin', () => {
  const title = 'JezzBall E2E Game';
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('turns on JezzBall', async () => {
    await mod(page, '#mod-experiments', '#mod-jezzball');
  });

  test('creates a saved game', async () => {
    await page.goto('/tag/@*?search=' + encodeURIComponent(title) + '&debug=ADMIN');
    for (let i = 0; i < 5; i++) {
      const deleteAction = page.locator('.ref-list .ref').filter({ hasText: title })
        .locator('.actions .fake-link', { hasText: 'delete' }).first();
      if (!(await deleteAction.isVisible({ timeout: 2_000 }).catch(() => false))) break;
      await deleteAction.click();
      await page.locator('.ref-list .ref .actions .fake-link', { hasText: 'yes' }).first().click();
      await page.waitForTimeout(500);
      await page.reload();
    }

    await page.goto('/?debug=USER');
    await openSidebar(page);
    await page.locator('.sidebar .submit-button', { hasText: 'Submit' }).first().click();
    await page.locator('.tabs a', { hasText: 'text' }).first().click();
    await page.locator('[name=title]').fill(title);
    await page.locator('.add-plugins-label select').selectOption('plugin/jezzball');
    await page.locator('.editor textarea').fill('{"level":3,"score":450,"final":true}');
    await page.getByText('show advanced').click();
    await page.locator('[name=published]').fill('2026-01-01T00:00');
    await page.locator('[name=published]').blur();
    const submitPromise = page.waitForResponse(resp => (
      resp.url().includes('/api/v1/ref') && resp.request().method() === 'POST'
    ));
    await page.locator('button', { hasText: 'Submit' }).click({ force: true });
    await submitPromise;
  });

  test('restores the final score and starts a new game', async () => {
    const game = page.locator('.full-page.ref .jezzball-game');
    await expect(game.locator('.jezzball-canvas')).toBeVisible();
    await expect(game.locator('.jezzball-overlay')).toContainText('final score 450');
    await expect(game.locator('.jezzball-level')).toHaveText('level 3');
    await game.locator('.jezzball-overlay button').click();
    await expect(game.locator('.jezzball-level')).toHaveText('level 1');
    await expect(game.locator('.jezzball-score')).toHaveText('score 0');

    const direction = game.locator('.jezzball-direction');
    await expect(direction).toHaveText('wall ↕');
    await direction.click();
    await expect(direction).toHaveText('wall ↔');
  });

  test('ejects a playable self-contained page', async () => {
    const downloadPromise = page.waitForEvent('download');
    await page.locator('.full-page.ref .jezzball-eject').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('jezzball.html');
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk);
    const html = Buffer.concat(chunks).toString();

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('jezzballApp');
    expect(html).not.toContain('<script src=');

    const portable = await page.context().newPage();
    await portable.setContent(html);
    await expect(portable.locator('.jezzball-canvas')).toBeVisible();
    await expect(portable.locator('.jezzball-level')).toHaveText('level 1');
    await portable.close();
  });
});
