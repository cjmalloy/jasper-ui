import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: +(process.env.W||1280), height: 720 } });
await p.goto('http://localhost:4200/settings/plugin?debug=ADMIN', { waitUntil: 'networkidle' });
await p.screenshot({ path: '/tmp/rep/a.png' });
await p.locator('app-sidebar .toggle').click(); await p.waitForTimeout(800);
await p.screenshot({ path: '/tmp/rep/b.png' });
await p.locator('app-sidebar .toggle').click(); await p.waitForTimeout(800);
await b.close();
