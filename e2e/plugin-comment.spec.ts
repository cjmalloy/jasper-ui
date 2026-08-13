import { expect, type Locator, test } from '@playwright/test';
import { mod, openSidebar } from './setup';

test.describe.serial('Comment threads', () => {
  const runId = Date.now().toString(36);
  const url = `https://example.com/comment-thread-${runId}`;

  test('enables comments and creates a ref', async ({ page }) => {
    await mod(page, '#mod-root', '#mod-comment');
    await page.goto('/?debug=ADMIN');
    await openSidebar(page);
    await page.locator('.sidebar .submit-button', { hasText: 'Submit' }).first().click();
    await page.locator('#url').fill(url);
    await page.getByText('Next').click();
    await page.locator('[name=title]').fill(`Comment thread ${runId}`);
    const submit = page.waitForResponse(response => (
      response.url().includes('/api/v1/ref') && response.request().method() === 'POST'
    ));
    await page.locator('button', { hasText: 'Submit' }).click();
    await submit;
  });

  test('finishes loading an empty comment thread', async ({ page }) => {
    await page.goto(`/ref/e/${encodeURIComponent(url)}/comments?debug=ADMIN`, { waitUntil: 'networkidle' });

    await expect(page.locator('.comment-thread')).toBeVisible();
    await expect(page.locator('.comment-thread > .comment')).toHaveCount(0);
  });

  test('loads nested children on the initial render', async ({ page }) => {
    const reply = async (scope: Locator, text: string) => {
      await scope.locator('.comment-reply textarea').fill(text);
      const submitted = page.waitForResponse(response => (
        response.url().includes('/api/v1/ref') && response.request().method() === 'POST'
      ));
      await scope.locator('.comment-reply button', { hasText: 'reply' }).click();
      await submitted;
    };

    await reply(page.locator('.ref-comments'), `Parent ${runId}`);
    const parent = page.locator('.comment-thread > .comment', { hasText: `Parent ${runId}` }).first();
    await expect(parent).toBeVisible();
    await parent.locator('.actions .fake-link', { hasText: 'reply' }).click();
    await reply(parent, `Child ${runId}`);
    await expect(parent.locator('.comment-children .comment', { hasText: `Child ${runId}` })).toBeVisible();

    await page.reload({ waitUntil: 'networkidle' });
    const reloadedParent = page.locator('.comment-thread > .comment', { hasText: `Parent ${runId}` }).first();
    await expect(reloadedParent.locator('.comment-children .comment', { hasText: `Child ${runId}` })).toBeVisible();
  });
});
