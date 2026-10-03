import { expect, test } from '@playwright/test';
import { closeSidebar, deleteRef, mod, openSidebar } from './setup';

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
      + '&tag=plugin/geo/polygon&tag=plugin/geo/point', { waitUntil: 'networkidle' });
    await page.locator('[name=title]').fill('Map Plugin Test');

    const point = page.locator('.location-field').first();
    await point.locator('.location-map-toggle').click();
    // Defaults to the current position when no location is set
    await expect(point.locator('input[type=number]').nth(0)).toHaveValue('-63.5');
    await expect(point.locator('input[type=number]').nth(1)).toHaveValue('44.6');

    const map = point.locator('.location-map .maplibregl-canvas');
    await expect(map).toBeVisible({ timeout: 15_000 });
    await expect(point.locator('.location-marker')).toBeVisible({ timeout: 15_000 });

    // Clicking anywhere on the map selects that location
    const box = (await map.boundingBox())!;
    expect(box.width).toBeGreaterThan(300);
    await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.25);
    await expect(point.locator('input[type=number]').nth(0)).not.toHaveValue('-63.5');
    await expect(point.locator('input[type=number]').nth(1)).not.toHaveValue('44.6');

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
    await list.locator('button', { hasText: '+ Add Point' }).click();
    const points = list.locator('.location-field');
    await expect(points).toHaveCount(3);
    await points.nth(0).locator('input[type=number]').nth(0).fill('-63.5');
    await points.nth(0).locator('input[type=number]').nth(1).fill('44.6');
    await points.nth(1).locator('input[type=number]').nth(0).fill('-63.4');
    await points.nth(1).locator('input[type=number]').nth(1).fill('44.7');

    await points.nth(0).locator('.location-map-toggle').click();
    const map = page.locator('.location-map');
    await expect(map).toHaveCount(1);
    // The map is shown above the location input that opened it
    await expect(points.nth(0).locator('.location-map .maplibregl-canvas')).toBeVisible({ timeout: 15_000 });
    expect((await map.boundingBox())!.y).toBeLessThan((await points.nth(0).locator('input[type=number]').first().boundingBox())!.y);
    await expect(map.locator('.location-marker')).toHaveCount(2, { timeout: 15_000 });
    await expect(map.locator('.location-marker.active')).toHaveCount(1);

    // Opening the map on another point closes the first one
    await points.nth(1).locator('.location-map-toggle').click();
    await expect(map).toHaveCount(1);
    await expect(points.nth(0).locator('.location-map')).toHaveCount(0);
    await expect(points.nth(1).locator('.location-map .maplibregl-canvas')).toBeVisible({ timeout: 15_000 });
    await expect(points.nth(1).locator('.location-map-toggle')).toHaveClass(/toggled/);
    await expect(points.nth(0).locator('.location-map-toggle')).not.toHaveClass(/toggled/);

    // Dragging the map pans it instead of reordering the list
    const box = (await map.locator('.maplibregl-canvas').boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.8);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.6, { steps: 10 });
    await page.mouse.up();
    await expect(page.locator('.cdk-drag-preview')).toHaveCount(0);
    await expect(points.nth(0).locator('input[type=number]').nth(0)).toHaveValue('-63.5');
    await expect(points.nth(1).locator('input[type=number]').nth(0)).toHaveValue('-63.4');

    // Clicking the map moves only the active point
    await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.25);
    await expect(points.nth(1).locator('input[type=number]').nth(0)).not.toHaveValue('-63.4');
    await expect(points.nth(0).locator('input[type=number]').nth(0)).toHaveValue('-63.5');

    // Removing another point keeps the map open
    await list.locator('.list-drag').nth(2).locator('> button', { hasText: '–' }).click();
    await expect(points).toHaveCount(2);
    await expect(points.nth(1).locator('.location-map')).toHaveCount(1);

    // Removing the point the map is shown above removes the map
    await list.locator('.list-drag').nth(1).locator('> button', { hasText: '–' }).click();
    await expect(points).toHaveCount(1);
    await expect(page.locator('.location-map')).toHaveCount(0);
    await expect(points.nth(0).locator('.location-map-toggle')).not.toHaveClass(/toggled/);

    // Toggling the point closes the map
    await points.nth(0).locator('.location-map-toggle').click();
    await expect(page.locator('.location-map')).toHaveCount(1);
    await points.nth(0).locator('.location-map-toggle').click();
    await expect(page.locator('.location-map')).toHaveCount(0);
  });

  test('opening a map in another plugin closes the first one', async ({ page }) => {
    await page.goto('/submit/web?debug=ADMIN&url=' + encodeURIComponent(URL)
      + '&tag=plugin/geo/point&tag=plugin/geo/multipoint', { waitUntil: 'networkidle' });
    const list = page.locator('.plugin-content formly-list-section').first();
    await list.locator('button', { hasText: '+ Add Point' }).click();
    await expect(page.locator('.location-field')).toHaveCount(2);
    const fields = page.locator('.location-field');
    await fields.nth(0).locator('.location-map-toggle').click();
    await expect(fields.nth(0).locator('.location-map')).toHaveCount(1);
    await fields.nth(1).locator('.location-map-toggle').click();
    await expect(fields.nth(1).locator('.location-map')).toHaveCount(1);
    await expect(fields.nth(0).locator('.location-map')).toHaveCount(0);
    await expect(page.locator('.location-map')).toHaveCount(1);
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
      await points.nth(i).locator('input[type=number]').nth(0).fill('' + coords[i][0]);
      await points.nth(i).locator('input[type=number]').nth(1).fill('' + coords[i][1]);
    }
    // The closing position is hidden
    await expect(points).toHaveCount(3);
    // New points are added before the closing position
    await ring.locator('button', { hasText: '+ Add Point' }).click();
    await expect(points).toHaveCount(4);
    await points.nth(3).locator('input[type=number]').nth(0).fill('-63.5');
    await points.nth(3).locator('input[type=number]').nth(1).fill('44.7');
    // Moving the first position moves the closing position
    await points.nth(0).locator('input[type=number]').nth(0).fill('-63.6');
    const style = page.locator('.plugin-content .geo-style-field');
    await style.locator('.geo-style-color').fill('#ff0000');
    await style.locator('.geo-style-stroke-width').selectOption('large');
    await style.locator('.geo-style-stroke-style').selectOption('dashed');
    await style.locator('.geo-style-fill-color').fill('#00ff00');
    await style.locator('.geo-style-fill-style').selectOption('crosshatch');
    // Defaults are not stored
    await style.locator('.geo-style-stroke-style').selectOption('solid');
    await style.locator('.geo-style-stroke-style').selectOption('dashed');
    // Fill is on its own line below the stroke
    const strokeTop = (await style.locator('.geo-style-stroke').boundingBox())!.y;
    const fillTop = (await style.locator('.geo-style-fill').boundingBox())!.y;
    expect(fillTop).toBeGreaterThan(strokeTop + 10);

    const submitPromise = page.waitForRequest(
      req => req.url().includes('/api/v1/ref') && req.method() === 'POST',
    );
    await page.locator('button', { hasText: 'Submit' }).click();
    const ref = (await submitPromise).postDataJSON();
    expect(ref.plugins['plugin/geo/polygon'].geometry.coordinates).toEqual([[
      [-63.6, 44.6], [-63.4, 44.6], [-63.4, 44.7], [-63.5, 44.7], [-63.6, 44.6],
    ]]);
    expect(ref.plugins['plugin/geo/polygon'].properties).toEqual({
      color: '#ff0000',
      strokeWidth: 'large',
      strokeStyle: 'dashed',
      fillColor: '#00ff00',
      fillStyle: 'crosshatch',
    });
  });

  test('stroke and fill clear separately', async ({ page }) => {
    await page.goto('/submit/web?debug=ADMIN&url=' + encodeURIComponent(URL)
      + '&tag=plugin/geo/polygon', { waitUntil: 'networkidle' });
    const style = page.locator('.plugin-content .geo-style-field');
    await style.locator('.geo-style-color').fill('#ff0000');
    await style.locator('.geo-style-stroke-width').selectOption('large');
    await style.locator('.geo-style-stroke-style').selectOption('dotted');
    await style.locator('.geo-style-fill-color').fill('#00ff00');
    await style.locator('.geo-style-fill-style').selectOption('nw');
    await style.locator('.geo-style-stroke-clear').click();
    await expect(style.locator('.geo-style-stroke-width')).toHaveValue('medium');
    await expect(style.locator('.geo-style-stroke-style')).toHaveValue('solid');
    await expect(style.locator('.geo-style-color')).toHaveClass(/cleared/);
    await expect(style.locator('.geo-style-fill-style')).toHaveValue('nw');
    await expect(style.locator('.geo-style-fill-color')).not.toHaveClass(/cleared/);
    await style.locator('.geo-style-fill-clear').click();
    await expect(style.locator('.geo-style-fill-style')).toHaveValue('default');
    await expect(style.locator('.geo-style-fill-color')).toHaveClass(/cleared/);
  });

  test('line style hides the fill', async ({ page }) => {
    await page.goto('/submit/web?debug=ADMIN&url=' + encodeURIComponent(URL)
      + '&tag=plugin/geo/linestring', { waitUntil: 'networkidle' });
    const style = page.locator('.plugin-content .geo-style-field');
    await expect(style.locator('.geo-style-color')).toBeVisible();
    await expect(style.locator('.geo-style-stroke-style')).toBeVisible();
    await expect(style.locator('.geo-style-fill-style')).toHaveCount(0);
    await expect(style.locator('.geo-style-fill-color')).toHaveCount(0);
    await expect(style.locator('.geo-style-fill-clear')).toHaveCount(0);
    // Style fits on one line
    const boxes = await style.locator('input, select, button').evaluateAll(els => els.map(e => e.getBoundingClientRect().top));
    expect(Math.max(...boxes) - Math.min(...boxes)).toBeLessThan(10);
  });

  test('adding a point with the map open selects the new point', async ({ page }) => {
    await page.goto('/submit/web?debug=ADMIN&url=' + encodeURIComponent(URL)
      + '&tag=plugin/geo/linestring', { waitUntil: 'networkidle' });
    const list = page.locator('.plugin-content formly-list-section').first();
    const add = list.locator('button', { hasText: '+ Add Point' });
    await add.click();
    const points = list.locator('.location-field');
    await points.nth(0).locator('input[type=number]').nth(0).fill('-63.5');
    await points.nth(0).locator('input[type=number]').nth(1).fill('44.6');
    await points.nth(0).locator('.location-map-toggle').click();
    const map = page.locator('.location-map');
    const canvas = map.locator('.maplibregl-canvas');
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await expect(map.locator('.location-marker')).toHaveCount(1, { timeout: 15_000 });

    await add.click();
    await expect(points).toHaveCount(2);
    // The map stays above the location that opened it
    await expect(points.nth(0).locator('.location-map')).toHaveCount(1);
    await expect(points.nth(0).locator('.location-map-toggle')).toHaveClass(/toggled/);

    // Clicking the map places the new point, not the previous one
    const box = (await canvas.boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.25);
    await expect(points.nth(1).locator('input[type=number]').nth(0)).not.toHaveValue('-63.5');
    await expect(points.nth(0).locator('input[type=number]').nth(0)).toHaveValue('-63.5');
    await expect(points.nth(0).locator('input[type=number]').nth(1)).toHaveValue('44.6');
  });

  test('plugin/geo selects a single geometry', async ({ page }) => {
    await page.goto('/submit/web?debug=ADMIN&url=' + encodeURIComponent(URL), { waitUntil: 'networkidle' });
    await page.locator('.add-plugins-label select').selectOption('plugin/geo');
    const geometry = page.locator('.child-plugin-select');
    await expect(geometry).toBeVisible();
    // The select is the header of the plugin/geo form
    await expect(page.locator('.plugin-header .child-plugin-select')).toHaveCount(1);
    await expect(page.locator('.plugin-content .child-plugin-select')).toHaveCount(0);
    await geometry.selectOption('plugin/geo/polygon');
    await expect(page.locator('button', { hasText: '+ Add Ring' })).toBeVisible();
    await expect(geometry).toHaveValue('plugin/geo/polygon');

    await geometry.selectOption('plugin/geo/point');
    await expect(page.locator('button', { hasText: '+ Add Ring' })).toHaveCount(0);
    await expect(page.locator('.plugin-content .location-field')).toHaveCount(1);
    await expect(geometry).toHaveValue('plugin/geo/point');

    // The point is kept with one other geometry
    await geometry.selectOption('plugin/geo/linestring');
    await expect(geometry).toHaveValue('plugin/geo/linestring');
    await expect(page.locator('button', { hasText: '+ Add Point' })).toBeVisible();
    await expect(page.locator('.plugin-content .location-field')).toHaveCount(1);
    await geometry.selectOption('plugin/geo/polygon');
    await expect(geometry).toHaveValue('plugin/geo/polygon');
    await expect(page.locator('button', { hasText: '+ Add Ring' })).toBeVisible();
    await expect(page.locator('button', { hasText: '+ Add Point' })).toHaveCount(0);
    await expect(page.locator('.plugin-content .location-field')).toHaveCount(1);
    await geometry.selectOption('plugin/geo/point');
    await expect(geometry).toHaveValue('plugin/geo/point');
    await expect(page.locator('button', { hasText: '+ Add Ring' })).toHaveCount(0);
    await expect(page.locator('.plugin-content .location-field')).toHaveCount(1);

    // Removing the geometry removes the point too
    await geometry.selectOption('');
    await expect(page.locator('.plugin-content .location-field')).toHaveCount(0);
  });

  test('nested location inputs fit on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/submit/web?debug=ADMIN&url=' + encodeURIComponent(POLYGON_URL)
      + '&tag=plugin/geo/multipolygon', { waitUntil: 'networkidle' });
    await page.locator('button', { hasText: '+ Add Polygon' }).click();
    await page.locator('button', { hasText: '+ Add Ring' }).click();
    await page.locator('button', { hasText: '+ Add Point' }).click();
    const point = page.locator('.plugin-content .location-field').first();
    for (const el of await point.locator('input, button').all()) {
      const box = (await el.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(375);
    }
    for (const input of await point.locator('input[type=number]').all()) {
      expect((await input.boundingBox())!.width).toBeGreaterThanOrEqual(80);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });

  test('right click on the map adds a point to the active line', async ({ page }) => {
    await page.goto('/submit/web?debug=ADMIN&url=' + encodeURIComponent(URL)
      + '&tag=plugin/geo/linestring', { waitUntil: 'networkidle' });
    const list = page.locator('.plugin-content formly-list-section').first();
    await list.locator('button', { hasText: '+ Add Point' }).click();
    const points = list.locator('.location-field');
    await points.nth(0).locator('input[type=number]').nth(0).fill('-63.5');
    await points.nth(0).locator('input[type=number]').nth(1).fill('44.6');
    await points.nth(0).locator('.location-map-toggle').click();
    const canvas = page.locator('.location-map .maplibregl-canvas');
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    const box = (await canvas.boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.25, { button: 'right' });
    await page.mouse.click(box.x + box.width * 0.25, box.y + box.height * 0.75, { button: 'right' });
    await expect(points).toHaveCount(3);
    await expect(points.nth(1).locator('input[type=number]').nth(0)).not.toHaveValue('-63.5');
    await expect(points.nth(2).locator('input[type=number]').nth(0)).not.toHaveValue('-63.5');
    // The map stays open above the first point
    await expect(points.nth(0).locator('.location-map')).toHaveCount(1);
    await expect(page.locator('.location-map .location-marker')).toHaveCount(3);
  });

  test('changing the geometry on a text post keeps the location', async ({ page }) => {
    await page.goto('/submit/text?debug=ADMIN&tag=plugin/geo/point&location=-63.5,44.6', { waitUntil: 'networkidle' });
    // plugin/geo can be added to text posts
    await expect(page.locator('.select-plugin select option[value="plugin/geo"]')).toHaveCount(1);
    const geometry = page.locator('.child-plugin-select');
    await geometry.selectOption('plugin/geo/polygon');
    await expect(page.locator('button', { hasText: '+ Add Ring' })).toBeVisible();
    await expect(geometry).toHaveValue('plugin/geo/polygon');
    // A point becomes a polygon of that single point, and the point is kept
    const points = page.locator('.plugin-content .location-field');
    await expect(points).toHaveCount(2);
    for (let i = 0; i < 2; i++) {
      await expect(points.nth(i).locator('input[type=number]').nth(0)).toHaveValue('-63.5');
      await expect(points.nth(i).locator('input[type=number]').nth(1)).toHaveValue('44.6');
    }
    await expect(page.locator('.plugin-header .child-plugin-select')).toHaveCount(1);

    // Features add geometries to a list instead of replacing them
    await geometry.selectOption('plugin/geo/features');
    await expect(geometry).toHaveValue('plugin/geo/features');
    await expect(geometry.locator('option[value="plugin/geo/feature"]')).toHaveCount(0);
    const items = page.locator('.geometries-field .geometry-item');
    await expect(items).toHaveCount(1);
    await expect(items.nth(0).locator('input[type=number]').nth(0)).toHaveValue('-63.5');
    await page.locator('.geometries-field .geometry-add').selectOption('plugin/geo/linestring');
    await expect(items).toHaveCount(2);
    await expect(items.nth(1).locator('button', { hasText: '+ Add Point' })).toBeVisible();
    // Each feature has its own style, with a fill only for areas
    await expect(items.nth(0).locator('.geo-style-color')).toHaveCount(1);
    await expect(items.nth(0).locator('.geo-style-fill-style')).toHaveCount(1);
    await expect(items.nth(1).locator('.geo-style-color')).toHaveCount(1);
    await expect(items.nth(1).locator('.geo-style-fill-style')).toHaveCount(0);
    // The point is still kept
    await expect(page.locator('.plugin-content .location-field:not(.geometries-field .location-field)')).toHaveCount(1);
    await expect(items.nth(0).locator('input[type=number]').nth(0)).toHaveValue('-63.5');

    // Advanced form still edits the same geometry
    await page.getByText('show advanced').click();
    await expect(page.locator('.geometries-field .geometry-item')).toHaveCount(2);
  });

  test('location input map picker searches an address', async ({ page }) => {
    let query = '';
    let viewbox = '';
    await page.route('https://nominatim.openstreetmap.org/search**', route => {
      query = new globalThis.URL(route.request().url()).searchParams.get('q') || '';
      viewbox = new globalThis.URL(route.request().url()).searchParams.get('viewbox') || '';
      return route.fulfill({ headers: CORS, json: [{ display_name: 'Halifax, Nova Scotia, Canada', lat: '44.65', lon: '-63.57' }] });
    });
    await page.goto('/submit/web?debug=ADMIN&url=' + encodeURIComponent(URL)
      + '&tag=plugin/geo/point', { waitUntil: 'networkidle' });
    const point = page.locator('.location-field').first();
    await point.locator('input[type=number]').nth(0).fill('-63.5');
    await point.locator('input[type=number]').nth(1).fill('44.6');
    await point.locator('.location-map-toggle').click();
    await expect(point.locator('.location-map .maplibregl-canvas')).toBeVisible({ timeout: 15_000 });

    const search = point.locator('.location-map .maplibregl-ctrl-geocoder--input');
    await search.fill('Halifax');
    await search.press('Enter');
    const result = point.locator('.maplibregl-ctrl-geocoder .suggestions li', { hasText: 'Nova Scotia' });
    await result.click();
    expect(query).toBe('Halifax');
    // Search is biased toward the current view
    expect(viewbox.split(',').map(Number)).toHaveLength(4);
    await expect(result).toBeHidden();
    // Search only marks the result, it does not move the location
    const found = point.locator('.location-map .geocode-marker');
    await expect(found).toBeVisible();
    await expect(point.locator('input[type=number]').nth(0)).toHaveValue('-63.5');
    await expect(point.locator('input[type=number]').nth(1)).toHaveValue('44.6');
    // Clicking the result marker moves the location there
    await found.click();
    await expect(found).toHaveCount(0);
    await expect(point.locator('input[type=number]').nth(0)).toHaveValue('-63.57');
    await expect(point.locator('input[type=number]').nth(1)).toHaveValue('44.65');
  });

  test('location input map picker expands the address search while in use', async ({ page }) => {
    await page.route('https://nominatim.openstreetmap.org/search**', route => route.fulfill({
      headers: CORS,
      json: [{ display_name: 'Halifax, Nova Scotia, Canada', lat: '44.65', lon: '-63.57' }],
    }));
    await page.goto('/submit/web?debug=ADMIN&url=' + encodeURIComponent(URL)
      + '&tag=plugin/geo/point', { waitUntil: 'networkidle' });
    const point = page.locator('.location-field').first();
    await point.locator('input[type=number]').nth(0).fill('-63.5');
    await point.locator('input[type=number]').nth(1).fill('44.6');
    await point.locator('.location-map-toggle').click();
    const map = point.locator('.location-map mgl-map');
    await expect(point.locator('.location-map .maplibregl-canvas')).toBeVisible({ timeout: 15_000 });
    const mapWidth = (await map.boundingBox())!.width;
    const geocoder = point.locator('.location-map .maplibregl-ctrl-geocoder');
    const search = geocoder.locator('.maplibregl-ctrl-geocoder--input');
    const width = async () => (await geocoder.boundingBox())!.width;

    // Default size while not in use
    const initial = await width();
    expect(initial).toBeLessThan(mapWidth * 0.6);

    // Expands while focused, animating up from the default size without shrinking first
    const smallest = geocoder.evaluate(el => new Promise<number>(resolve => {
      let min = Infinity;
      const end = performance.now() + 400;
      const sample = () => {
        min = Math.min(min, el.getBoundingClientRect().width);
        if (performance.now() < end) requestAnimationFrame(sample); else resolve(min);
      };
      sample();
    }));
    await search.focus();
    expect(await smallest).toBeGreaterThanOrEqual(initial - 1);
    await expect.poll(width).toBeGreaterThan(mapWidth * 0.75);
    expect(await width()).toBeLessThanOrEqual(mapWidth - 20);

    // Stays expanded after blur while there is a query
    await search.fill('Halifax');
    await search.press('Enter');
    const suggestions = geocoder.locator('.suggestions');
    await expect(suggestions.locator('li', { hasText: 'Nova Scotia' })).toBeVisible();
    // Results dropdown expands with the box
    expect((await suggestions.boundingBox())!.width).toBeGreaterThan(mapWidth * 0.75);
    await search.blur();
    await expect.poll(width).toBeGreaterThan(mapWidth * 0.75);

    // Shrinks back when empty and unfocused
    // (retry: the geocoder's debounced keydown handler refocuses the input after the query is cleared)
    await search.fill('');
    await expect(async () => {
      await search.blur();
      await expect.poll(width, { timeout: 1_000 }).toBeCloseTo(initial, 0);
      await page.waitForTimeout(300);
      expect(await width()).toBeCloseTo(initial, 0);
    }).toPass();

    // The map still renders at full size
    expect((await map.boundingBox())!.width).toBeCloseTo(mapWidth, 0);
    expect((await map.boundingBox())!.height).toBeGreaterThan(250);
  });

  test('editors never reverse geocode', async ({ page }) => {
    let reverse = 0;
    await page.route('https://nominatim.openstreetmap.org/reverse**', route => {
      reverse++;
      return route.fulfill({ status: 426, headers: CORS, body: '' });
    });
    for (const url of [
      '/submit/web?debug=ADMIN&url=' + encodeURIComponent(GEO_URL) + '&tag=plugin/geo/point',
      '/submit/text?debug=ADMIN&tag=plugin/geo/point',
    ]) {
      await page.goto(url, { waitUntil: 'networkidle' });
      const point = page.locator('.location-field').first();
      await point.locator('input[type=number]').nth(0).fill('-63.57');
      await point.locator('input[type=number]').nth(1).fill('44.65');
      await point.locator('.location-map-toggle').click();
      await expect(page.locator('.location-map .maplibregl-canvas')).toBeVisible({ timeout: 15_000 });
      await expect(page.locator('.scrape-title')).toHaveCount(0);
    }
    expect(reverse).toBe(0);
  });

  test('plugin/geo embeds the ref geo features', async ({ page }) => {
    // Record every scale the embed shows, to catch a jump from the default view
    await page.addInitScript(() => {
      (window as any).mapScales = [];
      new MutationObserver(() => {
        const scale = document.querySelector('.map-embed .maplibregl-ctrl-scale')?.textContent;
        const scales = (window as any).mapScales;
        if (scale && scales[scales.length - 1] !== scale) scales.push(scale);
      }).observe(document, { subtree: true, childList: true, characterData: true });
    });
    await page.goto('/submit/web?debug=ADMIN&url=' + encodeURIComponent(URL)
      + '&tag=plugin/geo/point', { waitUntil: 'networkidle' });
    await page.locator('[name=title]').fill('Map Plugin Test');
    const point = page.locator('.location-field').first();
    await point.locator('input[type=number]').nth(0).fill('-63.5');
    await point.locator('input[type=number]').nth(1).fill('44.6');
    // Bounds are in the advanced form, toggled from the plugin/geo header row
    const advanced = page.locator('details.advanced.plugin_geo summary');
    const header = (await page.locator('.plugin-header .child-plugin-select').boundingBox())!;
    const toggle = (await page.locator('details.advanced.plugin_geo summary > span').boundingBox())!;
    // The toggle is centred on the header select
    expect(Math.abs(toggle.y + toggle.height / 2 - (header.y + header.height / 2))).toBeLessThan(3);
    await expect(page.locator('.bbox-field .bbox-west')).toBeHidden();
    await advanced.click();
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
    // Map is created fitted to the features instead of jumping there from the style's default view
    expect(await page.evaluate(() => (window as any).mapScales)).toHaveLength(1);
    // Ref markers show the Ref title
    await expect(page.locator('.full-page.ref .map-embed .map-thumbnail')).toHaveAttribute('title', 'Map Plugin Test');
    // Address search is shown when geocoding is configured
    await expect(page.locator('.full-page.ref .map-embed .maplibregl-ctrl-top-left .maplibregl-ctrl-geocoder--input')).toBeVisible();
    await expect(page.locator('.full-page.ref .map-embed .maplibregl-ctrl-bottom-left .maplibregl-ctrl-zoom-in')).toBeVisible();
    // Zoom controls sit above the scale bar
    await expect(page.locator('.full-page.ref .map-embed .maplibregl-ctrl-bottom-left > .maplibregl-ctrl-scale:last-child')).toBeVisible();
    // Map renders at full size and the address search expands while in use
    await closeSidebar(page);
    const embedMap = (await page.locator('.full-page.ref .map-embed mgl-map').boundingBox())!;
    expect(embedMap.height).toBeGreaterThan(300);
    const geocoder = page.locator('.full-page.ref .map-embed .maplibregl-ctrl-geocoder');
    expect((await geocoder.boundingBox())!.width).toBeLessThan(embedMap.width * 0.6);
    await geocoder.locator('.maplibregl-ctrl-geocoder--input').focus();
    await expect.poll(async () => (await geocoder.boundingBox())!.width).toBeGreaterThan(embedMap.width * 0.75);
    await openSidebar(page);
    await geocoder.locator('.maplibregl-ctrl-geocoder--input').focus();
    await expect.poll(async () => {
      const map = (await page.locator('.full-page.ref .map-embed mgl-map').boundingBox())!;
      const sidebarWidth = await page.locator('.sidebar').evaluate(el => parseFloat(getComputedStyle(el).width));
      return (await geocoder.boundingBox())!.width - Math.max(0, map.width * 0.9 - sidebarWidth);
    }).toBeCloseTo(0, 0);
  });

  for (const tag of ['@*', 'plugin/geo', 'plugin/geo/point']) {
    test(`plugin/geo map expands in the ${tag} list`, async ({ page }) => {
      await page.goto(`/tag/${tag}?debug=ADMIN`, { waitUntil: 'networkidle' });
      const ref = page.locator('.ref-list .ref', { hasText: 'Map Plugin Test' });
      await ref.locator('button.toggle').click();
      await expect(page.locator('.ref-list .map-embed .maplibregl-map')).toBeVisible({ timeout: 15_000 });
    });
  }

  test('map search accounts for the floating sidebar and stays underneath it', async ({ page }) => {
    await page.goto('/tag/@*?debug=ADMIN&view=map', { waitUntil: 'networkidle' });
    await closeSidebar(page);
    const map = page.locator('.map.ext .maplibregl-map');
    await expect(map).toBeVisible();
    const mapWidth = (await map.boundingBox())!.width;
    const geocoder = map.locator('.maplibregl-ctrl-geocoder');
    const search = geocoder.locator('.maplibregl-ctrl-geocoder--input');
    const width = async () => (await geocoder.boundingBox())!.width;
    await search.focus();
    await expect.poll(width).toBeCloseTo(mapWidth * 0.8, 0);

    await openSidebar(page);
    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toHaveClass(/floating/);
    await expect.poll(() => sidebar.evaluate(el => parseFloat(getComputedStyle(el).width))).toBeCloseTo(416, 0);
    await search.fill('Halifax');
    await search.blur();
    await expect.poll(width).toBeCloseTo(mapWidth * 0.9 - 416, 0);
    expect((await geocoder.boundingBox())!.x + await width()).toBeLessThan((await sidebar.boundingBox())!.x);

    // Even an oversized control must paint underneath the sidebar.
    await geocoder.evaluate(el => { el.style.width = '100cqw'; el.style.maxWidth = 'none'; });
    const sidebarBox = (await sidebar.boundingBox())!;
    const controlBox = (await geocoder.boundingBox())!;
    expect(await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('.sidebar'), {
      x: sidebarBox.x + 10,
      y: controlBox.y + controlBox.height / 2,
    })).toBe(true);
    await geocoder.evaluate(el => { el.style.removeProperty('width'); el.style.removeProperty('max-width'); });

    await closeSidebar(page);
    await expect.poll(width).toBeCloseTo(mapWidth * 0.8, 0);
    await page.setViewportSize({ width: 900, height: 720 });
    await openSidebar(page);
    await expect.poll(async () => await width() - (await map.boundingBox())!.width * 0.8).toBeCloseTo(0, 0);
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
    await expect(point.locator('input[type=number]').nth(0)).toHaveValue('-63.57');
    await expect(point.locator('input[type=number]').nth(1)).toHaveValue('44.65');
  });

  test('map click submits a ref at the reverse geocoded address', async ({ page }) => {
    await page.route('https://nominatim.openstreetmap.org/reverse**', route => route.fulfill({
      headers: CORS,
      json: { display_name: 'Dartmouth, Nova Scotia, Canada', lat: '44.67', lon: '-63.57' },
    }));
    await page.goto('/ref/e/' + encodeURIComponent(URL) + '?debug=ADMIN', { waitUntil: 'networkidle' });
    const embed = page.locator('.full-page.ref .map-embed');
    const canvas = embed.locator('.maplibregl-canvas');
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    const box = (await canvas.boundingBox())!;
    await canvas.click({ position: { x: box.width * 0.75, y: box.height / 2 } });
    const found = embed.locator('.geocode-marker');
    await expect(found).toHaveAttribute('title', 'Dartmouth, Nova Scotia, Canada');
    await found.click();
    await expect(page).toHaveURL(/\/submit\/text\?/);
    // Adds the same tags as the Submit button
    await expect(page).toHaveURL(/[?&]tag=public(&|$)/);
    await expect(page.locator('[name=title]')).toHaveValue('Dartmouth, Nova Scotia, Canada');
    // Page is interactive after navigating from the map
    await page.locator('.child-plugin-select').selectOption('plugin/geo/polygon');
    await expect(page.locator('button', { hasText: '+ Add Ring' })).toBeVisible();
    await page.getByText('show advanced').click();
    await expect(page.locator('app-ref-form')).toBeVisible();
    const point = page.locator('.location-field').first();
    await expect(point.locator('input[type=number]').nth(0)).not.toHaveValue('');
    await expect(point.locator('input[type=number]').nth(1)).not.toHaveValue('');
  });

  test('cleanup', async ({ page }) => {
    await deleteRef(page, URL);
    await deleteRef(page, POLYGON_URL);
  });
});
