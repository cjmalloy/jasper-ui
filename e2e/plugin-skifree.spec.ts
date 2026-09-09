import { expect, test } from '@playwright/test';
import { mod } from './setup';

test.describe.serial('SkiFree plugin', () => {
  let gameUrl: string;

  test('installs with the shared score plugin without enabling JezzBall', async ({ page }) => {
    await mod(page, '#mod-experiments', '#mod-skifree');
    await expect(page.locator('#mod-score')).toBeChecked();
    await expect(page.locator('#mod-jezzball')).not.toBeChecked();
  });

  test('creates a game, uses keyboard controls, and persists the shared score', async ({ page }) => {
    await page.goto('/submit/text?tag=plugin/skifree&tag=public&debug=ADMIN', { waitUntil: 'networkidle' });
    await page.locator('[name=title]').fill('SkiFree E2E');
    const created = page.waitForResponse(response => response.url().includes('/api/v1/ref') &&
      response.request().method() === 'POST' && response.ok());
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    const ref = (await created).request().postDataJSON();
    const game = page.locator('.skifree-game');
    await expect(game).toBeVisible();
    const url = new URL(`/ref/e/${encodeURIComponent(ref.url)}`, page.url());
    url.searchParams.set('debug', 'ADMIN');
    gameUrl = url.href;
    await game.locator('.skifree-start').click();
    await game.press('Space');
    await expect(game.locator('.skifree-score')).not.toHaveText('Score: 0');
    await game.press('p');
    await expect(game).toHaveAttribute('data-state', 'paused');
    const distance = await game.getAttribute('data-distance');
    await page.waitForTimeout(300);
    await expect(game).toHaveAttribute('data-distance', distance!);
    await game.press('p');
    await game.press('f');
    await expect(game).toHaveAttribute('data-fast', 'true');
    const saved = page.waitForResponse(response => response.url().includes('/api/v1/ref') &&
      response.request().method() === 'PATCH' && response.ok());
    await game.press('End');
    const response = await saved;
    const patch = response.request().postDataJSON();
    expect(patch.plugins['plugin/score']).toBeGreaterThan(0);
    expect(patch.plugins['plugin/skifree'].final).toBe(true);
    expect(patch.plugins['plugin/skifree']).not.toHaveProperty('score');
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('.skifree-result')).toContainText(`Score: ${patch.plugins['plugin/score']}`);
  });

  test('follows the mouse, stops at its target, and jumps on click without an on-screen controller', async ({ page }) => {
    await page.goto(gameUrl, { waitUntil: 'networkidle' });
    const game = page.locator('.skifree-game');
    await game.locator('.skifree-start').click();
    await expect(game.locator('.skifree-toolbar, .skifree-touch-controls')).toHaveCount(0);
    const canvas = game.locator('.skifree-canvas');
    await canvas.scrollIntoViewIfNeeded();
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * .42);
    await expect.poll(async () => Number(await game.getAttribute('data-distance'))).toBeGreaterThan(10);
    await expect(game.locator('.skifree-speed')).toHaveText('Speed: 0 km/h');
    const stopped = Number(await game.getAttribute('data-distance'));
    expect(stopped).toBeLessThan(40);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * .42);
    await expect(game.locator('.skifree-score')).not.toHaveText('Score: 0');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * .85);
    await expect.poll(async () => Number(await game.getAttribute('data-distance'))).toBeGreaterThan(stopped + 30);
  });

  test('keeps following the touch target after release and stops on arrival', async ({ browser }) => {
    const context = await browser.newContext({ hasTouch: true, viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    try {
      await page.goto(gameUrl, { waitUntil: 'networkidle' });
      const game = page.locator('.skifree-game');
      await game.locator('.skifree-start').tap();
      const canvas = game.locator('.skifree-canvas');
      await canvas.scrollIntoViewIfNeeded();
      const box = (await canvas.boundingBox())!;
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height * .42);
      await expect(game.locator('.skifree-score')).not.toHaveText('Score: 0');
      await expect.poll(async () => Number(await game.getAttribute('data-distance'))).toBeGreaterThan(10);
      await expect(game.locator('.skifree-speed')).toHaveText('Speed: 0 km/h');
      const stopped = Number(await game.getAttribute('data-distance'));
      expect(stopped).toBeLessThan(40);
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height * .85);
      await expect.poll(async () => Number(await game.getAttribute('data-distance'))).toBeGreaterThan(stopped + 30);
    } finally {
      await context.close();
    }
  });

  for (const theme of ['light', 'dark']) {
    test(`renders the classic snowfield in ${theme} mode`, async ({ page }, testInfo) => {
      await page.goto(gameUrl, { waitUntil: 'networkidle' });
      await page.evaluate(theme => {
        document.body.classList.remove('light-theme', 'dark-theme');
        document.body.classList.add(`${theme}-theme`);
      }, theme);
      const game = page.locator('.skifree-game');
      await game.locator('.skifree-course').selectOption('slalom');
      await game.locator('.skifree-start').click();
      await expect.poll(async () => Number(await game.getAttribute('data-distance'))).toBeGreaterThan(40);
      await game.press('ArrowUp');
      await expect(game.locator('.skifree-stage')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
      await expect(game.locator('.skifree-stage')).toHaveCSS('color', 'rgb(17, 17, 17)');
      await testInfo.attach(`skifree-${theme}`, {
        body: await game.screenshot({ path: testInfo.outputPath(`skifree-${theme}.png`) }),
        contentType: 'image/png',
      });
    });
  }

  test('plays read-only examples without patching the Ref', async ({ page }) => {
    const patches: string[] = [];
    page.on('request', request => {
      if (request.url().includes('/api/v1/ref') && request.method() === 'PATCH') patches.push(request.url());
    });
    const url = new URL(gameUrl);
    url.searchParams.set('debug', 'VIEWER');
    await page.goto(url.href, { waitUntil: 'networkidle' });
    const game = page.locator('.skifree-game');
    await expect(game.locator('.skifree-example')).toBeVisible();
    await game.locator('.skifree-start').click();
    await game.press('Space');
    await expect(game.locator('.skifree-score')).not.toHaveText('Score: 0');
    await game.press('End');
    await expect(game).toHaveAttribute('data-state', 'over');
    expect(patches).toEqual([]);
  });

  test('removes a legacy Score installation without uninstalling either game', async ({ page }) => {
    await mod(page, '#mod-experiments', '#mod-jezzball', '#mod-skifree');
    await page.route('**/api/v1/plugin/page**', async route => {
      const response = await route.fetch();
      const body = await response.json();
      const score = body.content.find((plugin: { tag: string }) => plugin.tag === 'plugin/score');
      const jezzball = body.content.find((plugin: { tag: string }) => plugin.tag === 'plugin/jezzball');
      if (score && jezzball) {
        score.config.mod = jezzball.config.mod;
        score.config.version = 1;
      }
      await route.fulfill({ response, json: body });
    });
    await page.goto('/settings/setup?debug=ADMIN', { waitUntil: 'networkidle' });
    await page.locator('#mod-score').uncheck();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.locator('.log div', { hasText: 'Success.' }).first()).toBeAttached();
    await expect(page.locator('#mod-score')).not.toBeChecked();
    await expect(page.locator('#mod-jezzball')).toBeChecked();
    await expect(page.locator('#mod-skifree')).toBeChecked();
  });
});
