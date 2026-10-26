import { test as base, type BrowserContext, type ConsoleMessage, expect, type Page, type WebError } from '@playwright/test';
import { Client, type IMessage } from '@stomp/stompjs';
import { createHmac } from 'node:crypto';
import { basename } from 'node:path';

const debugSecret = Buffer.from(
  'MjY0ZWY2ZTZhYmJhMTkyMmE5MTAxMTg3Zjc2ZDlmZWUwYjk0MDgzODA0MDJiOTgyNTk4MmNjYmQ4Yjg3MmVhYjk0MmE0OGFmNzE2YTQ5ZjliMTEyN2NlMWQ4MjA5OTczYjU2NzAxYTc4YThkMzYxNzdmOTk5MTIxODZhMTkwMDM=',
  'base64',
);
const encodeJwt = (value: string | Buffer) => Buffer.from(value).toString('base64url');
const jwtBody = [
  encodeJwt(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
  encodeJwt(JSON.stringify({ verified_email: true, sub: 'debug', auth: 'ROLE_ADMIN' })),
].join('.');
export const adminHeaders = {
  jwt: `${jwtBody}.${createHmac('sha256', debugSecret).update(jwtBody).digest('base64url')}`,
};

/**
 * Console errors that are expected noise from the backend rather than app bugs.
 * Keep this list short, and document why each entry is expected.
 * Never add Angular errors (NG0100, NG0600, ...) here: fix them instead.
 */
const allowedConsoleErrors: RegExp[] = [
  // Chrome logs every 4xx/5xx response as a console error, e.g. the 404 for a user without a User entity
  // on startup. Tests assert on API results and UI state directly.
  /^Failed to load resource: the server responded with a status of \d+/,
];

const runId = process.env.PW_RUN_ID ||= Date.now().toString(36);
const moddedOrigins = new Set<string>();
const replHosts = [process.env.REPL_URL || 'http://localhost:8082', process.env.REPL_API || 'http://localhost:8083']
  .map(url => new URL(url).host);

/**
 * Specs that need the server's cron, user run or websocket pull watchers. The server only registers those
 * for origins listed explicitly in its script selectors (wildcards don't start watchers), so these specs
 * use fixed origins that are listed in e2e/docker-compose.yaml. They must clear them with
 * {@link clearFixedOrigins} in case the stack was used by an earlier run.
 */
const fixedOriginSpecs = ['pluginoriginaliases', 'pluginoriginpull', 'pluginoriginpush', 'pluginoutbox'];

/**
 * Origin that isolates the current spec file from every other spec file on the main server.
 * Sent as the `Local-Origin` header, so the server treats it as the local origin for every request.
 * Retries get a new origin so they start from a clean state.
 * Specs never use the default origin, so any number of workers can share the servers.
 */
export function isolatedOrigin(info = test.info()) {
  const slug = basename(info.file).replace(/(\.spec)?\.ts$/, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  // Single level: the server only runs scripts in origins one level below the local origin
  if (fixedOriginSpecs.includes(slug)) return `@${slug}r${info.retry}`;
  return `@${slug}r${info.retry}t${runId}`;
}

/**
 * Local origin of the main server for the current test.
 */
export function localOrigin() {
  return isolatedOrigin();
}

/**
 * Local origin of the replica server for the current test: a sub origin of the replica's `@repl`.
 */
export function replOrigin() {
  return '@repl.' + isolatedOrigin().substring(1);
}

async function isolate(ctx: BrowserContext) {
  // The replica only accepts sub origins of @repl. Chromium sends the context's extra headers
  // on websocket upgrades too, but routes can't change those, so replica websockets fall back to @repl.
  await ctx.route(url => replHosts.includes(url.host), route => route.continue({
    headers: { ...route.request().headers(), 'local-origin': replOrigin() },
  }));
}

/**
 * Playwright `test` that fails when any page logs a `console.error` or throws an uncaught exception.
 * Every spec must import `test` from here instead of from '@playwright/test'.
 * Covers the test's own `page`/`context`, pages shared across tests (created in `beforeAll`) and
 * contexts created during the test.
 */
export const test = base.extend<{ failOnConsoleErrors: void, origin: string, replOrigin: string }, { isolateContexts: void }>({
  /**
   * Run each spec file in its own origin on both servers.
   */
  isolateContexts: [async ({ browser }, use) => {
    // Covers contexts and pages created in beforeAll. Chromium also sends extra headers on the
    // websocket upgrade, so STOMP subscriptions use the same origin.
    const newContext = browser.newContext;
    browser.newContext = async (options = {}) => {
      const ctx = await newContext.call(browser, {
        ...options,
        extraHTTPHeaders: { 'Local-Origin': isolatedOrigin(), ...options.extraHTTPHeaders },
      });
      await isolate(ctx);
      return ctx;
    };
    try {
      await use();
    } finally {
      browser.newContext = newContext;
    }
  }, { scope: 'worker', auto: true }],
  extraHTTPHeaders: async ({ extraHTTPHeaders }, use) => {
    await use({ 'Local-Origin': isolatedOrigin(), ...extraHTTPHeaders });
  },
  origin: async ({}, use) => {
    await use(isolatedOrigin());
  },
  replOrigin: async ({}, use) => {
    await use(replOrigin());
  },
  failOnConsoleErrors: [async ({ browser, context }, use) => {
    const errors: string[] = [];
    const onConsole = (msg: ConsoleMessage) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      if (allowedConsoleErrors.some(r => r.test(text))) return;
      errors.push(`console.error: ${text} (${msg.location().url})`);
    };
    const onWebError = (e: WebError) => errors.push(`pageerror: ${e.error().stack || e.error().message}`);
    const tracked = new Set<BrowserContext>();
    const track = (ctx: BrowserContext) => {
      if (tracked.has(ctx)) return;
      tracked.add(ctx);
      ctx.on('console', onConsole);
      ctx.on('weberror', onWebError);
    };
    [context, ...browser.contexts()].forEach(track);
    const newContext = browser.newContext;
    browser.newContext = async (...args) => {
      const ctx = await newContext.apply(browser, args);
      track(ctx);
      return ctx;
    };
    try {
      await use();
    } finally {
      browser.newContext = newContext;
      for (const ctx of tracked) {
        ctx.off('console', onConsole);
        ctx.off('weberror', onWebError);
      }
    }
    expect(errors, 'console errors and uncaught page errors').toEqual([]);
  }, { auto: true }],
});

export interface StompEventSubscription {
  message: Promise<IMessage>;
  close: () => Promise<void>;
}

export function subscribeMain(destination: string) {
  return subscribeStomp(process.env.MAIN_API || 'http://localhost:8081', destination);
}

export function subscribeRepl(destination: string) {
  return subscribeStomp(process.env.REPL_API || 'http://localhost:8083', destination);
}

async function subscribeStomp(api: string, destination: string): Promise<StompEventSubscription> {
  const broker = new URL('/api/stomp/websocket', api);
  broker.protocol = broker.protocol === 'https:' ? 'wss:' : 'ws:';

  let resolveMessage!: (message: IMessage) => void;
  let rejectMessage!: (error: Error) => void;
  const message = new Promise<IMessage>((resolve, reject) => {
    resolveMessage = resolve;
    rejectMessage = reject;
  });
  const client = new Client({
    brokerURL: broker.toString(),
    connectHeaders: adminHeaders,
    reconnectDelay: 0,
  });

  return new Promise((resolve, reject) => {
    let ready = false;
    const fail = (error: Error) => ready ? rejectMessage(error) : reject(error);
    client.onWebSocketError = event => fail(new Error(`WebSocket connection failed: ${event.type}`));
    client.onStompError = frame => fail(new Error(frame.body || frame.headers['message']));
    client.onConnect = () => {
      client.subscribe(destination, resolveMessage, adminHeaders);
      setTimeout(() => {
        ready = true;
        resolve({
          message,
          close: () => client.deactivate(),
        });
      }, 250);
    };
    client.activate();
  });
}

export async function clearMods(page: Page, base = '') {
  await expect(async () => {
    await page.goto(base + '/settings/setup?debug=ADMIN', { waitUntil: 'networkidle' });
    const selectAll = page.locator('button', { hasText: 'Select All' });
    const selectNone = page.locator('button', { hasText: 'Select None' });
    if (await selectNone.isVisible()) {
      await selectNone.click();
    } else {
      await selectAll.click();
      await selectNone.click();
    }
    await page.locator('button', { hasText: 'Save' }).click();
    await page.locator('.log div', { hasText: 'Success.' }).first().waitFor({ timeout: 15_000, state: 'attached' });
    await page.goto(base + '/settings/setup?debug=ADMIN', { waitUntil: 'networkidle' });
    await expect(page.locator('.mod-row input[type=checkbox]:checked')).toHaveCount(0, { timeout: 5_000 });
  }).toPass({ timeout: 90_000 });
}

/**
 * Clears the requested origin through the backup UI.
 * Returns true after the delete request completes, or false when a non-default origin is not present.
 */
export async function clearOrigin(page: Page, base = '', origin = '') {
  const originsPromise = page.waitForResponse(resp => (
    resp.url().includes('/api/v1/origin') && resp.request().method() === 'GET' && resp.ok()
  )).then(resp => resp.json() as Promise<string[]>);
  await page.goto(base + `/settings/backup?debug=ADMIN&origin=${encodeURIComponent(origin)}`, { waitUntil: 'networkidle' });
  const backupOrigins = await originsPromise;
  if (origin && !backupOrigins.includes(origin)) return false;
  const select = page.locator('form select');
  const targetValue = origin;
  const targetLabel = origin || 'default';
  // Match the exact option value or displayed text so @repl does not match @repl.main.
  const hasExactOrigin = await select.locator('option').evaluateAll((optionElements, target) => (
    optionElements.some(option => (
      option.getAttribute('value') === target.value ||
      option.textContent?.trim() === target.label
    ))
  ), { value: targetValue, label: targetLabel });
  if (!hasExactOrigin) return false;
  await select.selectOption(targetValue);
  const deletePromise = page.waitForResponse(resp => (
    resp.url().includes('/api/v1/origin') && resp.request().method() === 'DELETE' && resp.ok()
  ));
  await page.locator('button.delete-origin').click();
  await page.locator('.delete-confirm input.delete-confirmation').fill(targetLabel);
  await page.locator('.delete-confirm button.confirm-delete').click();
  await deletePromise;
  await page.reload();
  return true;
}

/**
 * Clears the fixed origins of a spec (see {@link fixedOriginSpecs}) and their replicated sub origins on
 * both servers, in case an earlier run used the same stack.
 */
export async function clearFixedOrigins(page: Page) {
  const replUrl = process.env.REPL_URL || 'http://localhost:8082';
  for (const origin of [localOrigin() + '.repl', localOrigin()]) await clearOrigin(page, '', origin);
  for (const origin of [replOrigin() + '.main', replOrigin()]) await clearOrigin(page, replUrl, origin);
  moddedOrigins.clear();
}

export async function clearAll(page: Page, base = '', origin = '') {
  if (!await clearOrigin(page, base, origin)) return;
  await clearMods(page, base);
  await page.reload();
}

export async function deleteRef(page: Page, url: string, base = '') {
  await page.goto(base + `/ref/e/${encodeURIComponent(url)}?debug=ADMIN`, { waitUntil: 'networkidle' });
  const deleteBtn = page.locator('.full-page.ref .actions .fake-link', { hasText: 'delete' });
  if (!(await deleteBtn.isVisible({ timeout: 10_000 }).catch(() => false))) return;
  const deletePromise = page.waitForResponse(resp => (
    resp.url().includes('/api/v1/ref') && resp.request().method() === 'DELETE' && resp.ok()
  ));
  await deleteBtn.first().click();
  await page.locator('.full-page.ref .actions .fake-link', { hasText: 'yes' }).first().click();
  await deletePromise;
}

/**
 * Wait for manual ref actions such as origin push/pull to confirm their user-run response.
 */
export function waitForUserActionResponse(page: Page) {
  return page.waitForResponse(resp => (
    resp.url().includes('/api/v1/tags/response') && resp.request().method() === 'PATCH' && resp.ok()
  ));
}

/**
 * Waits for the +plugin/cron tag update used to enable/disable origin sync.
 */
export function waitForCronToggleResponse(page: Page) {
  return page.waitForResponse(resp => {
    if (!resp.url().includes('/api/v1/tags') || resp.request().method() !== 'POST' || !resp.ok()) return false;
    return new URL(resp.url()).searchParams.get('tag') === '+plugin/cron';
  });
}

export async function mod(page: Page, ...mods: string[]) {
  await modRemote(page, '', ...mods);
}

export async function modRemote(page: Page, base = '', ...mods: string[]) {
  // A fresh isolated origin has no mods, so only clear when mods were already installed
  const origin = base + localOrigin();
  if (moddedOrigins.has(origin)) {
    // Leaves the page on the setup tab
    await clearMods(page, base);
  } else {
    await page.goto(base + '/settings/setup?debug=ADMIN', { waitUntil: 'networkidle' });
  }
  moddedOrigins.add(origin);
  if (mods.includes('#mod-experiments')) {
    await expect(page.locator('#mod-experiments')).toBeChecked({ checked: false });
    await page.locator('#mod-experiments').check();
    await page.locator('button', { hasText: 'Save' }).click();
    await page.locator('.log div', { hasText: 'Success.' }).first().waitFor({ timeout: 15_000, state: 'attached' });
    await page.goto(base + '/settings/setup?debug=ADMIN', { waitUntil: 'networkidle' });
  }
  for (const mod of mods) {
    if (mod === '#mod-experiments') continue;
    await expect(page.locator(mod)).toBeChecked({ checked: false });
    await page.locator(mod).check();
  }
  await page.locator('button', { hasText: 'Save' }).click();
  await page.locator('.log div', { hasText: 'Success.' }).first().waitFor({ timeout: 15_000, state: 'attached' });
  await page.goto(base + '/settings/setup?debug=ADMIN', { waitUntil: 'networkidle' });
  for (const mod of mods) {
    await expect(page.locator(mod)).toBeChecked();
  }
}

export async function openSidebar(page: Page) {
  await page.locator('.sidebar').waitFor();
  const sidebar = page.locator('.sidebar');
  if (!await sidebar.evaluate(el => el.classList.contains('expanded'))) {
    await sidebar.locator('.row .toggle').click();
  }
}

export async function openTextSubmit(page: Page, userTag: string) {
  await openSidebar(page);
  await page.locator('.sidebar .submit-button', { hasText: 'Submit' }).first().click();
  await page.locator('.tabs a', { hasText: 'text' }).first().click();
  // Defaults and user tag are added asynchronously; submitting before then drops all tags
  await expect(page.locator(`.tag-field input.preview[title="${userTag}"]`)).toBeAttached();
}

export async function closeSidebar(page: Page) {
  await page.locator('.sidebar').waitFor();
  const sidebar = page.locator('.sidebar');
  if (await sidebar.evaluate(el => el.classList.contains('expanded'))) {
    await sidebar.locator('.row .toggle').click();
  }
}

export async function upload(page: Page, file: string) {
  await page.goto('/?debug=USER', { waitUntil: 'networkidle' });
  await openSidebar(page);
  await page.locator('.sidebar .submit-button', { hasText: 'Submit' }).first().click();
  await page.locator('.tabs a', { hasText: 'upload' }).click();
  await expect(page.locator('button', { hasText: '+ cache' })).toBeVisible({ timeout: 10_000 });
  const fileInput = page.locator('input[type="file"]').nth(1);
  await fileInput.setInputFiles(file);
  await page.locator('.ref .actions .fake-link', { hasText: 'upload' }).click();
  await expect(page.locator('.full-page.ref .link a')).toContainText(
    file.substring(file.lastIndexOf('/') + 1),
    { timeout: 10_000 },
  );
  return page.url().replace('/ref/', '/ref/e/');
}

/**
 * Opens the app as the given user and marks the inbox read so later notifications start from a clean cursor.
 * Specs with fixed origins keep mail from previous runs.
 */
export async function markInboxRead(page: Page, url: string) {
  const notification = page.locator('.settings .notification');
  await expect(async () => {
    await page.goto(url, { waitUntil: 'networkidle' });
    if (await notification.isVisible()) {
      await notification.click();
      await page.locator('.tabs a', { hasText: 'all' }).first().click();
      await page.goto(url, { waitUntil: 'networkidle' });
    }
    await expect(notification).toBeHidden({ timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
}

export async function pollNotifications(page: Page, user = 'debug') {
  await pollRemoteNotifications(page, '', user);
}

export async function pollRemoteNotifications(page: Page, base = '', user = 'debug') {
  const path = base + `/?debug=ADMIN&tag=${user}`;
  await page.goto(path, { waitUntil: 'networkidle' });
  await expect.poll(async () => {
    await page.reload({ waitUntil: 'networkidle' });
    await page.goto(path, { waitUntil: 'networkidle' });
    return await page.locator('.settings .notification').isVisible();
  }, { timeout: 60_000 }).toBe(true);
}
