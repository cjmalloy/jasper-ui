import { expect, type Locator, type Page } from '@playwright/test';
import { test } from './setup';

const WEB_SUBMIT_URL = '/submit/web?url=https://www.jasper.example/ref-form-drop&tag=public&debug=ADMIN';

function linksList(page: Page, id: 'alts' | 'sources') {
  return page.locator(`[id$="-${id}"] .form-group`);
}

function tagList(page: Page) {
  return page.locator('.form-group').filter({
    has: page.getByRole('button', { name: '+ Add another tag' }),
  }).first();
}

async function dragTagTo(page: Page, target: Locator) {
  const handle = tagList(page).locator('.list-drag label').first();
  await expect(handle).toBeVisible();
  const from = (await handle.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  // Move past the CDK drag threshold to start dragging
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 - 10, { steps: 5 });
  await expect(target).toBeVisible();
  const to = (await target.boundingBox())!;
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 10 });
  await page.mouse.up();
}

test.describe.serial('Ref form drop', () => {
  test('drops a tag onto empty sources', async ({ page }) => {
    await page.goto(WEB_SUBMIT_URL);
    await expect(tagList(page).locator('.list-drag').first()).toBeVisible();
    await expect(linksList(page, 'sources').locator('.list-drag')).toHaveCount(0);

    await dragTagTo(page, linksList(page, 'sources'));

    await expect(linksList(page, 'sources').locator('.list-drag input:not(.preview)')).toHaveValue('tag:/+user/public');
  });

  test('drops a tag onto empty alts', async ({ page }) => {
    await page.goto(WEB_SUBMIT_URL);
    await expect(tagList(page).locator('.list-drag').first()).toBeVisible();
    await expect(linksList(page, 'alts').locator('.list-drag')).toHaveCount(0);

    await dragTagTo(page, linksList(page, 'alts'));

    await expect(linksList(page, 'alts').locator('.list-drag input:not(.preview)')).toHaveValue('tag:/+user/public');
  });
});
