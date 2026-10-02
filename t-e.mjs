import { chromium } from '@playwright/test';
const b = await chromium.launch();
for (const w of [1280, 900, 600]) {
const p = await b.newPage({ viewport: { width: w, height: 720 } });
await p.goto('http://localhost:4200/settings/plugin?debug=ADMIN', { waitUntil: 'networkidle' });
await p.waitForTimeout(1000);
if (await p.locator('app-sidebar.expanded').count()) { await p.locator('app-sidebar .toggle').click(); await p.waitForTimeout(1000); }
const s = p.locator('app-sidebar app-search');
console.log(w, await p.locator('app-sidebar.expanded').count(), await s.isVisible(), JSON.stringify(await s.boundingBox()), JSON.stringify(await p.locator('app-sidebar').boundingBox()));
await p.close();
}
await b.close();
