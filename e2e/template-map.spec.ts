import { expect, test } from '@playwright/test';
import { clearAll, mod, openSidebar } from './setup';

test.describe.serial('Map Template', () => {

  test('clear all', async ({ page }) => {
    await clearAll(page);
  });

  test('enable map mod', async ({ page }) => {
    await mod(page, '#mod-map');
  });

  test('map tab appears and lens can be selected', async ({ page }) => {
    await page.goto('/?debug=ADMIN', { waitUntil: 'networkidle' });

    // The map tab should appear as a global lens option after enabling the mod
    const mapTab = page.locator('.tabs a', { hasText: 'map' });
    await expect(mapTab).toBeVisible();

    // Click the map tab to switch to map lens
    await mapTab.click();

    // URL reflects the map view selection
    await expect(page).toHaveURL(/view=map/);

    // The map component container should appear (may show 'No results found' without geo data)
    await expect(page.locator('.map.ext')).toBeVisible({ timeout: 10_000 });
  });

  test('map renders maplibregl-map element when refs are present', async ({ page }) => {
    // Submit a ref so there is page content in the map view
    await page.goto('/?debug=ADMIN', { waitUntil: 'networkidle' });
    await openSidebar(page);
    await page.locator('.sidebar .submit-button', { hasText: 'Submit' }).first().click();
    await page.locator('#url').fill('https://jasperkm.info/');
    await page.getByText('Next').click();
    await page.locator('[name=title]').fill('Map Test Ref');
    const submitPromise = page.waitForResponse(
      resp => resp.url().includes('/api/v1/ref') && resp.request().method() === 'POST' && resp.ok(),
    );
    await page.locator('button', { hasText: 'Submit' }).click();
    await submitPromise;
    await expect(page.locator('.full-page.ref .link a')).toHaveText('Map Test Ref');

    // Navigate to the map view
    await page.goto('/?view=map&debug=ADMIN', { waitUntil: 'networkidle' });

    // mgl-map should render when refs are present (tile errors are acceptable)
    await expect(page.locator('.maplibregl-map')).toBeVisible({ timeout: 15_000 });
  });

});
