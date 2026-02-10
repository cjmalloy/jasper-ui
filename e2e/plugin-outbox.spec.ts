import { test, expect, type Page } from '@playwright/test';
import { clearMods, openSidebar } from './setup';

test.describe.serial('Outbox Plugin: Remote Notifications', () => {
  const mainApi = process.env.MAIN_API || 'http://localhost:8081';
  const mainApiProxy = process.env.MAIN_API_PROXY || 'http://web';
  const replUrl = process.env.REPL_URL || 'http://localhost:8082';
  const replApi = process.env.REPL_API || 'http://localhost:8083';
  const replApiProxy = process.env.REPL_API_PROXY || 'http://repl-web';
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('@\u{ff20}main : clear mods', async () => {
    await clearMods(page);
  });

  test('@\u{ff20}main : turn on inbox, outbox and remote origins', async () => {
    await page.goto('/?debug=ADMIN');
    await page.locator('.settings a', { hasText: 'settings' }).click();
    await page.locator('.tabs a', { hasText: 'setup' }).first().click();

    await page.waitForTimeout(100);
    await page.locator('#mod-comment').waitFor();
    if (!(await page.locator('#mod-comment').isChecked())) {
      await page.locator('#mod-comment').check();
    }
    await expect(page.locator('#mod-comment')).toBeChecked();
    await page.locator('#mod-mailbox').waitFor();
    if (!(await page.locator('#mod-mailbox').isChecked())) {
      await page.locator('#mod-mailbox').check();
    }
    await expect(page.locator('#mod-mailbox')).toBeChecked();
    await page.locator('#mod-root').waitFor();
    if (!(await page.locator('#mod-root').isChecked())) {
      await page.locator('#mod-root').check();
    }
    await expect(page.locator('#mod-root')).toBeChecked();
    await page.locator('#mod-origin').waitFor();
    if (!(await page.locator('#mod-origin').isChecked())) {
      await page.locator('#mod-origin').check();
    }
    await expect(page.locator('#mod-origin')).toBeChecked();
    await page.locator('#mod-user').waitFor();
    if (!(await page.locator('#mod-user').isChecked())) {
      await page.locator('#mod-user').check();
    }
    await expect(page.locator('#mod-user')).toBeChecked();
    await page.locator('button', { hasText: 'Save' }).click();
    await page.locator('.log div', { hasText: 'Success.' }).first().waitFor({ timeout: 15_000, state: 'attached' });
  });

  test('@\u{ff20}main : create users', async () => {
    await page.goto('/?debug=USER&tag=alice');
    await page.waitForLoadState('networkidle');
  });

  test('@\u{ff20}main : replicate \u{ff20}repl', async () => {
    await page.goto('/?debug=ADMIN');
    await page.locator('.settings a', { hasText: 'settings' }).click();
    await page.locator('.tabs a', { hasText: 'origin' }).first().click();
    await openSidebar(page);
    await page.locator('.sidebar .submit-button', { hasText: 'Submit' }).first().click();
    await page.locator('#url').pressSequentially(replApi, { delay: 100 });
    await page.locator('#url').blur();
    await page.getByText('Next').click();
    await page.locator('[name=title]').pressSequentially('Testing Remote @repl', { delay: 100 });
    await page.locator('.floating-ribbons .plugin_origin_pull').click();
    await page.locator('[name=local]').pressSequentially('@repl', { delay: 100 });
    await page.locator('[name=remote]').pressSequentially('@repl', { delay: 100 });
    await page.locator('.plugins-form details.plugin_origin.advanced summary').click();
    await page.locator('[name=proxy]').pressSequentially(replApiProxy, { delay: 100 });
    await page.locator('[name=proxy]').blur();
    const submitPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/ref'));
    await page.locator('button', { hasText: 'Submit' }).click();
    await submitPromise;
    await expect(page.locator('.full-page.ref .link a')).toHaveText('Testing Remote @repl');
    await page.locator('.full-page.ref .actions .fake-link', { hasText: 'enable' }).first().click();
  });

  test('@\u{ff20}repl : clear mods', async () => {
    await clearMods(page, replUrl);
  });

  test('@\u{ff20}repl : turn on outbox and remote origins', async () => {
    await page.goto(replUrl + '/?debug=ADMIN');
    await page.locator('.settings a', { hasText: 'settings' }).click();
    await page.locator('.tabs a', { hasText: 'setup' }).first().click();

    await page.waitForTimeout(100);
    await page.locator('#mod-comment').waitFor();
    if (!(await page.locator('#mod-comment').isChecked())) {
      await page.locator('#mod-comment').check();
    }
    await expect(page.locator('#mod-comment')).toBeChecked();
    await page.locator('button', { hasText: 'Save' }).click();
    await page.locator('.log div', { hasText: 'Success.' }).first().waitFor({ timeout: 15_000, state: 'attached' });

    await page.waitForTimeout(100);
    await page.locator('#mod-mailbox').waitFor();
    if (!(await page.locator('#mod-mailbox').isChecked())) {
      await page.locator('#mod-mailbox').check();
    }
    await expect(page.locator('#mod-mailbox')).toBeChecked();
    await page.locator('button', { hasText: 'Save' }).click();
    await page.locator('.log div', { hasText: 'Success.' }).first().waitFor({ timeout: 15_000, state: 'attached' });

    await page.waitForTimeout(100);
    await page.locator('#mod-root').waitFor();
    if (!(await page.locator('#mod-root').isChecked())) {
      await page.locator('#mod-root').check();
    }
    await expect(page.locator('#mod-root')).toBeChecked();
    await page.locator('#mod-origin').waitFor();
    if (!(await page.locator('#mod-origin').isChecked())) {
      await page.locator('#mod-origin').check();
    }
    await expect(page.locator('#mod-origin')).toBeChecked();
    await page.locator('button', { hasText: 'Save' }).click();
    await page.locator('.log div', { hasText: 'Success.' }).first().waitFor({ timeout: 15_000, state: 'attached' });

    await page.waitForTimeout(100);
    await page.locator('#mod-user').waitFor();
    if (!(await page.locator('#mod-user').isChecked())) {
      await page.locator('#mod-user').check();
    }
    await expect(page.locator('#mod-user')).toBeChecked();
    await page.locator('button', { hasText: 'Save' }).click();
    await page.locator('.log div', { hasText: 'Success.' }).first().waitFor({ timeout: 15_000, state: 'attached' });
  });

  test('@\u{ff20}repl : create users', async () => {
    await page.goto(replUrl + '/?debug=USER&tag=bob');
    await page.waitForLoadState('networkidle');
    await page.goto(replUrl + '/?debug=ADMIN&tag=charlie');
    await page.waitForLoadState('networkidle');
  });

  test('@\u{ff20}repl : replicate \u{ff20}main', async () => {
    await page.goto(replUrl + '/?debug=ADMIN');
    await page.locator('.settings a', { hasText: 'settings' }).click();
    await page.locator('.tabs a', { hasText: 'origin' }).first().click();
    await openSidebar(page);
    await page.locator('.sidebar .submit-button', { hasText: 'Submit' }).first().click();
    await page.locator('#url').pressSequentially(mainApi, { delay: 100 });
    await page.locator('#url').blur();
    await page.getByText('Next').click();
    await page.waitForTimeout(1000); // First part of text is missing
    await page.locator('.floating-ribbons .plugin_origin_pull').click();
    await page.locator('[name=local]').pressSequentially('@main', { delay: 100 });
    await page.locator('.plugins-form details.plugin_origin.advanced summary').click();
    await page.locator('[name=proxy]').pressSequentially(mainApiProxy, { delay: 100 });
    await page.locator('[name=proxy]').blur();
    await page.locator('[name=title]').pressSequentially('Testing Remote @main', { delay: 100 });
    const submitPromise = page.waitForResponse(resp => resp.url().includes('/api/v1/ref'));
    await page.locator('button', { hasText: 'Submit' }).click();
    await submitPromise;
    await expect(page.locator('.full-page.ref .link a')).toHaveText('Testing Remote @main');
    await page.locator('.full-page.ref .actions .fake-link', { hasText: 'enable' }).first().click();
  });

  test('@\u{ff20}repl : creates ref', async () => {
    await page.goto(replUrl + '/?debug=USER&tag=bob');
    await openSidebar(page);
    await page.locator('.sidebar .submit-button', { hasText: 'Submit' }).first().click();
    await page.locator('.tabs a', { hasText: 'text' }).first().click();
    await page.locator('[name=title]').pressSequentially('Ref from other', { delay: 100 });
    await page.locator('.editor textarea').pressSequentially('Hi +user/alice@repl.main! How\'s it going? You should also see this +user/charlie.', { delay: 100 });
    await page.locator('.editor textarea').blur();
    await page.locator('button', { hasText: 'Submit' }).click({ force: true });
    await expect(page.locator('.full-page.ref .link a')).toHaveText('Ref from other');
    await page.waitForTimeout(1000);
  });

  test('@\u{ff20}repl : local user notified', async () => {
    await page.goto(replUrl + '/?debug=USER&tag=charlie');
    await page.waitForLoadState('networkidle');
    await page.locator('.settings .notification').click();
    await page.locator('.tabs a', { hasText: 'all' }).first().click();
    const ref = page.locator('.ref-list .link:not(.remote)', { hasText: 'Ref from other' }).locator('..').locator('..').locator('..');
    await expect(ref.locator('.user.tag', { hasText: 'bob' }).first()).toBeVisible();
  });

  test('@\u{ff20}main : check ref was pulled', async () => {
    await page.goto('/?debug=USER&tag=alice');
    await page.waitForLoadState('networkidle');
    await page.locator('.settings .notification').click();
    await page.locator('.tabs a', { hasText: 'all' }).first().click();
    const ref = page.locator('.ref-list .link.remote', { hasText: 'Ref from other' }).locator('..').locator('..').locator('..');
    await expect(ref.locator('.user.tag', { hasText: 'bob' }).first()).toBeVisible();
  });

  test('@\u{ff20}main : reply to remote message', async () => {
    await page.goto('/?debug=USER&tag=alice');
    await page.waitForLoadState('networkidle');
    await page.locator('.settings .inbox').click();
    await page.locator('.tabs a', { hasText: 'all' }).first().click();
    const ref = page.locator('.ref-list .link.remote', { hasText: 'Ref from other' }).locator('..').locator('..').locator('..');
    await ref.locator('.actions a', { hasText: 'permalink'}).first().click();
    await page.locator('.comment-reply textarea').pressSequentially('Doing well, thanks!', { delay: 100 });
    await page.locator('.comment-reply textarea').blur();
    await page.locator('.comment-reply button', { hasText: 'reply' }).click();
    await page.waitForTimeout(3000);
  });

  test('@\u{ff20}repl : check reply was pulled', async () => {
    await page.goto(replUrl + '/?debug=ADMIN&tag=bob');
    await page.waitForLoadState('networkidle');
    await page.locator('.settings .notification').click();
    await page.locator('.tabs a', { hasText: 'all' }).first().click();
    const ref = page.locator('.ref-list .link.remote', { hasText: 'Doing well, thanks!' }).locator('..').locator('..').locator('..');
    await expect(ref.locator('.user.tag', { hasText: 'alice' }).first()).toBeVisible();
  });

  test('@\u{ff20}repl : check inbox was converted to outbox', async () => {
    await page.goto(replUrl + '/?debug=ADMIN&tag=charlie');
    await page.waitForLoadState('networkidle');
    await page.locator('.settings .notification').click();
    await page.locator('.tabs a', { hasText: 'all' }).first().click();
    const ref = page.locator('.ref-list .link.remote', { hasText: 'Doing well, thanks!' }).locator('..').locator('..').locator('..');
    await expect(ref.locator('.user.tag', { hasText: 'alice' }).first()).toBeVisible();
  });

  test('@\u{ff20}main : delete remote \u{ff20}repl', async () => {
    await page.goto('/?debug=ADMIN');
    await page.locator('.settings a', { hasText: 'settings' }).click();
    await page.locator('.tabs a', { hasText: 'origin' }).first().click();
    await openSidebar(page);
    await page.locator('input[type=search]').pressSequentially(replApi, { delay: 100 });
    await page.locator('input[type=search]').press('Enter');
    const repl = page.locator('.link:not(.remote)', { hasText: '@repl' }).locator('..').locator('..').locator('..');
    await repl.locator('.actions .fake-link', { hasText: 'delete' }).first().click();
    await repl.locator('.actions .fake-link', { hasText: 'yes' }).first().click();
  });

  test('@\u{ff20}repl : delete remote \u{ff20}main', async () => {
    await page.goto(replUrl + '/?debug=ADMIN');
    await page.locator('.settings a', { hasText: 'settings' }).click();
    await page.locator('.tabs a', { hasText: 'origin' }).first().click();
    await openSidebar(page);
    await page.locator('input[type=search]').pressSequentially(mainApi, { delay: 100 });
    await page.locator('input[type=search]').press('Enter');
    const main = page.locator('.link:not(.remote)', { hasText: '@main' }).locator('..').locator('..').locator('..');
    await main.locator('.actions .fake-link', { hasText: 'delete' }).first().click();
    await main.locator('.actions .fake-link', { hasText: 'yes' }).first().click();
  });
});
