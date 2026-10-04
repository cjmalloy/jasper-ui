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
    await expect(style.locator('.geo-style-stroke-width-label')).toHaveText('Medium');
    await expect(style.locator('.geo-style-stroke-width-input .range-tick')).toHaveCount(0);
    const slider = (await style.locator('.geo-style-stroke-width').boundingBox())!;
    await style.locator('.geo-style-stroke-width').fill('2');
    await expect(style.locator('.geo-style-stroke-width-label')).toHaveText('Large');
    // The width label sits above the slider, so the slider does not resize as the label changes
    expect((await style.locator('.geo-style-stroke-width').boundingBox())!.width).toBe(slider.width);
    const widthLabel = (await style.locator('.geo-style-stroke-width-label').boundingBox())!;
    expect(widthLabel.y + widthLabel.height).toBeLessThanOrEqual(slider.y);
    const rowTop = (await style.locator('.geo-style-stroke').boundingBox())!.y;
    expect(widthLabel.y).toBeGreaterThanOrEqual(rowTop - 4 - widthLabel.height);
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
    // Each row has its own label in the form grid
    const strokeLabel = (await style.locator('.geo-style-stroke-label').boundingBox())!;
    const fillLabel = (await style.locator('.geo-style-fill-label').boundingBox())!;
    const strokeRow = (await style.locator('.geo-style-stroke').boundingBox())!;
    const fillRow = (await style.locator('.geo-style-fill').boundingBox())!;
    expect(strokeLabel.x + strokeLabel.width).toBeLessThanOrEqual(strokeRow.x + 1);
    expect(fillLabel.x).toBeCloseTo(strokeLabel.x, 0);
    expect(fillRow.x).toBeCloseTo(strokeRow.x, 0);
    expect(Math.abs(fillLabel.y - fillRow.y)).toBeLessThan(fillRow.height);
    // Row items expand to fill the row
    for (const row of ['.geo-style-stroke', '.geo-style-fill']) {
      const box = (await style.locator(row).boundingBox())!;
      const right = Math.max(...await style.locator(row + ' > *').evaluateAll(els => els.map(e => e.getBoundingClientRect().right)));
      expect(box.x + box.width - right).toBeLessThan(8);
    }

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
    await style.locator('.geo-style-stroke-width').fill('2');
    await style.locator('.geo-style-stroke-style').selectOption('dotted');
    await style.locator('.geo-style-fill-color').fill('#00ff00');
    await style.locator('.geo-style-fill-style').selectOption('nw');
    await style.locator('.geo-style-stroke-clear').click();
    await expect(style.locator('.geo-style-stroke-width')).toHaveValue('1');
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
    await expect(style.locator('.geo-style-fill-label')).toHaveCount(0);
    await expect(style.locator('.geo-style-stroke-label')).toHaveText('Stroke:');
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
    // Multi geometries are hidden from the dropdown
    await expect(geometry.locator('option[value="plugin/geo/polygon"]')).toHaveCount(1);
    await expect(geometry.locator('option[value="plugin/geo/multipolygon"]')).toHaveCount(0);
    await expect(geometry.locator('option[value="plugin/geo/multilinestring"]')).toHaveCount(0);
    await expect(geometry.locator('option[value="plugin/geo/multipoint"]')).toHaveCount(0);
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

  test('a hidden geometry is shown in the dropdown when selected', async ({ page }) => {
    await page.goto('/submit/web?debug=ADMIN&url=' + encodeURIComponent(URL)
      + '&tag=plugin/geo&tag=plugin/geo/multipolygon', { waitUntil: 'networkidle' });
    const geometry = page.locator('.child-plugin-select');
    await expect(geometry).toHaveValue('plugin/geo/multipolygon');
    await expect(geometry.locator('option[value="plugin/geo/multilinestring"]')).toHaveCount(0);
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

  test('web link submit uses the location', async ({ page }) => {
    await page.goto('/submit/web?debug=ADMIN&url=' + encodeURIComponent(URL)
      + '&tag=public&location=-63.5,44.6', { waitUntil: 'networkidle' });
    const point = page.locator('.location-field').first();
    await expect(point.locator('input[type=number]').nth(0)).toHaveValue('-63.5');
    await expect(point.locator('input[type=number]').nth(1)).toHaveValue('44.6');
  });

  test('submit page forwards the location to a web link', async ({ page }) => {
    await page.goto('/submit?debug=ADMIN&tag=public&location=-63.5,44.6', { waitUntil: 'networkidle' });
    await page.locator('input#url').fill(URL);
    await page.locator('button[type=submit]', { hasText: 'Next' }).click();
    await expect(page).toHaveURL(/\/submit\/web\?/);
    const point = page.locator('.location-field').first();
    await expect(point.locator('input[type=number]').nth(0)).toHaveValue('-63.5');
    await expect(point.locator('input[type=number]').nth(1)).toHaveValue('44.6');
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
    // Hidden geometries can still be added as features
    await expect(page.locator('.geometries-field .geometry-add option[value="plugin/geo/multipolygon"]')).toHaveCount(1);
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
    // Each feature is laid out as a form grid below its name and remove button
    const name = (await items.nth(1).locator('.geometry-name').boundingBox())!;
    const remove = (await items.nth(1).locator('.geometry-remove').boundingBox())!;
    expect(Math.abs(remove.y + remove.height / 2 - (name.y + name.height / 2))).toBeLessThan(4);
    const strokeLabel = (await items.nth(1).locator('.geo-style-stroke-label').boundingBox())!;
    const stroke = (await items.nth(1).locator('.geo-style-stroke').boundingBox())!;
    const pointsLabel = (await items.nth(1).locator('label', { hasText: 'Points' }).boundingBox())!;
    const addPoint = (await items.nth(1).locator('button', { hasText: '+ Add Point' }).boundingBox())!;
    expect(strokeLabel.y).toBeGreaterThanOrEqual(name.y + name.height);
    expect(strokeLabel.x + strokeLabel.width).toBeLessThanOrEqual(stroke.x + 1);
    expect(pointsLabel.y).toBeGreaterThanOrEqual(stroke.y + stroke.height);
    expect(pointsLabel.x + pointsLabel.width).toBeLessThanOrEqual(addPoint.x + 1);
    expect(addPoint.x).toBeCloseTo(stroke.x, 0);
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
    // The result name and address are spaced apart
    const title = (await result.locator('.maplibregl-ctrl-geocoder--result-title').boundingBox())!;
    const address = (await result.locator('.maplibregl-ctrl-geocoder--result-address').boundingBox())!;
    expect(address.x - (title.x + title.width)).toBeGreaterThan(2);
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

  test('double clicking the map zooms in', async ({ page }) => {
    await page.goto('/ref/e/' + encodeURIComponent(URL) + '?debug=ADMIN', { waitUntil: 'networkidle' });
    const embed = page.locator('.full-page.ref .map-embed');
    const canvas = embed.locator('.maplibregl-canvas');
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    const scale = embed.locator('.maplibregl-ctrl-scale');
    const before = await scale.textContent();
    const box = (await canvas.boundingBox())!;
    await canvas.dblclick({ position: { x: box.width * 0.75, y: box.height / 2 } });
    await expect(scale).not.toHaveText(before!);
    // No marker is dropped and clicked
    await page.waitForTimeout(1000);
    await expect(embed.locator('.geocode-marker')).toHaveCount(0);
    await expect(page).toHaveURL(/\/ref\//);

    // The location picker zooms in without moving the location
    await page.goto('/submit/web?debug=ADMIN&url=' + encodeURIComponent(POLYGON_URL)
      + '&tag=plugin/geo/point', { waitUntil: 'networkidle' });
    const point = page.locator('.location-field').first();
    await point.locator('input[type=number]').nth(0).fill('-63.5');
    await point.locator('input[type=number]').nth(1).fill('44.6');
    await point.locator('.location-map-toggle').click();
    const map = point.locator('.location-map .maplibregl-canvas');
    await expect(map).toBeVisible({ timeout: 15_000 });
    await expect(point.locator('.location-marker')).toBeVisible({ timeout: 15_000 });
    const mapBox = (await map.boundingBox())!;
    const markerBefore = (await point.locator('.location-marker').boundingBox())!;
    await page.mouse.dblclick(mapBox.x + mapBox.width * 0.25, mapBox.y + mapBox.height * 0.25);
    await page.waitForTimeout(1000);
    await expect(point.locator('input[type=number]').nth(0)).toHaveValue('-63.5');
    await expect(point.locator('input[type=number]').nth(1)).toHaveValue('44.6');
    // Zooming in around the click moves the marker away from it
    const markerAfter = (await point.locator('.location-marker').boundingBox())!;
    expect(Math.hypot(markerAfter.x - markerBefore.x, markerAfter.y - markerBefore.y)).toBeGreaterThan(20);
  });

  test('right click adds points to a newly added ring', async ({ page }) => {
    await page.goto('/submit/web?debug=ADMIN&url=' + encodeURIComponent(POLYGON_URL)
      + '&tag=plugin/geo/polygon', { waitUntil: 'networkidle' });
    await page.locator('button', { hasText: '+ Add Ring' }).click();
    const rings = page.locator('.plugin-content formly-list-section formly-list-section');
    const first = rings.nth(0).locator('.location-field');
    const coords = [[-63.5, 44.6], [-63.49, 44.6], [-63.49, 44.61]];
    for (let i = 0; i < coords.length; i++) {
      await rings.nth(0).locator('button', { hasText: '+ Add Point' }).click();
      await first.nth(i).locator('input[type=number]').nth(0).fill('' + coords[i][0]);
      await first.nth(i).locator('input[type=number]').nth(1).fill('' + coords[i][1]);
    }
    await first.nth(0).locator('.location-map-toggle').click();
    const canvas = page.locator('.location-map .maplibregl-canvas');
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    const markers = page.locator('.location-map .location-marker');
    await expect(markers).toHaveCount(3);
    // The map is fitted to the ring instead of zoomed out around one point
    const a = (await markers.nth(0).boundingBox())!;
    const b = (await markers.nth(1).boundingBox())!;
    expect(Math.abs(b.x - a.x)).toBeGreaterThan(100);

    await page.locator('button', { hasText: '+ Add Ring' }).click();
    await expect(rings).toHaveCount(2);
    const box = (await canvas.boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.15, box.y + box.height * 0.5, { button: 'right' });
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5, { button: 'right' });
    await expect(rings.nth(1).locator('.location-field')).toHaveCount(2);
    await expect(first).toHaveCount(3);
    await expect(markers).toHaveCount(5);
  });

  test('map view is saved in the url and restored on back', async ({ page }) => {
    await page.goto('/tag/@*?debug=ADMIN&view=map&map=-63.5,44.6,9', { waitUntil: 'networkidle' });
    await closeSidebar(page);
    const canvas = page.locator('.map.ext .maplibregl-canvas');
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/[?&]map=-63\.5,44\.6,9(&|$)/);
    const history = await page.evaluate(() => history.length);

    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 200, box.y + box.height / 2, { steps: 10 });
    await page.mouse.up();
    await expect(page).not.toHaveURL(/[?&]map=-63\.5,44\.6,9(&|$)/);
    await expect(page).toHaveURL(/[?&]map=-63\.\d+,44\.6,9(&|$)/);
    const moved = page.url();
    // Overwrites the history entry instead of adding one
    expect(await page.evaluate(() => history.length)).toBe(history);
    // The ref list is not fetched again
    let fetched = false;
    page.on('request', req => { if (req.url().includes('/api/v1/ref/page')) fetched = true; });
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 100, { steps: 10 });
    await page.mouse.up();
    await expect(page).not.toHaveURL(moved);
    await page.waitForTimeout(500);
    expect(fetched).toBe(false);
    const saved = page.url();

    await page.goto('/?debug=ADMIN', { waitUntil: 'networkidle' });
    await page.goBack({ waitUntil: 'networkidle' });
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1000);
    expect(page.url()).toBe(saved);
  });

  for (const map of ['&map=-63.5,44.6,9', '']) {
    test(`sidebar submit uses the map center after panning${map ? '' : ' without a saved view'}`, async ({ page }) => {
      await page.goto('/tag/public:plugin/geo/point?debug=ADMIN&view=map' + map, { waitUntil: 'networkidle' });
      await closeSidebar(page);
      const canvas = page.locator('.map.ext .maplibregl-canvas');
      await expect(canvas).toBeVisible({ timeout: 15_000 });
      await expect(page).toHaveURL(/[?&]map=/);
      await page.waitForTimeout(1000);
      const initial = page.url();

      const box = (await canvas.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 - 200, box.y + box.height / 2 - 100, { steps: 10 });
      await page.mouse.up();
      await expect(page).not.toHaveURL(initial);
      await openSidebar(page);
      const center = new globalThis.URL(page.url()).searchParams.get('map')!.split(',').slice(0, 2).join(',');

      await page.locator('.sidebar .submit-button', { hasText: 'Submit' }).first().click();
      await expect(page).toHaveURL(/\/submit\?/);
      expect(new globalThis.URL(page.url()).searchParams.get('location')).toBe(center);
    });
  }

  test('map pans while text on the page is selected', async ({ page }) => {
    await page.goto('/tag/public:plugin/geo/point?debug=ADMIN&view=map&map=-63.5,44.6,9', { waitUntil: 'networkidle' });
    const canvas = page.locator('.map.ext .maplibregl-canvas');
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1000);
    const initial = page.url();
    await page.evaluate(() => getSelection()!.selectAllChildren(document.body));

    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 200, box.y + box.height / 2 - 100, { steps: 10 });
    await page.mouse.up();
    await expect(page).not.toHaveURL(initial);
    const [lng, lat] = new globalThis.URL(page.url()).searchParams.get('map')!.split(',').map(Number);
    expect(lng).toBeGreaterThan(-63.4);
    expect(lat).toBeLessThan(44.55);
  });

  test('location input map picker pans while text on the page is selected', async ({ page }) => {
    await page.goto('/submit/web?debug=ADMIN&url=' + encodeURIComponent(URL)
      + '&tag=plugin/geo/point', { waitUntil: 'networkidle' });
    const point = page.locator('.location-field').first();
    await point.locator('input[type=number]').nth(0).fill('-63.5');
    await point.locator('input[type=number]').nth(1).fill('44.6');
    await point.locator('.location-map-toggle').click();
    const canvas = point.locator('.location-map .maplibregl-canvas');
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    const marker = point.locator('.location-marker');
    await expect(marker).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1000);
    const before = (await marker.boundingBox())!;
    await page.evaluate(() => getSelection()!.selectAllChildren(document.body));

    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.8);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.6, { steps: 10 });
    await page.mouse.up();
    await expect.poll(async () => (await marker.boundingBox())!.x - before.x).toBeGreaterThan(50);
    await expect(point.locator('input[type=number]').nth(0)).toHaveValue('-63.5');
    await expect(point.locator('input[type=number]').nth(1)).toHaveValue('44.6');
  });

  test('dragging a marker out of the map ends the drag on release', async ({ page }) => {
    await page.goto('/submit/web?debug=ADMIN&url=' + encodeURIComponent(URL)
      + '&tag=plugin/geo/point', { waitUntil: 'networkidle' });
    const point = page.locator('.location-field').first();
    await point.locator('input[type=number]').nth(0).fill('-63.5');
    await point.locator('input[type=number]').nth(1).fill('44.6');
    await point.locator('.location-map-toggle').click();
    const canvas = point.locator('.location-map .maplibregl-canvas');
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    const marker = point.locator('.location-marker');
    await expect(marker).toBeVisible({ timeout: 15_000 });

    const box = (await canvas.boundingBox())!;
    const m = (await marker.boundingBox())!;
    await page.mouse.move(m.x + m.width / 2, m.y + m.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.5, { steps: 10 });
    // Release outside the map
    await page.mouse.move(box.x + box.width * 0.8, box.y - 40, { steps: 10 });
    await page.mouse.up();
    await expect(point.locator('input[type=number]').nth(0)).not.toHaveValue('-63.5');
    const lng = await point.locator('input[type=number]').nth(0).inputValue();
    const dropped = (await marker.boundingBox())!;

    // The marker no longer follows the mouse
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5, { steps: 10 });
    await page.waitForTimeout(500);
    const after = (await marker.boundingBox())!;
    expect(Math.abs(after.x - dropped.x)).toBeLessThan(2);
    await expect(point.locator('input[type=number]').nth(0)).toHaveValue(lng);
  });

  test('location input map picker starts with a collapsed attribution', async ({ page }) => {
    await page.goto('/submit/web?debug=ADMIN&url=' + encodeURIComponent(URL)
      + '&tag=plugin/geo/point', { waitUntil: 'networkidle' });
    const point = page.locator('.location-field').first();
    await point.locator('input[type=number]').nth(0).fill('-63.5');
    await point.locator('input[type=number]').nth(1).fill('44.6');
    await point.locator('.location-map-toggle').click();
    await expect(point.locator('.location-map .maplibregl-canvas')).toBeVisible({ timeout: 15_000 });
    await expect(point.locator('.location-marker')).toBeVisible({ timeout: 15_000 });

    const attrib = point.locator('.location-map .maplibregl-ctrl-attrib');
    await expect(attrib).toHaveClass(/maplibregl-compact/);
    await expect(attrib).not.toHaveClass(/maplibregl-compact-show/);
    await expect(attrib.locator('.maplibregl-ctrl-attrib-inner')).toBeHidden();

    await attrib.locator('.maplibregl-ctrl-attrib-button').click();
    await expect(attrib).toHaveClass(/maplibregl-compact-show/);
    await expect(attrib.locator('.maplibregl-ctrl-attrib-inner')).toBeVisible();
    await expect(attrib.locator('.maplibregl-ctrl-attrib-inner')).toContainText('MapLibre');
    // Opening the attribution does not move the location
    await expect(point.locator('input[type=number]').nth(0)).toHaveValue('-63.5');
    await expect(point.locator('input[type=number]').nth(1)).toHaveValue('44.6');
  });

  test('location input map picker collapses the attribution of a MapTiler basemap', async ({ page }) => {
    // Use a MapTiler satellite hybrid basemap in the map template
    const attribution = '<a href="https://www.maptiler.com/copyright/" target="_blank">&copy; MapTiler</a> '
      + '<a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>';
    const mapStyle = {
      version: 8,
      name: 'Satellite Hybrid',
      sources: {
        maptiler_planet: {
          type: 'vector',
          tiles: ['https://api.maptiler.com/tiles/v4/{z}/{x}/{y}.pbf?key=api-key'],
          maxzoom: 14,
          attribution,
        },
        satellite: {
          type: 'raster',
          tiles: ['https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=api-key'],
          tileSize: 512,
          maxzoom: 20,
          attribution,
        },
      },
      layers: [
        { id: 'Satellite', type: 'raster', source: 'satellite' },
        { id: 'Path', type: 'line', source: 'maptiler_planet', 'source-layer': 'pathway', paint: { 'line-color': '#fff' } },
      ],
    };
    const useStyle = (value: any): void => {
      if (Array.isArray(value)) return value.forEach(useStyle);
      if (!value || typeof value !== 'object') return;
      if (value.tag === 'map' && value.config) value.config.mapStyle = mapStyle;
      Object.values(value).forEach(useStyle);
    };
    await page.route(/\/api\/v1\/template/, async route => {
      const response = await route.fetch();
      const json = await response.json();
      useStyle(json);
      await route.fulfill({ response, json });
    });
    // MapTiler is not reachable, so its tiles never load
    await page.route(/api\.maptiler\.com/, route => route.abort());
    await page.goto('/submit/web?debug=ADMIN&url=' + encodeURIComponent(URL)
      + '&tag=plugin/geo/point', { waitUntil: 'domcontentloaded' });
    const point = page.locator('.location-field').first();
    await point.locator('input[type=number]').nth(0).fill('-63.5');
    await point.locator('input[type=number]').nth(1).fill('44.6');
    await point.locator('.location-map-toggle').click();
    await expect(point.locator('.location-map .maplibregl-canvas')).toBeVisible({ timeout: 15_000 });

    const attrib = point.locator('.location-map .maplibregl-ctrl-attrib');
    await expect(attrib).toHaveClass(/maplibregl-compact/);
    await expect(attrib).not.toHaveClass(/maplibregl-compact-show/);
    await expect(attrib.locator('.maplibregl-ctrl-attrib-inner')).toBeHidden();
    // Stays collapsed after the source attribution loads
    await expect(attrib.locator('.maplibregl-ctrl-attrib-inner')).toContainText('MapTiler', { timeout: 15_000 });
    await page.waitForTimeout(500);
    await expect(attrib).not.toHaveClass(/maplibregl-compact-show/);
    await expect(attrib.locator('.maplibregl-ctrl-attrib-inner')).toBeHidden();
    // Shows the default and style source attribution
    await attrib.locator('.maplibregl-ctrl-attrib-button').click();
    await expect(attrib.locator('.maplibregl-ctrl-attrib-inner')).toBeVisible();
    await expect(attrib.locator('.maplibregl-ctrl-attrib-inner')).toContainText('MapLibre');
    await expect(attrib.locator('.maplibregl-ctrl-attrib-inner')).toContainText('© MapTiler');
    await expect(attrib.locator('.maplibregl-ctrl-attrib-inner')).toContainText('OpenStreetMap contributors');
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  });

  test('location input map picker can be resized', async ({ page }) => {
    await page.goto('/submit/web?debug=ADMIN&url=' + encodeURIComponent(URL)
      + '&tag=plugin/geo/multipoint', { waitUntil: 'networkidle' });
    const list = page.locator('.plugin-content formly-list-section').first();
    await list.locator('button', { hasText: '+ Add Point' }).click();
    await list.locator('button', { hasText: '+ Add Point' }).click();
    const points = list.locator('.location-field');
    await expect(points).toHaveCount(2);
    await points.nth(0).locator('input[type=number]').nth(0).fill('-63.5');
    await points.nth(0).locator('input[type=number]').nth(1).fill('44.6');
    await points.nth(1).locator('input[type=number]').nth(0).fill('-63.4');
    await points.nth(1).locator('input[type=number]').nth(1).fill('44.7');
    await points.nth(0).locator('.location-map-toggle').click();
    const canvas = list.locator('.location-map .maplibregl-canvas');
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    await expect(list.locator('.location-marker')).toHaveCount(2, { timeout: 15_000 });

    const handle = list.locator('.location-map .resize-handle');
    const box = (await handle.boundingBox())!;
    expect(Math.round(box.height)).toBe(300);
    const before = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width - 3, box.y + box.height - 3);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 53, box.y + box.height + 97, { steps: 10 });
    // Resizing does not start a list drag and drop
    await expect(page.locator('.cdk-drag-preview')).toHaveCount(0);
    await page.mouse.up();

    const resized = (await handle.boundingBox())!;
    expect(resized.height).toBeGreaterThan(380);
    expect(resized.width).toBeLessThan(box.width - 40);
    // MapLibre redraws to fill the new size
    await expect.poll(async () => (await canvas.boundingBox())!.height).toBeGreaterThan(before.height + 80);
    await page.waitForTimeout(500);
    // Resizing does not move the active location or reorder the list
    await expect(points.nth(0).locator('input[type=number]').nth(0)).toHaveValue('-63.5');
    await expect(points.nth(0).locator('input[type=number]').nth(1)).toHaveValue('44.6');
    await expect(points.nth(1).locator('input[type=number]').nth(0)).toHaveValue('-63.4');
    await expect(points.nth(1).locator('input[type=number]').nth(1)).toHaveValue('44.7');
  });

  test('location input map picker can be resized from the mobile handle', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/submit/web?debug=ADMIN&url=' + encodeURIComponent(URL)
      + '&tag=plugin/geo/point', { waitUntil: 'networkidle' });
    const point = page.locator('.location-field').first();
    await point.locator('input[type=number]').nth(0).fill('-63.5');
    await point.locator('input[type=number]').nth(1).fill('44.6');
    await point.locator('.location-map-toggle').click();
    const map = point.locator('.location-map .resize-handle');
    await expect(point.locator('.location-map .maplibregl-canvas')).toBeVisible({ timeout: 15_000 });
    // Scroll the inputs below the map into view, so the whole ⬍ handle is visible
    await point.locator('input[type=number]').nth(0).scrollIntoViewIfNeeded();
    const box = (await map.boundingBox())!;

    // The ⬍ handle hangs below the map without covering the inputs
    const input = (await point.locator('input[type=number]').nth(0).boundingBox())!;
    expect(input.y).toBeGreaterThanOrEqual(box.y + box.height + 24);

    // Drag the middle of the ⬍ handle
    const x = box.x + box.width - 34;
    const y = box.y + box.height;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 100, { steps: 10 });
    await page.mouse.up();
    await expect.poll(async () => (await map.boundingBox())!.height).toBeGreaterThan(box.height + 80);
    await expect(point.locator('input[type=number]').nth(0)).toHaveValue('-63.5');
    await expect(point.locator('input[type=number]').nth(1)).toHaveValue('44.6');
  });

  test('location labels do not jump on hover on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/submit/web?debug=ADMIN&url=' + encodeURIComponent(URL)
      + '&tag=plugin/geo/multipoint', { waitUntil: 'networkidle' });
    const list = page.locator('.plugin-content formly-list-section').first();
    await list.locator('button', { hasText: '+ Add Point' }).click();
    const label = list.locator('.list-drag .form-label').first();
    await expect(label).toBeVisible();
    const textX = () => label.evaluate(el => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return range.getBoundingClientRect().x;
    });
    const before = await textX();
    await label.hover();
    await page.waitForTimeout(300);
    expect(Math.abs(await textX() - before)).toBeLessThan(2);
  });

  test('location input map picker pans with text selected', async ({ page }) => {
    await page.goto('/submit/web?debug=ADMIN&url=' + encodeURIComponent(URL)
      + '&tag=plugin/geo/point', { waitUntil: 'networkidle' });
    const point = page.locator('.location-field').first();
    await point.locator('input[type=number]').nth(0).fill('-63.5');
    await point.locator('input[type=number]').nth(1).fill('44.6');
    await point.locator('.location-map-toggle').click();
    const canvas = point.locator('.location-map .maplibregl-canvas');
    await expect(canvas).toBeVisible({ timeout: 15_000 });
    const marker = point.locator('.location-marker');
    await expect(marker).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(500);

    await page.evaluate(() => document.getSelection()!.selectAllChildren(document.body));
    const before = (await marker.boundingBox())!;
    const box = (await canvas.boundingBox())!;
    const x = box.x + box.width / 3;
    const y = box.y + box.height / 3;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 100, y + 50, { steps: 10 });
    await page.mouse.up();
    // Selected text is not dragged instead of panning the map
    await expect.poll(async () => (await marker.boundingBox())!.x - before.x).toBeGreaterThan(80);
    await expect(point.locator('input[type=number]').nth(0)).toHaveValue('-63.5');
    await expect(point.locator('input[type=number]').nth(1)).toHaveValue('44.6');
  });

  test('location input pastes lng, lat into both inputs', async ({ page }) => {
    await page.goto('/submit/web?debug=ADMIN&url=' + encodeURIComponent(URL)
      + '&tag=plugin/geo/point', { waitUntil: 'networkidle' });
    const point = page.locator('.location-field').first();
    const lng = point.locator('input[type=number]').nth(0);
    const lat = point.locator('input[type=number]').nth(1);
    const paste = (input: typeof lng, text: string) => input.evaluate((el, text) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', text);
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }));
    }, text);

    await paste(lng, '-63.5, 44.6');
    await expect(lng).toHaveValue('-63.5');
    await expect(lat).toHaveValue('44.6');
    await paste(lat, '[-63.4,44.7]');
    await expect(lng).toHaveValue('-63.4');
    await expect(lat).toHaveValue('44.7');
  });

  test('address search results space the name from the address', async ({ page }) => {
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
    await expect(point.locator('.location-map .maplibregl-canvas')).toBeVisible({ timeout: 15_000 });

    const search = point.locator('.location-map .maplibregl-ctrl-geocoder--input');
    await search.fill('Halifax');
    await search.press('Enter');
    const result = point.locator('.maplibregl-ctrl-geocoder .suggestions li', { hasText: 'Nova Scotia' });
    const title = result.locator('.maplibregl-ctrl-geocoder--result-title');
    const address = result.locator('.maplibregl-ctrl-geocoder--result-address');
    await expect(title).toHaveText('Halifax');
    await expect(address).toHaveText('Nova Scotia, Canada');
    const titleBox = (await title.boundingBox())!;
    const addressBox = (await address.boundingBox())!;
    expect(addressBox.x - (titleBox.x + titleBox.width)).toBeGreaterThan(3);
  });

  test('map template zoom slider has labels', async ({ page }) => {
    await page.goto('/ext/map?debug=ADMIN', { waitUntil: 'networkidle' });
    await page.locator('button', { hasText: 'Extend' }).click();
    const zoom = page.locator('.range-input').first();
    const slider = zoom.locator('input[type=range]');
    // One tick per zoom level, numbered every other level
    await expect(zoom.locator('.range-tick')).toHaveCount(23);
    await expect(zoom.locator('.range-number')).toHaveText(['0', '2', '4', '6', '8', '10', '12', '14', '16', '18', '20', '22']);
    await slider.fill('12');
    await expect(zoom.locator('.range-value')).toHaveText('City');
    await expect(zoom.locator('.range-number.active')).toHaveText('12');
    await slider.fill('13');
    await expect(zoom.locator('.range-value')).toHaveText('City');
    await expect(zoom.locator('.range-number.active')).toHaveCount(0);
    // Clicking the slider above a tick snaps to that tick's value
    const box = (await slider.boundingBox())!;
    for (const value of [0, 5, 12, 22]) {
      const tick = (await zoom.locator('.range-tick').nth(value).boundingBox())!;
      await page.mouse.click(tick.x + tick.width / 2, box.y + box.height / 2);
      await expect(slider).toHaveValue('' + value);
    }
  });

  test('main map keeps the default attribution', async ({ page }) => {
    await page.goto('/tag/@*?debug=ADMIN&view=map&map=-63.5,44.6,9', { waitUntil: 'networkidle' });
    const attrib = page.locator('.map.ext .maplibregl-ctrl-attrib');
    await expect(attrib).toBeVisible({ timeout: 15_000 });
    // MapLibre shows the attribution until the map is dragged
    await expect(attrib).toHaveClass(/maplibregl-compact-show/);
    await expect(attrib.locator('.maplibregl-ctrl-attrib-inner')).toBeVisible();
  });

  test('cleanup', async ({ page }) => {
    await deleteRef(page, URL);
    await deleteRef(page, POLYGON_URL);
  });
});
