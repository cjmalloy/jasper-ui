import { expect, test } from '@playwright/test';
import { mod } from './setup';

test.describe.serial('User Page', () => {

  test('clear mods', async ({ page }) => {
    await mod(page, '#mod-user');
  });

  test('displays inbox and outbox navigation buttons on user page', async ({ page }) => {
    await page.goto('/tag/user/alice?debug=USER&tag=alice');
    await expect(page).toHaveURL(/\/tag\/user\/alice/);
    await expect(page.locator('.sidebar .tag-select')).toBeVisible();
    await expect(page.locator('.sidebar .tag-select', { hasText: 'Inbox' })).toBeVisible();
    await expect(page.locator('.sidebar .tag-select', { hasText: 'Outbox' })).toBeVisible();
  });

  test('inbox button navigates to public user tag and is active', async ({ page }) => {
    await page.goto('/tag/user/alice?debug=USER&tag=alice');
    await page.locator('.sidebar .tag-select').getByText('Inbox').click();
    await expect(page).toHaveURL(/\/tag\/user\/alice/);
    await expect(page.locator('.sidebar .tag-select').getByText('Inbox').locator('..')).toHaveClass(/toggled/);
    await expect(page.locator('.sidebar .tag-select').getByText('Outbox').locator('..')).not.toHaveClass(/toggled/);
  });

  test('outbox button navigates to protected user tag and is active', async ({ page }) => {
    await page.goto('/tag/user/alice?debug=USER&tag=alice');
    await page.locator('.sidebar .tag-select').getByText('Outbox').click();
    await expect(page).toHaveURL(/\/tag\/\+user\/alice/);
    await expect(page.locator('.sidebar .tag-select').getByText('Outbox').locator('..')).toHaveClass(/toggled/);
    await expect(page.locator('.sidebar .tag-select').getByText('Inbox').locator('..')).not.toHaveClass(/toggled/);
  });

  test('outbox button is active when viewing protected user tag', async ({ page }) => {
    await page.goto('/tag/+user/alice?debug=USER&tag=alice');
    await expect(page.locator('.sidebar .tag-select').getByText('Outbox').locator('..')).toHaveClass(/toggled/);
    await expect(page.locator('.sidebar .tag-select').getByText('Inbox').locator('..')).not.toHaveClass(/toggled/);
  });

  test('navigation works for different user tags', async ({ page }) => {
    await page.goto('/tag/user/bob?debug=USER&tag=bob');
    await expect(page).toHaveURL(/\/tag\/user\/bob/);
    await expect(page.locator('.sidebar .tag-select', { hasText: 'Inbox' })).toBeVisible();
    await page.locator('.sidebar .tag-select').getByText('Inbox').click();
    await expect(page).toHaveURL(/\/tag\/user\/bob/);
    await page.locator('.sidebar .tag-select').getByText('Outbox').click();
    await expect(page).toHaveURL(/\/tag\/\+user\/bob/);
  });

  test('downloads a pre-filled connection ref', async ({ page }) => {
    await page.goto('/settings/user?debug=ADMIN', { waitUntil: 'networkidle' });
    const profile = page.locator('.profile', {
      has: page.getByRole('link', { name: 'alice', exact: true }),
    });
    const downloadPromise = page.waitForEvent('download');
    await profile.locator('.connect-action').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('@localhost.json');
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk);

    expect(JSON.parse(Buffer.concat(chunks).toString())).toEqual({
      url: 'http://localhost:8081',
      title: '@localhost',
      tags: ['public', 'internal', '+plugin/cron', '+plugin/origin/pull', '+plugin/origin/tunnel'],
      plugins: {
        '+plugin/cron': { interval: 'PT15M' },
        '+plugin/origin': { remote: '', local: '@localhost' },
        '+plugin/origin/tunnel': { remoteUser: 'user/alice' },
      },
    });
  });
});
