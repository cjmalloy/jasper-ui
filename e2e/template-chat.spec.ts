import { expect, test } from '@playwright/test';
import { clearAll, mod } from './setup';

test.describe.serial('Chat Template', () => {

  test('clear all', async ({ page }) => {
    await clearAll(page);
  });

  test('enable chat mod', async ({ page }) => {
    await mod(page, '#mod-chat');
  });

  test('"More messages below" bar appears when scrolled up and hides when clicked', async ({ page }) => {
    await page.goto('/tag/chat?debug=ADMIN', { waitUntil: 'networkidle' });

    // Send enough messages to make the viewport scrollable (need more than ~17 to overflow 320px)
    const chatInput = page.locator('.chat input[placeholder="chat..."]');
    await expect(chatInput).toBeVisible({ timeout: 10_000 });

    for (let i = 1; i <= 25; i++) {
      await chatInput.fill(`Message ${i}`);
      const sendPromise = page.waitForResponse(
        resp => resp.url().includes('/api/v1/ref') && resp.request().method() === 'POST',
      );
      await chatInput.press('Enter');
      await sendPromise;
    }

    // Wait for messages to render in the virtual scroll viewport
    const viewport = page.locator('.chat .messages');
    await expect(viewport).toBeVisible();

    // Wait for messages to be fetched from server (component polls ~1s after last send)
    // and rendered in the virtual scroll viewport
    await expect(page.locator('.chat .messages app-chat-entry').first()).toBeVisible({ timeout: 15_000 });

    // Ensure the viewport has scrollable content by waiting for enough messages
    await page.waitForFunction(() => {
      const el = document.querySelector('.chat .messages');
      return el && el.scrollHeight > el.clientHeight;
    }, { timeout: 15_000 });

    // Scroll to the top of the messages viewport to trigger "More messages below"
    await viewport.evaluate(el => el.scrollTop = 0);
    await page.waitForTimeout(500);

    // The floating bar should now be visible
    const bar = page.locator('.chat .scroll-to-bottom');
    await expect(bar).toBeVisible();
    await expect(bar).toHaveText('More messages below');

    // Clicking the bar should scroll to bottom and hide the bar
    await bar.click();
    await page.waitForTimeout(600);
    await expect(bar).not.toBeVisible();
  });

});
