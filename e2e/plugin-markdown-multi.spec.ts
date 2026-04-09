import { createHmac } from 'crypto';
import { expect, test } from '@playwright/test';
import { mod } from './setup';

const DEBUG_SECRET = Buffer.from(
  'MjY0ZWY2ZTZhYmJhMTkyMmE5MTAxMTg3Zjc2ZDlmZWUwYjk0MDgzODA0MDJiOTgyNTk4MmNjYmQ4Yjg3MmVhYjk0MmE0OGFmNzE2YTQ5ZjliMTEyN2NlMWQ4MjA5OTczYjU2NzAxYTc4YThkMzYxNzdmOTk5MTIxODZhMTkwMDM=',
  'base64',
).toString('utf8');

function debugToken(role: string) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    aud: '',
    verified_email: true,
    sub: 'debug',
    auth: role,
  })).toString('base64url');
  const body = `${header}.${payload}`;
  const signature = createHmac('sha256', DEBUG_SECRET).update(body).digest('base64url');
  return `${body}.${signature}`;
}

test.describe.serial('Markdown multi action chooser', () => {
  let title = '';

  test('turn on markdown mods', async ({ page }) => {
    await mod(page,
      '#mod-root',
      '#mod-scripts',
      '#mod-pdf',
      '#mod-thumbnail',
      '#mod-images',
      '#mod-error',
      '#mod-markitdown',
      '#mod-markerpdf',
      '#mod-cache',
      '#mod-filecache',
      '#mod-mailbox',
      '#mod-user');
  });

  test('creates a pdf ref', async ({ page }) => {
    const pdfUrl = `https://example.com/test-${Date.now()}.pdf`;
    title = `test-${Date.now()}.pdf`;
    const authHeaders = {
      Authorization: `Bearer ${debugToken('ROLE_USER')}`,
    };
    const csrfResponse = await page.request.get('http://localhost:8081/api/v1/user/whoami', {
      headers: authHeaders,
    });
    const csrf = csrfResponse.headers()['set-cookie']?.match(/XSRF-TOKEN=([^;]+)/)?.[1];

    expect(csrfResponse.ok()).toBeTruthy();
    expect(csrf).toBeTruthy();

    const response = await page.request.post('http://localhost:8081/api/v1/ref', {
      headers: {
        ...authHeaders,
        'X-XSRF-TOKEN': csrf!,
        Cookie: `XSRF-TOKEN=${csrf}`,
      },
      data: {
        url: pdfUrl,
        origin: '',
        title,
        published: new Date().toISOString(),
        tags: ['public', '+user/debug', 'plugin/pdf'],
        plugins: {
          'plugin/pdf': {
            url: pdfUrl,
          },
        },
      },
    });

    expect(response.ok()).toBeTruthy();
  });

  test('shows choices and remembers the selection', async ({ page }) => {
    await page.goto('/?debug=USER', { waitUntil: 'networkidle' });
    await page.locator('.ref', { hasText: title }).first().locator('a', { hasText: 'permalink' }).click();
    await expect(page.locator('.full-page.ref .actions')).toBeVisible({ timeout: 15_000 });

    await page.locator('.full-page.ref .actions .show-more').click();
    await page.locator('.advanced-actions .multi-action-trigger', { hasText: 'markdown' }).click();

    const chooser = page.locator('.multi-actions-menu');
    await expect(chooser).toContainText('MarkItDown');
    await expect(chooser).toContainText('Marker PDF');
    await expect(chooser.locator('.multi-actions-remember')).toContainText('remember');

    await chooser.locator('.multi-actions-remember input').check();
    await chooser.locator('.multi-action-option .fake-link', { hasText: 'MarkItDown' }).click();
    await expect(page.locator('.full-page.ref .actions .fake-link', { hasText: 'cancel' })).toHaveCount(1);

    await page.locator('.full-page.ref .actions .fake-link', { hasText: 'cancel' }).click();
    await page.locator('.full-page.ref .actions .show-more').click();
    await page.locator('.advanced-actions .multi-action-trigger', { hasText: 'markdown' }).click();

    await expect(page.locator('.multi-actions-menu')).toHaveCount(0);
    await expect(page.locator('.full-page.ref .actions .fake-link', { hasText: 'cancel' })).toHaveCount(1);
  });
});
