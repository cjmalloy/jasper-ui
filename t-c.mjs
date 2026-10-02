import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const t0 = Date.now();
await p.goto('http://localhost:4200' + process.argv[2], { waitUntil: 'commit' });
for (let i = 0; i < 40; i++) {
  const r = await p.evaluate(() => [!!document.querySelector('app-sidebar'), !!document.querySelector('app-sidebar.expanded'), !!document.querySelector('app-sidebar .wide app-search:not(.centered)'), !!document.querySelector('.show-remotes')]);
  console.log(Date.now() - t0, JSON.stringify(r));
  await p.waitForTimeout(150);
}
await b.close();
