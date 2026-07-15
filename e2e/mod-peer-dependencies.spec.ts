import { expect, test } from '@playwright/test';
import { deleteRef, mod } from './setup';

const url = 'comment:peer-dependency-test';

test.describe.serial('Mod peer dependencies', () => {
  test('setup', async ({ page }) => {
    await mod(page, '#mod-root', '#mod-store');
    await deleteRef(page, url);
    const response = await page.request.post('/api/v1/ref?debug=ADMIN', {
      data: {
        url,
        title: 'Peer dependency test',
        tags: ['plugin/mod'],
        plugins: {
          'plugin/mod': {
            peerDependencies: ['Community Tools & More'],
            plugin: [{
              tag: 'plugin/peer-dependency-test',
              name: 'Peer dependency test',
              config: { mod: 'Peer dependency test', version: 1 },
            }],
          },
        },
      },
    });
    expect(response.ok()).toBe(true);
  });

  test('shows unavailable dependencies on the setup page', async ({ page }) => {
    await page.goto(`/ref/e/${encodeURIComponent(url)}?debug=ADMIN`, { waitUntil: 'networkidle' });
    await page.locator('.full-page.ref .actions .fake-link', { hasText: 'install' }).click();
    await page.locator('.full-page.ref .actions .fake-link', { hasText: 'yes' }).click();
    await page.locator('.settings a', { hasText: 'settings' }).click();
    await page.locator('.tabs a', { hasText: 'setup' }).first().click();

    await expect(page.locator('.peer-dependency-warning')).toHaveAttribute(
      'title',
      'Unmet peer dependencies: Community Tools & More',
    );
    const link = page.locator('.store-dependency-link', { hasText: 'Community Tools & More' });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(url => (
      url.pathname === '/settings/ref/plugin/mod/store' &&
      url.searchParams.get('search') === 'Community Tools & More'
    ));
  });

  test('cleanup', async ({ page }) => {
    await deleteRef(page, url);
  });
});
