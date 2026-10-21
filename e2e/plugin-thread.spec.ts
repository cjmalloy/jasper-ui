import { expect, type Page } from '@playwright/test';
import { mod, openTextSubmit, test } from './setup';

test.describe.serial('Thread Plugin', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('enable mods', async () => {
    await mod(page, '[id="mod-plugin/thread"]', '[id="mod-plugin/delete"]');
  });

  test('keeps the top deleted after deleting a response', async () => {
    await page.goto('/?debug=MOD', { waitUntil: 'networkidle' });
    await openTextSubmit(page, '+user/debug');
    await page.locator('[name=title]').fill('Thread Top');
    await page.locator('button', { hasText: 'Submit' }).click({ force: true });
    const top = page.locator('.full-page.ref');
    await expect(top.locator('.link a')).toHaveText('Thread Top');
    const topUrl = await top.getAttribute('data-ref-url');
    expect(topUrl).toBeTruthy();

    const topUpdates: string[] = [];
    const topDestination = '/topic/ref/default/' + encodeURIComponent(topUrl!);
    page.on('websocket', ws => ws.on('framereceived', frame => {
      if (String(frame.payload).includes('destination:' + topDestination + '\n')) topUpdates.push(String(frame.payload));
    }));
    await page.goto(`/ref/thread/e/${encodeURIComponent(topUrl!)}?debug=MOD`, { waitUntil: 'networkidle' });
    await page.locator('.thread textarea').first().fill('Thread Response');
    await page.locator('.comment-reply-submit').click();
    const response = page.locator('.ref-list .ref').filter({ hasText: 'Thread Response' });
    await expect(response).toBeVisible();

    await top.locator('.actions .fake-link', { hasText: 'delete' }).first().click();
    await top.locator('.actions .fake-link', { hasText: 'yes' }).first().click();
    await expect(top).toHaveClass(/\bplugin_delete\b/);
    await expect(top.locator('.link a')).not.toHaveText('Thread Top');
    await expect.poll(() => topUpdates.length).toBeGreaterThan(0);
    const updatesBefore = topUpdates.length;

    await response.locator('.actions .fake-link', { hasText: 'delete' }).first().click();
    await response.locator('.actions .fake-link', { hasText: 'yes' }).first().click();
    // Deleting the response updates the metadata of the deleted top over the websocket
    await expect.poll(() => topUpdates.length).toBeGreaterThan(updatesBefore);
    await expect(top).toHaveClass(/\bplugin_delete\b/);
    await expect(top.locator('.link a')).not.toHaveText('Thread Top');
  });
});
