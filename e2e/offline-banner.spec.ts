import { expect } from '@playwright/test';
import { test } from './setup';

test.describe('Offline Banner', () => {
  test('keeps the floating sidebar below the tabs', async ({ page, context }) => {
    await page.goto('/tag/science?debug=USER', { waitUntil: 'networkidle' });
    const tabs = page.locator('.tabs').first();
    const sidebar = page.locator('.sidebar.floating');
    await expect(sidebar).toBeVisible();
    const gap = async () => (await sidebar.boundingBox())!.y - (await tabs.boundingBox())!.y;
    const before = await gap();

    await context.setOffline(true);
    await expect(page.locator('.offline-banner')).toBeVisible();
    expect(await gap()).toBeCloseTo(before, 0);

    await context.setOffline(false);
    await expect(page.locator('.offline-banner')).toHaveCount(0);
    expect(await gap()).toBeCloseTo(before, 0);
  });
});
