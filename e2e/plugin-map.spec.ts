import { expect, test } from '@playwright/test';
import { deleteRef, mod } from './setup';

const URL = 'https://jasperkm.info/plugin-map-test';
const POLYGON_URL = 'https://jasperkm.info/plugin-map-polygon-test';
const GEO_URL = 'geo:44.65,-63.57';
const CORS = { 'Access-Control-Allow-Origin': '*' };

test.describe.serial('Map Plugin', () => {

  test('enable map mod', async ({ page }) => {
    await mod(page, '#mod-map');
  });

  test('delete test ref', async ({ page }) => {
    await deleteRef(page, URL);
    await deleteRef(page, POLYGON_URL);
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
    await expect(point.locator('.location-marker')).toBeVisible({ timeout: 15_000 });

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

  test('one map is shared by every point in a list', async ({ page }) => {
    await page.goto('/submit/web?debug=ADMIN&url=' + encodeURIComponent(URL)
      + '&tag=plugin/geo/multipoint', { waitUntil: 'networkidle' });
    const list = page.locator('.plugin-content formly-list-section').first();
    await list.locator('button', { hasText: '+ Add Point' }).click();
    await list.locator('button', { hasText: '+ Add Point' }).click();
    const points = list.locator('.location-field');
    await expect(points).toHaveCount(2);
    await points.nth(0).locator('input').nth(0).fill('-63.5');
    await points.nth(0).locator('input').nth(1).fill('44.6');
    await points.nth(1).locator('input').nth(0).fill('-63.4');
    await points.nth(1).locator('input').nth(1).fill('44.7');

    await points.nth(0).locator('.location-map-toggle').click();
    const map = page.locator('.location-map');
    await expect(map).toHaveCount(1);
    await expect(map.locator('.maplibregl-canvas')).toBeVisible({ timeout: 15_000 });
    // The map is not inside a list item
    await expect(list.locator('.list-drag .location-map')).toHaveCount(0);
    await expect(map.locator('.location-marker')).toHaveCount(2, { timeout: 15_000 });
    await expect(map.locator('.location-marker.active')).toHaveCount(1);

    // Selecting another point reuses the same map
    await points.nth(1).locator('.location-map-toggle').click();
    await expect(map).toHaveCount(1);
    await expect(points.nth(1).locator('.location-map-toggle')).toHaveClass(/toggled/);
    await expect(points.nth(0).locator('.location-map-toggle')).not.toHaveClass(/toggled/);

    // Dragging the map pans it instead of reordering the list
    const box = (await map.locator('.maplibregl-canvas').boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.8);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.6, { steps: 10 });
    await page.mouse.up();
    await expect(page.locator('.cdk-drag-preview')).toHaveCount(0);
    await expect(points.nth(0).locator('input').nth(0)).toHaveValue('-63.5');
    await expect(points.nth(1).locator('input').nth(0)).toHaveValue('-63.4');

    // Clicking the map moves only the active point
    await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.25);
    await expect(points.nth(1).locator('input').nth(0)).not.toHaveValue('-63.4');
    await expect(points.nth(0).locator('input').nth(0)).toHaveValue('-63.5');

    // Toggling the active point closes the map
    await points.nth(1).locator('.location-map-toggle').click();
    await expect(page.locator('.location-map')).toHaveCount(0);
  });

  test('polygon rings are closed automatically', async ({ page }) => {
    await page.goto('/submit/web?debug=ADMIN&url=' + encodeURIComponent(POLYGON_URL)
      + '&tag=plugin/geo/polygon', { waitUntil: 'networkidle' });
    await page.locator('[name=title]').fill('Map Polygon Test');
    await page.locator('button', { hasText: '+ Add Ring' }).click();
    const ring = page.locator('.plugin-content formly-list-section formly-list-section').first();
    const points = ring.locator('.location-field');
    const coords = [[-63.5, 44.6], [-63.4, 44.6], [-63.4, 44.7]];
    for (let i = 0; i < coords.length; i++) {
      await ring.locator('button', { hasText: '+ Add Point' }).click();
      await points.nth(i).locator('input').nth(0).fill('' + coords[i][0]);
      await points.nth(i).locator('input').nth(1).fill('' + coords[i][1]);
    }
    // The closing position is hidden
    await expect(points).toHaveCount(3);
    // New points are added before the closing position
    await ring.locator('button', { hasText: '+ Add Point' }).click();
    await expect(points).toHaveCount(4);
    await points.nth(3).locator('input').nth(0).fill('-63.5');
    await points.nth(3).locator('input').nth(1).fill('44.7');
    // Moving the first position moves the closing position
    await points.nth(0).locator('input').nth(0).fill('-63.6');

    const submitPromise = page.waitForRequest(
      req => req.url().includes('/api/v1/ref') && req.method() === 'POST',
    );
    await page.locator('button', { hasText: 'Submit' }).click();
    const ref = (await submitPromise).postDataJSON();
    expect(ref.plugins['plugin/geo/polygon'].geometry.coordinates).toEqual([[
      [-63.6, 44.6], [-63.4, 44.6], [-63.4, 44.7], [-63.5, 44.7], [-63.6, 44.6],
    ]]);
  });

  test('location input map picker searches an address', async ({ page }) => {
    let query = '';
    await page.route('https://nominatim.openstreetmap.org/search**', route => {
      query = new globalThis.URL(route.request().url()).searchParams.get('q') || '';
      return route.fulfill({ headers: CORS, json: [{ display_name: 'Halifax, Nova Scotia, Canada', lat: '44.65', lon: '-63.57' }] });
    });
    await page.goto('/submit/web?debug=ADMIN&url=' + encodeURIComponent(URL)
      + '&tag=plugin/geo/point', { waitUntil: 'networkidle' });
    const point = page.locator('.location-field').first();
    await point.locator('input').nth(0).fill('-63.5');
    await point.locator('input').nth(1).fill('44.6');
    await point.locator('.location-map-toggle').click();
    await expect(point.locator('.location-map .maplibregl-canvas')).toBeVisible({ timeout: 15_000 });

    const search = point.locator('.location-map .maplibregl-ctrl-geocoder--input');
    await search.fill('Halifax');
    await search.press('Enter');
    const result = point.locator('.maplibregl-ctrl-geocoder .suggestions li', { hasText: 'Nova Scotia' });
    await result.click();
    expect(query).toBe('Halifax');
    await expect(result).toBeHidden();
    // Search only marks the result, it does not move the location
    const found = point.locator('.location-map .geocode-marker');
    await expect(found).toBeVisible();
    await expect(point.locator('input').nth(0)).toHaveValue('-63.5');
    await expect(point.locator('input').nth(1)).toHaveValue('44.6');
    // Clicking the result marker moves the location there
    await found.click();
    await expect(found).toHaveCount(0);
    await expect(point.locator('input').nth(0)).toHaveValue('-63.57');
    await expect(point.locator('input').nth(1)).toHaveValue('44.65');
  });

  test('title scraper reverse geocodes the location', async ({ page }) => {
    await page.route('https://nominatim.openstreetmap.org/reverse**', route => route.fulfill({
      headers: CORS,
      json: { display_name: 'Citadel Hill, Halifax, Nova Scotia, Canada', lat: '44.65', lon: '-63.57' },
    }));
    await page.goto('/submit/web?debug=ADMIN&url=' + encodeURIComponent(GEO_URL)
      + '&tag=plugin/geo/point', { waitUntil: 'networkidle' });
    // Only shown for web URLs or Refs with a location
    await expect(page.locator('.scrape-title')).toHaveCount(0);
    const point = page.locator('.location-field').first();
    await point.locator('input').nth(0).fill('-63.57');
    await point.locator('input').nth(1).fill('44.65');
    await page.locator('.scrape-title').click();
    await expect(page.locator('[name=title]')).toHaveValue('Citadel Hill, Halifax, Nova Scotia, Canada');
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
    // Address search is shown when geocoding is configured
    await expect(page.locator('.full-page.ref .map-embed .maplibregl-ctrl-top-left .maplibregl-ctrl-geocoder--input')).toBeVisible();
    await expect(page.locator('.full-page.ref .map-embed .maplibregl-ctrl-bottom-left .maplibregl-ctrl-zoom-in')).toBeVisible();
  });

  test('map search result submits a ref at that location', async ({ page }) => {
    await page.route('https://nominatim.openstreetmap.org/search**', route => route.fulfill({
      headers: CORS,
      json: [{ display_name: 'Halifax, Nova Scotia, Canada', lat: '44.65', lon: '-63.57' }],
    }));
    await page.goto('/ref/e/' + encodeURIComponent(URL) + '?debug=ADMIN', { waitUntil: 'networkidle' });
    const embed = page.locator('.full-page.ref .map-embed');
    const search = embed.locator('.maplibregl-ctrl-geocoder--input');
    await search.fill('Halifax');
    await search.press('Enter');
    await embed.locator('.maplibregl-ctrl-geocoder .suggestions li', { hasText: 'Nova Scotia' }).click();
    const found = embed.locator('.geocode-marker');
    await expect(found).toBeVisible();
    await found.click();
    await expect(page).toHaveURL(/\/submit\/text\?/);
    await expect(page.locator('[name=title]')).toHaveValue('Halifax, Nova Scotia, Canada');
    const point = page.locator('.location-field').first();
    await expect(point.locator('input').nth(0)).toHaveValue('-63.57');
    await expect(point.locator('input').nth(1)).toHaveValue('44.65');
  });

  test('cleanup', async ({ page }) => {
    await deleteRef(page, URL);
    await deleteRef(page, POLYGON_URL);
  });
});
