import { test, expect, type Page } from '@playwright/test';
import { clearMods, openSidebar } from './setup';

test.describe.serial('Ref Actions', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('clear mods', async () => {
    await clearMods(page);
  });

  test('creates a ref', async () => {
    await page.goto('/?debug=MOD');
    await openSidebar(page);
    await page.locator('.sidebar .submit-button', { hasText: 'Submit' }).first().click();
    await page.locator('.tabs a', { hasText: 'text' }).first().click();
    await page.locator('[name=title]').pressSequentially('Title', { delay: 100 });
    await page.getByText('show advanced').click();
    await page.locator('[name=published]').pressSequentially('2020-01-01T00:00', { delay: 100 });
    await page.locator('[name=published]').blur();
    await page.locator('button', { hasText: 'Submit' }).click({ force: true });
    await expect(page.locator('.full-page.ref .link a')).toHaveText('Title');
  });

  test('edits comments field', async () => {
    await page.locator('.full-page.ref .actions .fake-link', { hasText: 'edit' }).first().click();
    await page.locator('button', { hasText: '+ Add abstract' }).click();
    await page.locator('.full-page.ref .editor textarea').pressSequentially('Comment field', { delay: 100 });
    await page.locator('button', { hasText: 'save' }).click();
    await expect(page.locator('.full-page.ref')).toContainText('Comment field');
    await page.locator('.full-page.ref .toggle-x').click();
    await expect(page.locator('.full-page.ref')).not.toContainText('Comment field');
  });

  test('adds tag inline (this breaks loading "1 citation" text)', async () => {
    await page.locator('.full-page.ref .actions .fake-link', { hasText: 'tag' }).first().click();
    await page.locator('.inline-tagging input').pressSequentially('cool', { delay: 100 });
    await page.locator('.inline-tagging input').press('Enter');
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'cool' })).toBeVisible();
  });

  test('creates reply', async () => {
    await page.locator('.full-page.ref .actions .fake-link', { hasText: 'reply' }).first().click();
    await page.locator('.full-page.ref .comment-reply textarea').pressSequentially('Reply', { delay: 100 });
    const replyPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/ref') && resp.request().method() === 'POST');
    await page.locator('.full-page.ref button', { hasText: 'reply' }).click();
    await replyPromise;
    await page.locator('.full-page.ref .actions a', { hasText: '1 citation' }).first().click();
    await page.locator('.ref-list-item.ref .actions a', { hasText: 'permalink' }).first().click();
    await expect(page.locator('.full-page.ref .link a')).toHaveText('Reply');
  });

  test('shows parent', async () => {
    await page.locator('.full-page.ref .actions a', { hasText: 'parent' }).first().click();
    await expect(page.locator('.full-page.ref .link a')).toHaveText('Title');
    await expect(page).toHaveTitle(/Title/);
  });

  test('adds tag inline', async () => {
    await page.locator('.full-page.ref .actions .fake-link', { hasText: 'tag' }).first().click();
    await page.locator('.inline-tagging input').pressSequentially('cool', { delay: 100 });
    await page.locator('.inline-tagging input').press('Enter');
    await expect(page.locator('.full-page.ref .tag:not(.user)', { hasText: 'cool' })).toBeVisible();
  });

  test('shows responses', async () => {
    await page.locator('.full-page.ref .actions a', { hasText: '1 citation' }).first().click();
    await expect(page.locator('.full-page.ref .link a')).toHaveText('Title');
    await expect(page).toHaveTitle(/Responses: Title/);
    await expect(page.locator('.ref-list .ref .link a', { hasText: 'Reply' })).toBeVisible();
  });

  test('should delete reply', async () => {
    await page.locator('.ref-list .ref .actions .fake-link', { hasText: 'delete' }).first().click();
    await page.locator('.ref-list .ref .actions .fake-link', { hasText: 'yes' }).first().click();
    await page.locator('.ref-list .ref .actions a', { hasText: 'parent' }).first().click();
    await expect(page.locator('.full-page.ref .link a')).toHaveText('Title');
  });

  test.describe('New Comments/Threads/Replies Indicators', () => {
    test('should clear localStorage for clean test', async () => {
      await page.evaluate(() => localStorage.clear());
    });

    test('should create a ref with comments enabled', async () => {
      await page.goto('/?debug=MOD');
      await openSidebar(page);
      await page.locator('.sidebar .submit-button', { hasText: 'Submit' }).first().click();
      await page.locator('.tabs a', { hasText: 'text' }).first().click();
      await page.locator('[name=title]').pressSequentially('Test Ref for New Indicators', { delay: 100 });
      await page.getByText('show advanced').click();
      await page.locator('[name=published]').pressSequentially('2020-02-01T00:00', { delay: 100 });
      await page.locator('[name=published]').blur();
      await page.locator('button', { hasText: 'Submit' }).click({ force: true });
      await expect(page.locator('.full-page.ref .link a')).toHaveText('Test Ref for New Indicators');
    });

    test('should show "(1 new)" when first comment is added', async () => {
      // Add a comment with API intercept
      const createCommentPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/ref') && resp.request().method() === 'POST');
      await page.locator('.full-page.ref .actions .fake-link', { hasText: 'reply' }).first().click();
      await page.locator('.full-page.ref .comment-reply textarea').pressSequentially('First comment', { delay: 100 });
      await page.locator('.full-page.ref button', { hasText: 'reply' }).click();

      // Wait for comment to be created
      await createCommentPromise;
      await page.waitForTimeout(1000); // Additional wait for metadata to update

      // View the comment page to mark the first comment as seen
      await page.locator('.full-page.ref .actions a', { hasText: 'citation' }).first().click();
      await page.waitForTimeout(1000);

      // Navigate back to the ref using the "view" tab
      await page.locator('.tabs a', { hasText: 'view' }).first().click();
      await page.waitForTimeout(500);

      // Add another comment with API intercept
      const createComment2Promise = page.waitForResponse(resp => resp.url().includes('/api/v1/ref') && resp.request().method() === 'POST');
      await page.locator('.full-page.ref .actions .fake-link', { hasText: 'reply' }).first().click();
      await page.locator('.full-page.ref .comment-reply textarea').pressSequentially('Second comment', { delay: 100 });
      await page.locator('.full-page.ref button', { hasText: 'reply' }).click();
      await createComment2Promise;
      await page.waitForTimeout(1000);

      // Navigate away to home and then find the ref to check indicators
      await page.goto('/?debug=MOD');
      await page.waitForTimeout(1000);

      // Try to find and click on the ref we created
      await page.getByText('Test Ref for New Indicators').click();
      await page.waitForTimeout(500);

      // Check for citation count (should show "(1 new)" for the second comment)
      await expect(page.locator('.full-page.ref .actions')).toContainText('citation');
      await expect(page.locator('.full-page.ref .actions')).toContainText('(1 new)');
    });

    test('should clear "(X new)" after viewing comments', async () => {
      // Click on citation link to view them
      await page.locator('.full-page.ref .actions a', { hasText: 'citation' }).first().click();

      // Wait for page to load
      await page.waitForTimeout(1000);

      // Navigate away and back
      await page.goto('/?debug=MOD');
      await page.waitForTimeout(1000);
      await page.getByText('Test Ref for New Indicators').click();
      await page.waitForTimeout(500);

      // Check that "(X new)" is gone
      await expect(page.locator('.full-page.ref .actions')).toContainText('citation');
      await expect(page.locator('.full-page.ref .actions')).not.toContainText('new');
    });

    test('should show "(2 new)" when two more comments are added', async () => {
      // We're already on the ref page, add third comment with API intercept
      const createComment3Promise = page.waitForResponse(resp => resp.url().includes('/api/v1/ref') && resp.request().method() === 'POST');
      await page.locator('.full-page.ref .actions .fake-link', { hasText: 'reply' }).first().click();
      await page.locator('.full-page.ref .comment-reply textarea').pressSequentially('Third comment', { delay: 100 });
      await page.locator('.full-page.ref button', { hasText: 'reply' }).click();
      await createComment3Promise;
      await page.waitForTimeout(1000);

      // Add fourth comment with API intercept
      const createComment4Promise = page.waitForResponse(resp => resp.url().includes('/api/v1/ref') && resp.request().method() === 'POST');
      await page.locator('.full-page.ref .actions .fake-link', { hasText: 'reply' }).first().click();
      await page.locator('.full-page.ref .comment-reply textarea').pressSequentially('Fourth comment', { delay: 100 });
      await page.locator('.full-page.ref button', { hasText: 'reply' }).click();
      await createComment4Promise;
      await page.waitForTimeout(1000);

      // Navigate away and back
      await page.goto('/?debug=MOD');
      await page.waitForTimeout(1000);
      await page.getByText('Test Ref for New Indicators').click();
      await page.waitForTimeout(500);

      // Check for "(2 new)" indicator (4 total - 2 previously seen)
      await expect(page.locator('.full-page.ref .actions')).toContainText('citation');
      await expect(page.locator('.full-page.ref .actions')).toContainText('(2 new)');
    });

    test('should persist "(X new)" across page reloads', async () => {
      // Reload the page
      await page.reload();
      await page.waitForTimeout(1000);

      // Check that "(2 new)" is still there
      await expect(page.locator('.full-page.ref .actions')).toContainText('citation');
      await expect(page.locator('.full-page.ref .actions')).toContainText('(2 new)');
    });

    test('should reset counter when navigating to citations page', async () => {
      // Click on citations to view them
      await page.locator('.full-page.ref .actions a', { hasText: 'citation' }).first().click();

      // Wait for page to load and navigate away
      await page.waitForTimeout(1000);
      await page.goto('/?debug=MOD');
      await page.waitForTimeout(1000);
      await page.getByText('Test Ref for New Indicators').click();
      await page.waitForTimeout(500);

      // Verify "(X new)" is cleared
      await expect(page.locator('.full-page.ref .actions')).toContainText('citation');
      await expect(page.locator('.full-page.ref .actions')).not.toContainText('new');
    });
  });
});
