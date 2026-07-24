import { expect, type Page, test } from '@playwright/test';
import { mod, openSidebar } from './setup';

async function installDeterministicGameClock(page: Page) {
  await page.evaluate(() => {
    Math.random = () => 0.5;
    let now = performance.now();
    let nextId = 1;
    const callbacks = new Map<number, FrameRequestCallback>();
    const testWindow = window as Window & {
      __advanceJezzBall: (frames: number, milliseconds?: number) => void;
    };
    testWindow.requestAnimationFrame = callback => {
      const id = nextId++;
      callbacks.set(id, callback);
      return id;
    };
    testWindow.cancelAnimationFrame = id => callbacks.delete(id);
    testWindow.__advanceJezzBall = (frames, milliseconds = 35) => {
      for (let i = 0; i < frames; i++) {
        const pending = [...callbacks.values()];
        callbacks.clear();
        now += milliseconds;
        for (const callback of pending) callback(now);
      }
    };
  });
  await page.waitForTimeout(100);
}

async function advanceGame(page: Page, frames: number, milliseconds = 35) {
  await page.evaluate(({ frames, milliseconds }) => {
    (window as Window & {
      __advanceJezzBall: (frames: number, milliseconds?: number) => void;
    }).__advanceJezzBall(frames, milliseconds);
  }, { frames, milliseconds });
}

async function moveCursor(game: ReturnType<Page['locator']>, key: string, count: number) {
  await game.focus();
  for (let i = 0; i < count; i++) await game.press(key);
}

async function placeTestBalls(page: Page, positions: Array<{ x: number; y: number; left?: boolean; up?: boolean }>) {
  await page.evaluate(testPositions => {
    const values = testPositions.flatMap(position => [
      position.left ? 0 : 1,
      position.up ? 0 : 1,
      (position.x - 2) / 28,
      (position.y - 2) / 20,
      0.5,
    ]);
    Math.random = () => values.shift() ?? 0.5;
  }, positions);
}

async function trackBallCenters(canvas: ReturnType<Page['locator']>) {
  await canvas.evaluate((element: HTMLCanvasElement) => {
    const context = element.getContext('2d')!;
    const arc = context.arc.bind(context);
    const centers: Array<{ x: number; y: number }> = [];
    context.arc = (x, y, radius, startAngle, endAngle, counterclockwise) => {
      if (radius > 8 && radius < 9) centers.push({ x: x / 25, y: y / 25 });
      arc(x, y, radius, startAngle, endAngle, counterclockwise);
    };
    (element as HTMLCanvasElement & { __testBallCenters?: Array<{ x: number; y: number }> })
      .__testBallCenters = centers;
  });
}

