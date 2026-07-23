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
    await page.locator('.editor textarea').fill('{"level":3,"score":450,"final":true}');
    await page.getByText('show advanced').click();
    await page.locator('[name=published]').fill('2026-01-01T00:00');
    await page.locator('[name=published]').blur();
    const submitPromise = page.waitForResponse(resp => (
      resp.url().includes('/api/v1/ref') && resp.request().method() === 'POST' && resp.ok()
    ));
    await page.locator('button', { hasText: 'Submit' }).click({ force: true });
    await submitPromise;
    await expect(page.locator('.full-page.ref .link a').first()).toHaveText(title);
    await expect(page).toHaveURL(/\/ref\//);
    gamePath = new URL(page.url()).pathname;
  });

  test('restores the final score and starts a new game', async () => {
    const game = page.locator('.full-page.ref .jezzball-game');
    await expect(game.locator('.jezzball-canvas')).toBeVisible();
    await expect(game.locator('.jezzball-overlay')).toContainText('Final score 450');
    await expect(game.locator('.jezzball-level')).toHaveText('Level 3');

    const direction = game.locator('.jezzball-direction');
    await expect(direction).toHaveText('Wall ↕');
    await direction.click();
    await expect(direction).toHaveText('Wall ↔');
  });

  test('plays a read-only Ref as a saved example', async () => {
    await page.goto(gamePath + '?debug=ANON', { waitUntil: 'networkidle' });
    const game = page.locator('.full-page.ref .jezzball-game');
    await expect(game.locator('.jezzball-example')).toHaveText('Saved example');
    await expect(game.locator('.jezzball-overlay')).toContainText('Final score 450');
    await game.locator('.jezzball-overlay button').click();
    await expect(game.locator('.jezzball-level')).toHaveText('Level 1');
    await expect(game.locator('.jezzball-canvas')).toBeVisible();
  });

  test('covers deterministic wall, collision, timer, score, and checkpoint rules', async () => {
    await page.goto(gamePath + '?debug=USER', { waitUntil: 'networkidle' });
    const game = page.locator('.full-page.ref .jezzball-game');
    await expect(game.locator('.jezzball-overlay')).toContainText('Final score 450');
    await installDeterministicGameClock(page);

    const resetSave = page.waitForResponse(resp => (
      resp.url().includes('/api/v1/ref') && resp.request().method() === 'PATCH' && resp.ok()
    ));
    await game.locator('.jezzball-overlay button').click();
    await resetSave;
    await expect(game.locator('.jezzball-level')).toHaveText('Level 1');
    await expect(game.locator('.jezzball-score')).toHaveText('Score 0');
    await expect(game.locator('.jezzball-overlay')).not.toHaveClass(/visible/);

    await moveCursor(game, 'ArrowLeft', 8);
    await game.press('Enter');
    await advanceGame(page, 15);
    await moveCursor(game, 'ArrowRight', 16);
    await game.press('Enter');
    await advanceGame(page, 15);
    await game.press('Space');
    await moveCursor(game, 'ArrowUp', 4);
    await game.press('Enter');
    await advanceGame(page, 26);

    const levelSave = page.waitForResponse(resp => (
      resp.url().includes('/api/v1/ref') && resp.request().method() === 'PATCH' && resp.ok()
    ));
    await moveCursor(game, 'ArrowDown', 10);
    await game.press('Enter');
    await advanceGame(page, 26);
    await levelSave;
    await expect(game.locator('.jezzball-overlay')).toContainText('Level 1 complete');
    await expect(game.locator('.jezzball-level')).toHaveText('Level 2');
    await expect(game.locator('.jezzball-score')).not.toHaveText('Score 0');

    await game.locator('.jezzball-overlay button').click();
    await game.focus();
    await game.press('Space');
    await moveCursor(game, 'ArrowLeft', 8);
    await moveCursor(game, 'ArrowUp', 8);
    await game.press('Enter');
    await advanceGame(page, 4);
    await expect(game.locator('.jezzball-lives')).toHaveText('Lives 2');

    const finalSave = page.waitForResponse(resp => (
      resp.url().includes('/api/v1/ref') && resp.request().method() === 'PATCH' && resp.ok()
    ));
    await advanceGame(page, 2_401, 50);
    await finalSave;
    await expect(game.locator('.jezzball-overlay')).toContainText(/Game over · score \d+/);
  });

  test('ejects a playable self-contained page', async () => {
    const downloadPromise = page.waitForEvent('download');
    await page.locator('.full-page.ref .jezzball-eject').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('jezzball.html');
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk);
    const html = Buffer.concat(chunks).toString();

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('jezzballApp');
    expect(html).not.toContain('<script src=');

    const portable = await page.context().newPage();
    await portable.setContent(html);
    await expect(portable.locator('.jezzball-canvas')).toBeVisible();
    await expect(portable.locator('.jezzball-level')).toHaveText('Level 2');
    await portable.close();
  });
});
