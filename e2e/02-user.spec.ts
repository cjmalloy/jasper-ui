import { expect, test } from '@playwright/test';
import { clearMods } from './setup';

test.describe.serial('User Page', () => {

  test('clear mods', async ({ page }) => {
    await clearMods(page);
  });

  test('enable user plugin', async ({ page }) => {
    await page.goto('/?debug=ADMIN');
    await page.locator('.settings a', { hasText: 'settings' }).click();
    await page.locator('.tabs a', { hasText: 'setup' }).first().click();

    await page.locator('#mod-user').check();
    await page.locator('button', { hasText: 'Save' }).click();
    await page.locator('.log div', { hasText: 'Success.' }).first().waitFor({ timeout: 15_000, state: 'attached' });
  });

  test('displays inbox and outbox navigation buttons on user page', async ({ page }) => {
    await page.goto('/tag/user/alice?debug=USER&tag=alice');
    await expect(page).toHaveURL(/\/tag\/user\/alice/);
    await expect(page.locator('.sidebar .tag-select')).toBeVisible();
    await expect(page.locator('.sidebar .tag-select', { hasText: 'Inbox' })).toBeVisible();
    await expect(page.locator('.sidebar .tag-select', { hasText: 'Outbox' })).toBeVisible();
  });

  test('inbox button navigates to public user tag and is active', async ({ page }) => {
    await page.goto('/tag/user/alice?debug=USER&tag=alice');
    await page.locator('.sidebar .tag-select').getByText('Inbox').click();
    await expect(page).toHaveURL(/\/tag\/user\/alice/);
    await expect(page.locator('.sidebar .tag-select').getByText('Inbox').locator('..')).toHaveClass(/toggled/);
    await expect(page.locator('.sidebar .tag-select').getByText('Outbox').locator('..')).not.toHaveClass(/toggled/);
  });

  test('outbox button navigates to protected user tag and is active', async ({ page }) => {
    await page.goto('/tag/user/alice?debug=USER&tag=alice');
    await page.locator('.sidebar .tag-select').getByText('Outbox').click();
    await expect(page).toHaveURL(/\/tag\/\+user\/alice/);
    await expect(page.locator('.sidebar .tag-select').getByText('Outbox').locator('..')).toHaveClass(/toggled/);
    await expect(page.locator('.sidebar .tag-select').getByText('Inbox').locator('..')).not.toHaveClass(/toggled/);
  });

  test('outbox button is active when viewing protected user tag', async ({ page }) => {
    await page.goto('/tag/+user/alice?debug=USER&tag=alice');
    await expect(page.locator('.sidebar .tag-select').getByText('Outbox').locator('..')).toHaveClass(/toggled/);
    await expect(page.locator('.sidebar .tag-select').getByText('Inbox').locator('..')).not.toHaveClass(/toggled/);
  });

  test('navigation works for different user tags', async ({ page }) => {
    await page.goto('/tag/user/bob?debug=USER&tag=bob');
    await expect(page).toHaveURL(/\/tag\/user\/bob/);
    await expect(page.locator('.sidebar .tag-select', { hasText: 'Inbox' })).toBeVisible();
    await page.locator('.sidebar .tag-select').getByText('Inbox').click();
    await expect(page).toHaveURL(/\/tag\/user\/bob/);
    await page.locator('.sidebar .tag-select').getByText('Outbox').click();
    await expect(page).toHaveURL(/\/tag\/\+user\/bob/);
  });
});
