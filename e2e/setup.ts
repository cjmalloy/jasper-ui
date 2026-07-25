import { expect, type Page } from '@playwright/test';
import { Client, type IMessage } from '@stomp/stompjs';
import { createHmac } from 'node:crypto';

const debugSecret = Buffer.from(
  'MjY0ZWY2ZTZhYmJhMTkyMmE5MTAxMTg3Zjc2ZDlmZWUwYjk0MDgzODA0MDJiOTgyNTk4MmNjYmQ4Yjg3MmVhYjk0MmE0OGFmNzE2YTQ5ZjliMTEyN2NlMWQ4MjA5OTczYjU2NzAxYTc4YThkMzYxNzdmOTk5MTIxODZhMTkwMDM=',
  'base64',
);
const encodeJwt = (value: string | Buffer) => Buffer.from(value).toString('base64url');
const jwtBody = [
  encodeJwt(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
  encodeJwt(JSON.stringify({ verified_email: true, sub: 'debug', auth: 'ROLE_ADMIN' })),
].join('.');
const adminHeaders = {
  jwt: `${jwtBody}.${createHmac('sha256', debugSecret).update(jwtBody).digest('base64url')}`,
};

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
  const message = new Promise<IMessage>(resolve => resolveMessage = resolve);
  const client = new Client({
    brokerURL: broker.toString(),
    connectHeaders: adminHeaders,
    reconnectDelay: 0,
  });

  return new Promise((resolve, reject) => {
    client.onWebSocketError = event => reject(new Error(`WebSocket connection failed: ${event.type}`));
    client.onStompError = frame => reject(new Error(frame.body || frame.headers['message']));
    client.onConnect = () => {
      client.subscribe(destination, resolveMessage, adminHeaders);
      resolve({
        message,
        close: () => client.deactivate(),
      });
    };
    client.activate();
  });
}

export async function clearMods(page: Page, base = '') {
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
  page.once('dialog', dialog => dialog.accept(targetLabel));
  const deletePromise = page.waitForResponse(resp => (
    resp.url().includes('/api/v1/origin') && resp.request().method() === 'DELETE' && resp.ok()
  ));
  await page.locator('button', { hasText: '– delete' }).click();
  await deletePromise;
  await page.reload();
  return true;
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
  await clearMods(page, base);
  await page.goto(base + '/?debug=ADMIN', { waitUntil: 'networkidle' });
  await page.locator('.settings a', { hasText: 'settings' }).click();
  await page.locator('.tabs a', { hasText: 'setup' }).first().click();
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
