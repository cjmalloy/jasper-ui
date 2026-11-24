import { expect } from '@playwright/test';
import { test } from './setup';

test('tabs recover after collapsing into floating tabs', async ({ page }) => {
  await page.goto('/tags?debug=ADMIN', { waitUntil: 'networkidle' });
  const tabs = page.locator('.tabs').first();
  const visibleTabs = tabs.locator(':scope > a:not(.logo):visible');
  await expect(visibleTabs).not.toHaveCount(1);
  const count = await visibleTabs.count();

  await page.setViewportSize({ width: 360, height: 720 });
  await expect(tabs).toHaveClass(/floating-tabs/);
  await expect(visibleTabs).toHaveCount(1);

  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(tabs).not.toHaveClass(/floating-tabs/);
  await expect(visibleTabs).toHaveCount(count);
});
