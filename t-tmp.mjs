import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: +(process.env.W||1280), height: 720 } });
p.on('console', m => { if (m.type()==='error') console.log('ERR', m.text().slice(0,200)); });
const urls = process.argv.slice(2);
for (const u of urls) {
  if (u.startsWith('click:')) { await p.locator(u.slice(6)).first().click(); await p.waitForTimeout(1500); }
  else await p.goto('http://localhost:4200' + u, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1000);
  console.log(u, 'url=', p.url(), 'checkbox=', await p.locator('.show-remotes').count(), 'visible=', await p.locator('.show-remotes').isVisible(), JSON.stringify(await p.locator('.show-remotes').boundingBox().catch(()=>null)), 'sidebar=', await p.locator('app-sidebar').count(), 'expanded=', await p.locator('app-sidebar.expanded').count());
}
await b.close();
