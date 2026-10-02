import { expect, test } from '@playwright/test';
import { deleteRef, mod } from './setup';

const URL = 'https://jasperkm.info/plugin-map-test';

test.describe.serial('Map Plugin', () => {

  test('enable map mod', async ({ page }) => {
    await mod(page, '#mod-map');
  });

  test('delete test ref', async ({ page }) => {
    await deleteRef(page, URL);
  });

  test('location input map picker selects a location', async ({ page }) => {
    await page.context().grantPermissions(['geolocation']);
    await page.context().setGeolocation({ longitude: -63.5, latitude: 44.6 });
    await page.goto('/submit/web?debug=ADMIN&url=' + encodeURIComponent(URL)
      + '&tag=plugin/map&tag=plugin/geo/polygon&tag=plugin/geo/point', { waitUntil: 'networkidle' });
    await page.locator('[name=title]').fill('Map Plugin Test');

    const point = page.locator('.location-field').first();
    await point.locator('.location-map-toggle').click();
    // Defaults to the current position when no location is set
    await expect(point.locator('input').nth(0)).toHaveValue('-63.5');
    await expect(point.locator('input').nth(1)).toHaveValue('44.6');

    const map = point.locator('.location-map .maplibregl-canvas');
    await expect(map).toBeVisible({ timeout: 15_000 });
    await expect(point.locator('.location-marker')).toBeVisible();

    // Clicking anywhere on the map selects that location
    const box = (await map.boundingBox())!;
    expect(box.width).toBeGreaterThan(300);
    await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.25);
    await expect(point.locator('input').nth(0)).not.toHaveValue('-63.5');
    await expect(point.locator('input').nth(1)).not.toHaveValue('44.6');

    // Closing the map removes it
    await point.locator('.location-map-toggle').click();
    await expect(point.locator('.location-map')).toHaveCount(0);
  });

  test('plugin/map embeds the ref geo features', async ({ page }) => {
    await page.goto('/submit/web?debug=ADMIN&url=' + encodeURIComponent(URL)
      + '&tag=plugin/map&tag=plugin/geo/point', { waitUntil: 'networkidle' });
    await page.locator('[name=title]').fill('Map Plugin Test');
    const point = page.locator('.location-field').first();
    await point.locator('input').nth(0).fill('-63.5');
    await point.locator('input').nth(1).fill('44.6');
    await page.locator('.bbox-field .bbox-west').fill('-65');
    await page.locator('.bbox-field .bbox-south').fill('44');
    await page.locator('.bbox-field .bbox-east').fill('-62');
    await page.locator('.bbox-field .bbox-north').fill('45');
    const submitPromise = page.waitForResponse(
      resp => resp.url().includes('/api/v1/ref') && resp.request().method() === 'POST' && resp.ok(),
    );
    await page.locator('button', { hasText: 'Submit' }).click();
    await submitPromise;

    await expect(page.locator('.full-page.ref .map-embed .maplibregl-map')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.full-page.ref .map-embed .maplibregl-marker')).toBeVisible();
  });

  test('cleanup', async ({ page }) => {
    await deleteRef(page, URL);
  });
});
