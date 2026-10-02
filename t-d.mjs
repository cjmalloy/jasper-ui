import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
for (let k = 0; k < 6; k++) {
await p.goto('http://localhost:4200/settings/' + (k%2 ? 'template' : 'plugin') + '?debug=ADMIN', { waitUntil: 'networkidle' });
const r = [];
for (let i = 0; i < 8; i++) { r.push(await p.evaluate(() => [!!document.querySelector('app-sidebar.expanded'), !!document.querySelector('.show-remotes')].map(Number).join(''))); await p.waitForTimeout(250); }
console.log(k, r.join(' '));
}
await b.close();
