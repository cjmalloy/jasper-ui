import { expect, test } from '@playwright/test';
import { deleteRef } from './setup';

test.describe.serial('Upload Edit', () => {
  const originalUrl = 'https://www.example.com/upload-edit-original';
  const editedUrl = 'https://www.example.com/upload-edit-edited';

  test('clean up', async ({ page }) => {
    await deleteRef(page, originalUrl);
    await deleteRef(page, editedUrl);
  });

  test('edit url and title before uploading', async ({ page }) => {
    await page.goto('/submit/upload?debug=ADMIN', { waitUntil: 'networkidle' });
    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'refs.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify([{ url: originalUrl, title: 'Original Title', tags: ['public'] }])),
    });
    const ref = page.locator('.ref').first();
    await expect(ref.locator('.link a').first()).toHaveText('Original Title');

    await ref.locator('.actions .fake-link', { hasText: 'edit' }).click();
    await page.locator('form.form input[name="url"]').fill(editedUrl);
    await page.locator('form.form input[name="title"]').fill('Edited Title');
    await page.locator('form.form button[type="submit"]').click();
    await expect(page.locator('form.form')).toHaveCount(0);
    await expect(page.locator('.ref .link a').first()).toHaveText('Edited Title');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('button', { hasText: 'download all' }).click(),
    ]);
    expect(download.suggestedFilename()).toContain('uploads');

    await page.locator('.ref .actions .fake-link', { hasText: 'upload' }).click();
    await expect(page).toHaveURL(url => decodeURIComponent(url.pathname).endsWith(editedUrl), { timeout: 10_000 });
    await expect(page.locator('.full-page.ref .link a').first()).toHaveText('Edited Title');
  });
});
