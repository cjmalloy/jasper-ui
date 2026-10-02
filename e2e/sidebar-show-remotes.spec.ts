import { expect, test } from '@playwright/test';
import { mod } from './setup';

test.describe.serial('Sidebar Show Remotes', () => {
  test('loads origin mod', async ({ page }) => {
    await mod(page, '#mod-origin');
  });

  test('shows checkbox in expanded sidebar on desktop', async ({ page }) => {
    await page.goto('/settings/plugin?debug=ADMIN', { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.setItem('sidebar-expanded', 'true'));
    await page.goto('/settings/plugin?debug=ADMIN', { waitUntil: 'networkidle' });
    await expect(page.locator('.sidebar.expanded')).toBeVisible();
    await expect(page.locator('.sidebar .show-remotes')).toBeVisible();
    await page.locator('.tabs a', { hasText: 'template' }).first().click();
    await expect(page).toHaveURL(/\/settings\/template/);
    await expect(page.locator('.sidebar .show-remotes')).toBeVisible();
  });

  test('hides checkbox in collapsed sidebar on desktop', async ({ page }) => {
    await page.goto('/settings/plugin?debug=ADMIN', { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.setItem('sidebar-expanded', 'false'));
    await page.goto('/settings/plugin?debug=ADMIN', { waitUntil: 'networkidle' });
    await expect(page.locator('.sidebar')).not.toHaveClass(/expanded/);
    await expect(page.locator('.sidebar .show-remotes')).toBeHidden();
  });

  test('shows checkbox in collapsed sidebar on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 720 });
    await page.goto('/settings/plugin?debug=ADMIN', { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.setItem('sidebar-expanded', 'false'));
    await page.goto('/settings/plugin?debug=ADMIN', { waitUntil: 'networkidle' });
    await expect(page.locator('.sidebar')).not.toHaveClass(/expanded/);
    await expect(page.locator('.sidebar .show-remotes')).toBeVisible();
    await page.locator('.sidebar .toggle').click();
    await expect(page.locator('.sidebar.expanded')).toBeVisible();
    await expect(page.locator('.sidebar .show-remotes')).toBeVisible();
    // Changing views on tablet collapses the sidebar
    await page.goto('/settings/template?debug=ADMIN', { waitUntil: 'networkidle' });
    await expect(page.locator('.sidebar .show-remotes')).toBeVisible();
    await page.locator('.sidebar .show-remotes input').check();
    await expect(page).toHaveURL(/showRemotes=true/);
  });
});