test.describe.serial('JezzBall Plugin', () => {
  const title = 'JezzBall E2E Game';
  let page: Page;
  let gamePath: string;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('turns on JezzBall', async () => {
    await mod(page, '#mod-experiments', '#mod-jezzball');
  });

  test('creates a saved game', async () => {
    await mod(page, '#mod-experiments', '#mod-jezzball');
    await page.goto('/tag/@*?search=' + encodeURIComponent(title) + '&debug=ADMIN');
    for (let i = 0; i < 5; i++) {
      const deleteAction = page.locator('.ref-list .ref').filter({ hasText: title })
        .locator('.actions .fake-link', { hasText: 'delete' }).first();
      if (!(await deleteAction.isVisible({ timeout: 2_000 }).catch(() => false))) break;
      await deleteAction.click();
      await page.locator('.ref-list .ref .actions .fake-link', { hasText: 'yes' }).first().click();
      await page.waitForTimeout(500);
      await page.reload();
    }

    await page.goto('/?debug=USER');
    await openSidebar(page);
    await page.locator('.sidebar .submit-button', { hasText: 'Submit' }).first().click();
    await page.locator('.tabs a', { hasText: 'text' }).first().click();
    await page.locator('[name=title]').fill(title);
    await page.locator('.add-plugins-label select').selectOption('plugin/jezzball');
    await page.locator('.editor textarea').fill('A saved JezzBall game.');
    await page.getByText('show advanced').click();
    await page.locator('[name=published]').fill('2026-01-01T00:00');
    await page.locator('[name=published]').blur();
    await page.route('**/api/v1/ref', async route => {
      const request = route.request();
      if (request.method() !== 'POST') {
        await route.continue();
        return;
      }
      const body = request.postDataJSON();
      await route.continue({
        postData: JSON.stringify({
          ...body,
          tags: [...(body.tags || []), 'plugin/score'],
          plugins: {
            ...body.plugins,
            'plugin/jezzball': { level: 101, score: 450, final: true },
            'plugin/score': 450,
          },
        }),
      });
    });
    const submitPromise = page.waitForResponse(resp => (
      resp.url().includes('/api/v1/ref') && resp.request().method() === 'POST' && resp.ok()
    ));
    await page.locator('button', { hasText: 'Submit' }).click({ force: true });
    await submitPromise;
    await page.unroute('**/api/v1/ref');
    await expect(page.locator('.full-page.ref .link a').first()).toHaveText(title);
    await expect(page).toHaveURL(/\/ref\//);
    gamePath = new URL(page.url()).pathname;
  });

  test('restores the final score and starts a new game', async () => {
    const game = page.locator('.full-page.ref .jezzball-game');
    await expect(game.locator('.jezzball-canvas')).toBeVisible();
    await expect(game.locator('.jezzball-overlay')).toContainText('Final score 450');
    await expect(game.locator('.jezzball-level')).toHaveText('Level 101');
    await expect(game.locator('.jezzball-lives')).toHaveText('Lives 50');
    await expect(page.locator('.full-page.ref .jezzball-final-score')).toHaveText('🏆️ 450');
    await expect(game.locator('.jezzball-score')).toHaveCSS('font-variant-numeric', 'tabular-nums');

    const direction = game.locator('.jezzball-direction');
    const canvas = game.locator('.jezzball-canvas');
    await expect(direction).toHaveText('Wall ↕');
    await expect(canvas).toHaveCSS('cursor', 'ns-resize');
    await direction.click();
    await expect(direction).toHaveText('Wall ↔');
    await expect(canvas).toHaveCSS('cursor', 'ew-resize');
    const speed = game.locator('.jezzball-speed');
    await expect(speed).toHaveText('Fast');
    await speed.click();
    await expect(speed).toHaveText('Slow');
    const sound = game.locator('.jezzball-sound');
    await expect(sound).toHaveText('Sound on');
    await sound.click();
    await expect(sound).toHaveText('Sound off');
    await expect(game.locator('.jezzball-filled')).toHaveText('Filled 0%');
    const backgroundPixel = await canvas.evaluate((element: HTMLCanvasElement) => (
      [...element.getContext('2d')!.getImageData(1 * 25 + 5, 1 * 25 + 5, 1, 1).data]
    ));
    expect(backgroundPixel.slice(0, 3)).toEqual([119, 119, 119]);
    const gridPixel = await canvas.evaluate((element: HTMLCanvasElement) => (
      [...element.getContext('2d')!.getImageData(1 * 25 + 12, 1 * 25 + 5, 1, 1).data]
    ));
    expect(gridPixel[0]).toBeGreaterThan(backgroundPixel[0]);
    const hudPositions = await game.evaluate(element => {
      const rect = (selector: string) => element.querySelector(selector)!.getBoundingClientRect();
      const stage = rect('.jezzball-stage');
      const canvas = rect('.jezzball-canvas');
      return {
        center: stage.left + stage.width / 2,
        middle: stage.top + stage.height / 2,
        stage,
        canvas,
        level: rect('.jezzball-level'),
        controls: rect('.jezzball-controls'),
        lives: rect('.jezzball-lives'),
        score: rect('.jezzball-score'),
        time: rect('.jezzball-time'),
        filled: rect('.jezzball-filled'),
      };
    });
    expect(hudPositions.lives.left).toBeLessThan(hudPositions.center);
    expect(hudPositions.score.left).toBeLessThan(hudPositions.center);
    expect(hudPositions.score.right).toBeGreaterThan(hudPositions.center);
    expect(hudPositions.time.left).toBeGreaterThan(hudPositions.center);
    expect(hudPositions.filled.top).toBeGreaterThan(hudPositions.middle);
    expect(hudPositions.canvas.top).toBeGreaterThan(hudPositions.stage.top);
    expect(hudPositions.canvas.left).toBeGreaterThan(hudPositions.stage.left);
    expect(hudPositions.level.right).toBeLessThan(hudPositions.controls.left);

    await page.evaluate(() => {
      document.body.classList.remove('dark-theme');
      document.body.classList.add('light-theme');
    });
    await expect(game).toHaveCSS('color', 'rgb(0, 0, 0)');
  });

  test('fits the whole stage in fullscreen and hides controls', async () => {
    const game = page.locator('.full-page.ref .jezzball-game');
    const container = game.locator('xpath=ancestor::*[contains(@class, "md-container")]');
    await game.evaluate(async element => {
      await element.closest('app-viewer')!.requestFullscreen();
    });
    await expect(container).toHaveCSS('zoom', '0.5');
    await expect(game.locator('.jezzball-toolbar')).toBeVisible();
    await expect(game.locator('.jezzball-controls')).toHaveCSS('display', 'none');
    const stage = await game.locator('.jezzball-stage').boundingBox();
    if (!stage) throw new Error('JezzBall stage has no bounding box');
    expect(stage.x).toBeGreaterThanOrEqual(0);
    expect(stage.y).toBeGreaterThanOrEqual(0);
    expect(stage.x + stage.width).toBeLessThanOrEqual(1280);
    expect(stage.y + stage.height).toBeLessThanOrEqual(720);
    expect(Math.abs(stage.x + stage.width / 2 - 640)).toBeLessThanOrEqual(1);
    await page.evaluate(() => document.exitFullscreen());
  });

  test('plays a read-only Ref as a saved example', async () => {
    await page.goto(gamePath + '?debug=ANON', { waitUntil: 'networkidle' });
    const game = page.locator('.full-page.ref .jezzball-game');
    await expect(game.locator('.jezzball-example')).toHaveText('Saved example');
    await expect(game.locator('.jezzball-overlay')).toContainText('Final score 450');
    await game.locator('.jezzball-new-game').click();
    await expect(game.locator('.jezzball-level')).toHaveText('Level 1');
    await expect(game.locator('.jezzball-canvas')).toBeVisible();
  });

  test('covers deterministic wall, collision, timer, score, and checkpoint rules', async () => {
    await page.goto(gamePath + '?debug=USER', { waitUntil: 'networkidle' });
    const game = page.locator('.full-page.ref .jezzball-game');
    await expect(game.locator('.jezzball-overlay')).toContainText('Final score 450');
    await installDeterministicGameClock(page);

    const resetSave = page.waitForResponse(resp => {
      if (!resp.url().includes('/api/v1/ref') || resp.request().method() !== 'PATCH' || !resp.ok()) return false;
      const body = resp.request().postDataJSON();
      return Array.isArray(body)
        && body.some(op => op.path === '/plugins/plugin~1jezzball')
        && body.some(op => op.path === '/plugins/plugin~1score');
    });
    await game.locator('.jezzball-new-game').click();
    await resetSave;
    await expect(game).toBeFocused();
    await expect(game.locator('.jezzball-level')).toHaveText('Level 1');
    await expect(game.locator('.jezzball-score')).toHaveText('Score 0');
    await expect(game.locator('.jezzball-overlay')).not.toHaveClass(/visible/);
    await game.locator('.jezzball-speed').click();

    await moveCursor(game, 'ArrowLeft', 8);
    await game.press('Enter');
    await advanceGame(page, 30);
    await moveCursor(game, 'ArrowRight', 16);
    await game.press('Enter');
    await advanceGame(page, 30);
    await game.press('Space');
    await moveCursor(game, 'ArrowUp', 4);
    await game.press('Enter');
    await advanceGame(page, 52);

    const levelSave = page.waitForResponse(resp => (
      resp.url().includes('/api/v1/ref') && resp.request().method() === 'PATCH' && resp.ok()
    ));
    await moveCursor(game, 'ArrowDown', 10);
    await game.press('Enter');
    await advanceGame(page, 52);
    await levelSave;
    await expect(game.locator('.jezzball-overlay')).toContainText('Level 1 complete');
    await expect(game.locator('.jezzball-level')).toHaveText('Level 2');
    await expect(game.locator('.jezzball-score')).not.toHaveText('Score 0');

    await game.locator('.jezzball-new-game').click();
    await expect(game).toBeFocused();
    await game.press('Space');
    await moveCursor(game, 'ArrowLeft', 8);
    await moveCursor(game, 'ArrowUp', 8);
    await game.press('Enter');
    await advanceGame(page, 8);
    await expect(game.locator('.jezzball-lives')).toHaveText('Lives 2');

    const finalSave = page.waitForResponse(resp => (
      resp.url().includes('/api/v1/ref') && resp.request().method() === 'PATCH' && resp.ok()
    ));
    await advanceGame(page, 2_401, 50);
    await finalSave;
    await expect(game.locator('.jezzball-overlay')).toContainText(/Game over · score \d+/);
  });

  test('repeats the atom sweep with swapped colors', async () => {
    await page.goto(gamePath + '?debug=ANON', { waitUntil: 'networkidle' });
    const game = page.locator('.full-page.ref .jezzball-game');
    await game.locator('.jezzball-new-game').click();
    await installDeterministicGameClock(page);
    const canvas = game.locator('.jezzball-canvas');
    await canvas.evaluate((element: HTMLCanvasElement) => {
      const context = element.getContext('2d')!;
      const fillRect = context.fillRect.bind(context);
      const fill = context.fill.bind(context);
      const colors = new Set(['#d93643', '#f4f1e8']);
      let background = '';
      const sweeps: string[] = [];
      context.fillRect = (...args) => {
        const color = String(context.fillStyle);
        if (colors.has(color)) background = color;
        fillRect(...args);
      };
      context.fill = (...args) => {
        const color = String(context.fillStyle);
        if (background && colors.has(color)) sweeps.push(`${background}/${color}`);
        fill(...args);
      };
      (window as Window & { __jezzBallSweeps?: string[] }).__jezzBallSweeps = sweeps;
    });

    await advanceGame(page, 30);
    const sweeps = await page.evaluate(() => (
      (window as Window & { __jezzBallSweeps?: string[] }).__jezzBallSweeps
    ));
    expect(sweeps).toContain('#f4f1e8/#d93643');
    expect(sweeps).toContain('#d93643/#f4f1e8');
    const outline = await canvas.evaluate((element: HTMLCanvasElement) => {
      const context = element.getContext('2d')!;
      return { color: context.strokeStyle, width: context.lineWidth };
    });
    expect(outline).toEqual({ color: '#000000', width: 0.5 });
  });

  test('uses two-finger wall gestures with a diagonal dead zone', async () => {
    await page.goto(gamePath + '?debug=ANON', { waitUntil: 'networkidle' });
    const game = page.locator('.full-page.ref .jezzball-game');
    await game.locator('.jezzball-new-game').click();
    await installDeterministicGameClock(page);
    const canvas = game.locator('.jezzball-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('JezzBall canvas has no bounding box');
    const point = (x: number, y: number) => ({
      clientX: box.x + box.width * x / 32,
      clientY: box.y + box.height * y / 24,
      pointerType: 'touch',
      button: 0,
    });

    await canvas.dispatchEvent('pointerdown', { ...point(3, 7), pointerId: 1, isPrimary: true });
    await canvas.dispatchEvent('pointerdown', { ...point(5, 9), pointerId: 2 });
    await advanceGame(page, 1);
    await canvas.dispatchEvent('pointerup', { ...point(3, 7), pointerId: 1, isPrimary: true });
    await canvas.dispatchEvent('pointerup', { ...point(5, 9), pointerId: 2 });
    const diagonalPixel = await canvas.evaluate((element: HTMLCanvasElement) => (
      [...element.getContext('2d')!.getImageData(4 * 25 + 12, 8 * 25 + 12, 1, 1).data]
    ));
    expect(diagonalPixel.slice(0, 3)).not.toEqual([215, 215, 223]);

    await canvas.dispatchEvent('pointerdown', { ...point(3, 7), pointerId: 3, isPrimary: true });
    await canvas.dispatchEvent('pointerdown', { ...point(3, 9), pointerId: 4 });
    await advanceGame(page, 1);
    const wallPixel = await canvas.evaluate((element: HTMLCanvasElement) => (
      [...element.getContext('2d')!.getImageData(3 * 25 + 12, 8 * 25 + 12, 1, 1).data]
    ));
    expect(wallPixel.slice(0, 3)).toEqual([227, 66, 79]);
    const leadingDots = await canvas.evaluate((element: HTMLCanvasElement) => {
      const context = element.getContext('2d')!;
      return [8, 17].flatMap(offsetX => [8, 17].map(offsetY => (
        [...context.getImageData(3 * 25 + offsetX, 8 * 25 + offsetY, 1, 1).data].slice(0, 3)
      )));
    });
    expect(leadingDots).toEqual(Array(4).fill([255, 255, 255]));
    await expect(canvas).toHaveCSS('cursor', 'ns-resize');
  });

  test('uses single touches as clicks before a multitouch gesture', async () => {
    await page.goto(gamePath + '?debug=ANON', { waitUntil: 'networkidle' });
    const game = page.locator('.full-page.ref .jezzball-game');
    await game.locator('.jezzball-new-game').click();
    await installDeterministicGameClock(page);
    const canvas = game.locator('.jezzball-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('JezzBall canvas has no bounding box');
    const touch = {
      clientX: box.x + box.width * 3 / 32,
      clientY: box.y + box.height * 8 / 24,
      pointerType: 'touch',
      pointerId: 1,
      isPrimary: true,
      button: 0,
    };

    await canvas.dispatchEvent('pointerdown', touch);
    await canvas.dispatchEvent('pointerup', touch);
    await advanceGame(page, 1);
    const wallPixel = await canvas.evaluate((element: HTMLCanvasElement) => (
      [...element.getContext('2d')!.getImageData(3 * 25 + 12, 8 * 25 + 12, 1, 1).data]
    ));
    expect(wallPixel.slice(0, 3)).toEqual([227, 66, 79]);
  });

  test('handles wall growth edge cases', async () => {
    (globalThis as typeof globalThis & {
      $localize: (parts: TemplateStringsArray, ...expressions: unknown[]) => string;
    }).$localize = (parts, ...expressions) => parts.reduce(
      (result, part, index) => result + (index ? expressions[index - 1] : '') + part,
      '',
    );
    const { jezzballMod, jezzballPlugin } = await import('../src/app/mods/games/jezzball');
    expect(jezzballMod.plugin?.map(plugin => plugin.tag)).toContain('plugin/score');
    const snippet = jezzballPlugin.config?.snippet;
    const ui = jezzballPlugin.config?.ui;
    const css = jezzballPlugin.config?.css;
    const infoUi = jezzballPlugin.config?.infoUi;
    if (!snippet) throw new Error('JezzBall plugin has no snippet');
    if (!ui) throw new Error('JezzBall plugin has no UI');
    if (!css) throw new Error('JezzBall plugin has no CSS');
    if (!infoUi) throw new Error('JezzBall plugin has no info UI');
    const Handlebars = (await import('handlebars')).default;
    expect(Handlebars.compile(infoUi)({ final: true, score: 450 })).toContain('🏆️ 450');
    expect(Handlebars.compile(infoUi)({ final: false, score: 450 })).toBe('');
    const scriptSource = snippet.match(/<script>([\s\S]*)<\/script>/)?.[1];
    if (!scriptSource) throw new Error('JezzBall plugin has no script');
    await page.goto('about:blank');
    await page.setContent(`<style>${css}</style>${ui.replace('{{defer el (jezzball ref actions el)}}', '')}`);
    await page.evaluate(source => {
      let helper: (
        ref: { plugins: Record<string, unknown> },
        actions: object,
        element: Document,
      ) => () => void = () => () => {};
      (window as Window & {
        Handlebars: {
          registerHelper: (name: string, value: typeof helper) => void;
        };
      }).Handlebars = {
        registerHelper: (_name, value) => helper = value,
      };
      const script = document.createElement('script');
      script.textContent = source;
      document.head.appendChild(script);
      helper({ plugins: { 'plugin/jezzball': { level: 1, score: 0, final: true } } }, {}, document)();
    }, scriptSource);
    await installDeterministicGameClock(page);
    await placeTestBalls(page, [
      { x: 12.5, y: 10.5 },
      { x: 26, y: 20 },
    ]);
    const game = page.locator('.jezzball-game');
    await game.locator('.jezzball-new-game').click();
    const canvas = game.locator('.jezzball-canvas');
    await expect(game.locator('.jezzball-score')).toHaveCSS('font-variant-numeric', 'tabular-nums');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('JezzBall canvas has no bounding box');
    await canvas.click({
      position: {
        x: box.width * 11.5 / 32,
        y: box.height * 10.5 / 24,
      },
    });
    await advanceGame(page, 1);

    const wallPixel = await canvas.evaluate((element: HTMLCanvasElement) => (
      [...element.getContext('2d')!.getImageData(11 * 25 + 12, 10 * 25 + 12, 1, 1).data]
    ));
    expect(wallPixel.slice(0, 3)).toEqual([227, 66, 79]);
    const outline = await canvas.evaluate((element: HTMLCanvasElement) => {
      const context = element.getContext('2d')!;
      return { color: context.strokeStyle, width: context.lineWidth };
    });
    expect(outline).toEqual({ color: '#000000', width: 0.5 });

    await placeTestBalls(page, [
      { x: 2.3, y: 8.5, left: true },
      { x: 26, y: 20 },
    ]);
    await game.locator('.jezzball-new-game').evaluate((button: HTMLButtonElement) => button.click());
    await game.locator('.jezzball-direction').click();
    await trackBallCenters(canvas);
    await canvas.click({
      position: {
        x: box.width * 2.5 / 32,
        y: box.height * 10.5 / 24,
      },
    });
    await advanceGame(page, 5, 50);

    await expect(game.locator('.jezzball-lives')).toHaveText(/Lives:? 2/);
    const leadingBall = await canvas.evaluate((element: HTMLCanvasElement) => (
      (element as HTMLCanvasElement & { __testBallCenters: Array<{ x: number; y: number }> })
        .__testBallCenters.filter(center => center.x < 10).at(-1)
    ));
    expect(leadingBall?.y).toBeLessThan(9.5);
    const finishedWallPixel = await canvas.evaluate((element: HTMLCanvasElement) => (
      [...element.getContext('2d')!.getImageData(2 * 25 + 12, 10 * 25 + 12, 1, 1).data]
    ));
    expect(finishedWallPixel.slice(0, 3)).toEqual([0, 0, 0]);
  });

  test('keeps the surviving half when an atom hits the other half', async () => {
    await page.addInitScript(() => {
      Math.random = () => 0.5;
    });
    await page.goto(gamePath + '?debug=ANON', { waitUntil: 'networkidle' });
    const game = page.locator('.full-page.ref .jezzball-game');
    await game.locator('.jezzball-new-game').click();
    await installDeterministicGameClock(page);
    await game.locator('.jezzball-sound').click();
    await game.locator('.jezzball-speed').click();
    await game.locator('.jezzball-direction').click();
    const canvas = game.locator('.jezzball-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('JezzBall canvas has no bounding box');
    await canvas.click({
      position: {
        x: box.width * 16.5 / 32,
        y: box.height * 14.5 / 24,
      },
    });
    await advanceGame(page, 60);

    await expect(game.locator('.jezzball-lives')).toHaveText('Lives 1');
    const survivingPixel = await canvas.evaluate((element: HTMLCanvasElement) => (
      [...element.getContext('2d')!.getImageData(8 * 25 + 12, 14 * 25 + 12, 1, 1).data]
    ));
    expect(survivingPixel.slice(0, 3)).toEqual([0, 0, 0]);
    const capturedGridPixel = await canvas.evaluate((element: HTMLCanvasElement) => (
      [...element.getContext('2d')!.getImageData(8 * 25 + 12, 14 * 25 + 5, 1, 1).data]
    ));
    expect(capturedGridPixel.slice(0, 3)).toEqual([0, 0, 0]);
  });

  test('breaks unfinished walls without bouncing the atom', async () => {
    await page.goto(gamePath + '?debug=ANON', { waitUntil: 'networkidle' });
    const game = page.locator('.full-page.ref .jezzball-game');
    const canvas = game.locator('.jezzball-canvas');
    await installDeterministicGameClock(page);
    await placeTestBalls(page, [
      { x: 15, y: 9.3, left: true },
      { x: 26, y: 20 },
    ]);
    await game.locator('.jezzball-new-game').click();
    await game.locator('.jezzball-direction').click();
    await trackBallCenters(canvas);
    const box = await canvas.boundingBox();
    if (!box) throw new Error('JezzBall canvas has no bounding box');
    await canvas.click({
      position: {
        x: box.width * 10.5 / 32,
        y: box.height * 10.5 / 24,
      },
    });
    await advanceGame(page, 10, 50);
    await expect(game.locator('.jezzball-lives')).toHaveText('Lives 1');
    const leadingBall = await canvas.evaluate((element: HTMLCanvasElement) => (
      (element as HTMLCanvasElement & { __testBallCenters: Array<{ x: number; y: number }> })
        .__testBallCenters.filter(center => center.x < 20).at(-1)
    ));
    expect(leadingBall?.x).toBeLessThan(14);
    expect(Math.abs((15 - leadingBall!.x) - (leadingBall!.y - 9.3))).toBeLessThan(0.01);

    await page.goto(gamePath + '?debug=ANON', { waitUntil: 'networkidle' });
    await installDeterministicGameClock(page);
    await placeTestBalls(page, [
      { x: 12, y: 9.3 },
      { x: 26, y: 20 },
    ]);
    await game.locator('.jezzball-new-game').click();
    await game.locator('.jezzball-direction').click();
    const trailingBox = await canvas.boundingBox();
    if (!trailingBox) throw new Error('JezzBall canvas has no bounding box');
    await canvas.click({
      position: {
        x: trailingBox.width * 10.5 / 32,
        y: trailingBox.height * 10.5 / 24,
      },
    });
    await advanceGame(page, 6, 50);
    await expect(game.locator('.jezzball-lives')).toHaveText('Lives 1');
  });

  test('checks both halves before completing a wall', async () => {
    await page.goto(gamePath + '?debug=ANON', { waitUntil: 'networkidle' });
    const game = page.locator('.full-page.ref .jezzball-game');
    const canvas = game.locator('.jezzball-canvas');
    await installDeterministicGameClock(page);
    await placeTestBalls(page, [
      { x: 28.6, y: 8.5 },
      { x: 5, y: 20, left: true, up: true },
    ]);
    await game.locator('.jezzball-new-game').click();
    await game.locator('.jezzball-direction').click();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('JezzBall canvas has no bounding box');
    await canvas.click({
      position: {
        x: box.width * 30.5 / 32,
        y: box.height * 10.5 / 24,
      },
    });
    await advanceGame(page, 8);

    await expect(game.locator('.jezzball-lives')).toHaveText('Lives 0');
    await expect(game.locator('.jezzball-overlay')).toContainText(/Game over · score \d+/);
  });
});
