import { test, expect, type Page } from '@playwright/test';
import { clearMods } from './setup';

test.describe.serial('User Page', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('loads the page', async () => {
    await page.goto('/?debug=ADMIN');
    await expect(page.getByText('Powered by Jasper')).toBeVisible({ timeout: 1000 * 60 });
  });

  test('clear mods', async () => {
    await clearMods(page);
  });

  test('enable user plugin', async () => {
    await page.goto('/?debug=ADMIN');
    await page.locator('.settings a', { hasText: 'settings' }).click();
    await page.locator('.tabs a').getByText('setup').click();

    await page.waitForTimeout(100);
    await page.locator('#mod-user').waitFor();
    await expect(page.locator('#mod-user')).not.toBeChecked();
    await page.locator('#mod-user').check();
    await expect(page.locator('#mod-user')).toBeChecked();
    await page.locator('button', { hasText: 'Save' }).click();
    await expect(page.locator('.log')).toContainText('Success');
  });

  test('displays inbox and outbox navigation buttons on user page', async () => {
    await page.goto('/tag/user/alice?debug=USER&tag=alice');
    await expect(page).toHaveURL(/\/tag\/user\/alice/);
    await expect(page.locator('.sidebar .tag-select')).toBeVisible();
    await expect(page.locator('.sidebar .tag-select', { hasText: 'Inbox' })).toBeVisible();
    await expect(page.locator('.sidebar .tag-select', { hasText: 'Outbox' })).toBeVisible();
  });

  test('inbox button navigates to public user tag and is active', async () => {
    await page.goto('/tag/user/alice?debug=USER&tag=alice');
    await page.locator('.sidebar .tag-select').getByText('Inbox').click();
    await expect(page).toHaveURL(/\/tag\/user\/alice/);
    await expect(page.locator('.sidebar .tag-select').getByText('Inbox').locator('..')).toHaveClass(/toggled/);
    await expect(page.locator('.sidebar .tag-select').getByText('Outbox').locator('..')).not.toHaveClass(/toggled/);
  });

  test('outbox button navigates to protected user tag and is active', async () => {
    await page.goto('/tag/user/alice?debug=USER&tag=alice');
    await page.locator('.sidebar .tag-select').getByText('Outbox').click();
    await expect(page).toHaveURL(/\/tag\/\+user\/alice/);
    await expect(page.locator('.sidebar .tag-select').getByText('Outbox').locator('..')).toHaveClass(/toggled/);
    await expect(page.locator('.sidebar .tag-select').getByText('Inbox').locator('..')).not.toHaveClass(/toggled/);
  });

  test('outbox button is active when viewing protected user tag', async () => {
    await page.goto('/tag/+user/alice?debug=USER&tag=alice');
    await expect(page.locator('.sidebar .tag-select').getByText('Outbox').locator('..')).toHaveClass(/toggled/);
    await expect(page.locator('.sidebar .tag-select').getByText('Inbox').locator('..')).not.toHaveClass(/toggled/);
  });

  test('navigation works for different user tags', async () => {
    await page.goto('/tag/user/bob?debug=USER&tag=bob');
    await expect(page).toHaveURL(/\/tag\/user\/bob/);
    await expect(page.locator('.sidebar .tag-select', { hasText: 'Inbox' })).toBeVisible();
    await page.locator('.sidebar .tag-select').getByText('Inbox').click();
    await expect(page).toHaveURL(/\/tag\/user\/bob/);
    await page.locator('.sidebar .tag-select').getByText('Outbox').click();
    await expect(page).toHaveURL(/\/tag\/\+user\/bob/);
  });
});
