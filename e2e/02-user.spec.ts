import { expect } from '@playwright/test';
import { mod, test } from './setup';

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
      has: page.getByRole('link', { name: '+user', exact: true }),
    });
    const downloadPromise = page.waitForEvent('download');
    await profile.locator('.connect-action').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('@localhost.json');
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk);

    expect(JSON.parse(Buffer.concat(chunks).toString())).toEqual({
      url: 'http://localhost:8081/',
      title: '@localhost',
      tags: ['public', 'internal', '+plugin/cron', '+plugin/origin/pull', '+plugin/origin/tunnel'],
      plugins: {
        '+plugin/cron': { interval: 'PT15M' },
        '+plugin/origin': { remote: '', local: '@localhost' },
        '+plugin/origin/tunnel': { remoteUser: '+user' },
      },
    });
  });

  test('fills the user form in one step', async ({ page }) => {
    await page.goto('/user/+user/formfill?debug=ADMIN', { waitUntil: 'networkidle' });
    const existing = page.locator('button', { hasText: 'Delete' });
    if (await existing.isVisible().catch(() => false)) {
      page.once('dialog', dialog => dialog.accept());
      await existing.click();
      await page.goto('/user/+user/formfill?debug=ADMIN', { waitUntil: 'networkidle' });
    }
    await page.locator('[id$=-name]').fill('Form Fill');
    const writeAccess = page.locator('.form-group').filter({ hasText: 'Write Access:' }).filter({ hasNotText: 'Tag Write Access:' });
    await writeAccess.getByRole('button', { name: '+ Add another tag' }).click();
    await writeAccess.locator('input').last().fill('+custom');
    const created = page.waitForResponse(resp => resp.url().includes('/api/v1/user') && resp.request().method() === 'POST');
    await page.locator('button', { hasText: 'Create' }).click();
    await created;

    await page.goto('/user/+user/formfill?debug=ADMIN', { waitUntil: 'networkidle' });
    await expect(page.locator('[id$=-name]')).toHaveValue('Form Fill');
    await expect(writeAccess.locator('input').last()).toHaveValue('+custom');

    await page.goto('/settings/user?debug=ADMIN', { waitUntil: 'networkidle' });
    const profile = page.locator('.profile', { has: page.getByRole('link', { name: 'Form Fill' }) });
    await profile.locator('.actions .fake-link', { hasText: 'edit' }).click();
    await expect(profile.locator('[id$=-name]')).toHaveValue('Form Fill');
    const profileWriteAccess = profile.locator('.form-group').filter({ hasText: 'Write Access:' }).filter({ hasNotText: 'Tag Write Access:' });
    await expect(profileWriteAccess.locator('input').last()).toHaveValue('+custom');
    await profile.locator('[id$=-name]').fill('Edited');
    await profile.locator('.actions .fake-link', { hasText: 'edit' }).click();
    await expect(profile.locator('.actions .fake-link', { hasText: '*edit*' })).toBeVisible();
    await profile.locator('.actions .fake-link', { hasText: '*edit*' }).click();
    await expect(profile.locator('[id$=-name]')).toHaveValue('Edited');
    await profile.locator('button', { hasText: 'cancel' }).click();
    await expect(profile.locator('.actions .fake-link', { hasText: '*edit*' })).toHaveCount(0);
  });
});
