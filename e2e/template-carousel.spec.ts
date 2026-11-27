import { type APIRequestContext, expect } from '@playwright/test';
import { adminHeaders, localOrigin, mod, test } from './setup';

test.describe.serial('Carousel Template', () => {
  const tag = 'carousel' + Date.now();
  const count = 12;
  const api = (process.env.MAIN_API || 'http://localhost:8081') + '/api/v1';

  async function headers(request: APIRequestContext) {
    await request.get(`${api}/plugin/page`);
    const { cookies } = await request.storageState();
    const xsrf = cookies.find(c => c.name === 'XSRF-TOKEN')?.value || '';
    return { Authorization: 'Bearer ' + adminHeaders.jwt, 'X-XSRF-TOKEN': xsrf };
  }

  test('enable carousel mod', async ({ page }) => {
    await mod(page, '#mod-carousel', '#mod-images', '[id="mod-plugin/embed"]');
  });

  test('create refs', async ({ request }) => {
    const start = Date.now() - 60 * 60 * 1000;
    for (let i = 0; i < count; i++) {
      const res = await request.post(`${api}/ref`, {
        headers: await headers(request),
        data: {
          url: `comment:${tag}/${i}`,
          title: `Slide ${i}`,
          comment: `Slide body ${i}`,
          tags: ['public', tag],
          published: new Date(start + i * 60 * 1000).toISOString(),
          origin: localOrigin(),
        },
      });
      expect(res.ok(), await res.text()).toBeTruthy();
    }
  });

  test('streams slides as you scroll', async ({ page }) => {
    await page.goto(`/tag/${tag}?debug=USER&pageSize=5&sort=published,ASC`, { waitUntil: 'networkidle' });
    await page.locator('.tabs a', { hasText: 'carousel' }).first().click();
    const slides = page.locator('.carousel-slide');
    const slide = (i: number) => page.locator(`.carousel-slide[aria-label="Slide ${i}"]`);
    const active = page.locator('.carousel-slide.active');
    await expect(active).toHaveAttribute('aria-label', 'Slide 0');
    await expect(active.locator('.carousel-media')).toContainText('Slide body 0');
    await expect(page.locator('.page-controls')).toHaveCount(0);
    await expect(slides).toHaveCount(count);
    await expect(slide(1)).toHaveCSS('opacity', /^0\.[45]/);
    // The last slide wraps around to the left of the first
    await expect(slide(count - 1)).toHaveCSS('opacity', /^0\.[45]/);
    expect((await slide(count - 1).boundingBox())!.x).toBeLessThan((await slide(0).boundingBox())!.x);

    await slide(1).click();
    await expect(active).toHaveAttribute('aria-label', 'Slide 1');

    await page.locator('.carousel-frame').focus();
    for (let i = 2; i < count; i++) {
      await page.keyboard.press('ArrowRight');
      await expect(active).toHaveAttribute('aria-label', `Slide ${i}`);
    }
    await expect(slide(5).locator('.carousel-media')).toBeEmpty();
    await expect(slide(count - 1).locator('.carousel-media')).toContainText(`Slide body ${count - 1}`);
    await page.keyboard.press('ArrowRight');
    await expect(active).toHaveAttribute('aria-label', 'Slide 0');
    await page.keyboard.press('ArrowLeft');
    await expect(active).toHaveAttribute('aria-label', `Slide ${count - 1}`);

    await page.keyboard.press('Home');
    await expect(active).toHaveAttribute('aria-label', 'Slide 0');
    await expect(slide(6).locator('.carousel-media')).toBeEmpty();
    await page.keyboard.press('End');
    await expect(active).toHaveAttribute('aria-label', `Slide ${count - 1}`);
  });

  test('does not overlap the sidebar', async ({ page }) => {
    await page.goto(`/tag/${tag}?debug=USER&pageSize=5&sort=published,ASC&view=carousel`, { waitUntil: 'networkidle' });
    const frame = await page.locator('.carousel-frame').boundingBox();
    const sidebar = await page.locator('.sidebar').boundingBox();
    expect(frame!.x + frame!.width).toBeLessThanOrEqual(sidebar!.x);
  });

  test('shows the card in the URL', async ({ page }) => {
    await page.goto(`/tag/${tag}?debug=USER&pageSize=5&pageNumber=7&sort=published,ASC&view=carousel`, { waitUntil: 'networkidle' });
    const active = page.locator('.carousel-slide.active');
    await expect(active).toHaveAttribute('aria-label', 'Slide 7');
    await expect(page.locator('.carousel-slide[aria-label="Slide 6"]')).toHaveCSS('opacity', /^0\.[45]/);
    const history = await page.evaluate(() => history.length);
    await page.locator('.carousel-frame').focus();
    await page.keyboard.press('ArrowRight');
    await expect(active).toHaveAttribute('aria-label', 'Slide 8');
    await expect(page).toHaveURL(/[?&]pageNumber=8(&|$)/);
    await expect(page).toHaveURL(/[?&]pageSize=1(&|$)/);
    expect(await page.evaluate(() => history.length)).toBe(history);
    await page.keyboard.press('Home');
    await expect(page).not.toHaveURL(/pageNumber/);

    await page.goto(`/tag/${tag}?debug=USER&pageSize=1&pageNumber=10&sort=published,ASC&view=carousel`, { waitUntil: 'networkidle' });
    await expect(active).toHaveAttribute('aria-label', 'Slide 10');
    await expect(page.locator('.carousel-slide[aria-label="Slide 0"]')).toHaveCount(1);
    // Past the end shows the last card
    await page.goto(`/tag/${tag}?debug=USER&pageSize=1&pageNumber=99&sort=published,ASC&view=carousel`, { waitUntil: 'networkidle' });
    await expect(active).toHaveAttribute('aria-label', `Slide ${count - 1}`);
    await expect(page).toHaveURL(new RegExp(`[?&]pageNumber=${count - 1}(&|$)`));
  });

  test('embeds as a lens', async ({ page, request }) => {
    const res = await request.post(`${api}/ref`, {
      headers: await headers(request),
      data: {
        url: `comment:${tag}/embed`,
        title: 'Embedded Carousel',
        comment: `![](/tag/${tag}?view=carousel&pageSize=5&sort=published,ASC)`,
        tags: ['public'],
        origin: localOrigin(),
      },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    await page.goto(`/ref/e/${encodeURIComponent(`comment:${tag}/embed`)}?debug=USER`, { waitUntil: 'networkidle' });
    const carousel = page.locator('.full-page.ref .carousel-frame');
    const active = carousel.locator('.carousel-slide.active');
    await expect(active).toHaveAttribute('aria-label', 'Slide 0');
    await expect(active.locator('.md-container')).toHaveCSS('border-top-width', '0px');
    await carousel.locator('.carousel-slide[aria-label="Slide 1"]').click();
    await expect(active).toHaveAttribute('aria-label', 'Slide 1');
    // Only the carousel of the page shows its card in the URL
    await page.waitForTimeout(500);
    expect(page.url()).not.toContain('pageNumber');
  });

  test('sizes slides to their media', async ({ page, request }) => {
    const shapes = tag + '/shapes';
    const svg = (w: number, h: number) => 'data:image/svg+xml,' + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="teal"/></svg>`);
    const start = Date.now() - 60 * 60 * 1000;
    for (const [i, [title, w, h]] of ([['Wide', 400, 100], ['Tall', 100, 400], ['Text', 0, 0]] as const).entries()) {
      const res = await request.post(`${api}/ref`, {
        headers: await headers(request),
        data: {
          url: `comment:${shapes}/${i}`,
          title,
          ...(w ? { tags: ['public', shapes, 'plugin/image'], plugins: { 'plugin/image': { url: svg(w, h) } } }
            : { tags: ['public', shapes], comment: 'Some text' }),
          published: new Date(start + i * 60 * 1000).toISOString(),
          origin: localOrigin(),
        },
      });
      expect(res.ok(), await res.text()).toBeTruthy();
    }
    await page.goto(`/tag/${shapes}?debug=USER&sort=published,ASC&view=carousel`, { waitUntil: 'networkidle' });
    const slide = (title: string) => page.locator(`.carousel-slide[aria-label="${title}"]`);
    const image = slide('Wide').locator('.image-expand');
    await expect(image).not.toHaveClass(/loading/);
    await expect(slide('Wide')).toHaveClass(/sized/);
    await expect(slide('Tall')).toHaveClass(/sized/);
    await expect(slide('Text')).not.toHaveClass(/sized/);
    await expect(slide('Wide').locator('.carousel-media')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');

    const box = (await image.boundingBox())!;
    expect(box.width / box.height).toBeCloseTo(4, 1);
    const wide = (await slide('Wide').boundingBox())!.width;
    const tall = (await slide('Tall').boundingBox())!.width;
    const text = (await slide('Text').boundingBox())!.width;
    expect(wide).toBeGreaterThan(text);
    expect(tall).toBeLessThan(text);
    // The tall image fills the height of its slide
    await slide('Tall').click();
    await expect(slide('Tall')).toHaveClass(/active/);
    const media = (await slide('Tall').locator('.carousel-media').boundingBox())!;
    const tallImage = (await slide('Tall').locator('.image-expand').boundingBox())!;
    expect(Math.abs(tallImage.height - media.height)).toBeLessThan(4);
    expect(tallImage.width / tallImage.height).toBeCloseTo(0.25, 1);
  });

  test('keeps the size an embed is resized to', async ({ page, request }) => {
    const resize = tag + '/resize';
    const url = `https://example.com/${resize}`;
    await page.route(url, route => route.fulfill({ contentType: 'text/html', body: '<p>Embedded page</p>' }));
    const res = await request.post(`${api}/ref`, {
      headers: await headers(request),
      data: { url, title: 'Embed', tags: ['public', resize, 'plugin/embed'], origin: localOrigin() },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    await page.goto(`/tag/${resize}?debug=USER&view=carousel`, { waitUntil: 'networkidle' });
    const slide = page.locator('.carousel-slide.active');
    const container = slide.locator('.embed-container');
    const iframe = container.locator('iframe');
    await expect(iframe).toHaveClass(/ready/);
    // The grip is drawn inside the slide, so it doesn't scroll the media
    const viewer = slide.locator('app-viewer');
    expect(await viewer.evaluate(v => v.scrollWidth - v.clientWidth)).toBe(0);
    // In the dark theme, the glow goes around the slide's media where it isn't clipped
    await page.evaluate(() => document.body.classList.add('dark-theme'));
    await expect(slide.locator('.carousel-media')).toHaveCSS('filter', /drop-shadow/);
    await expect(iframe).toHaveCSS('filter', 'none');
    await page.evaluate(() => document.body.classList.remove('dark-theme'));
    const before = (await container.boundingBox())!;
    await page.mouse.move(before.x + before.width - 3, before.y + before.height - 3);
    await page.mouse.down();
    await page.mouse.move(before.x + before.width - 103, before.y + before.height - 53, { steps: 5 });
    await page.mouse.up();
    await expect(container).toHaveClass(/\bresized\b/);
    // The slide recenters on the new size
    await expect.poll(async () => {
      const s = (await slide.boundingBox())!;
      const c = (await container.boundingBox())!;
      return Math.abs(Math.round(s.x + s.width / 2 - (c.x + c.width / 2)));
    }).toBe(0);
    // And glides back to the center of the track
    await expect.poll(() => slide.evaluate(s => {
      const t = s.parentElement!;
      return Math.abs(Math.round(s.getBoundingClientRect().left + s.offsetWidth / 2 - t.getBoundingClientRect().left - t.clientWidth / 2));
    })).toBeLessThanOrEqual(1);
    const after = (await container.boundingBox())!;
    expect(after.width).toBeCloseTo(before.width - 100, -1);
    expect(after.height).toBeLessThan(before.height - 50);
    expect((await slide.boundingBox())!.width).toBeCloseTo(after.width + 16, 0);
    // The frame fills the box the grip is drawn on
    const frame = (await iframe.boundingBox())!;
    expect(frame.width).toBeCloseTo(after.width, 0);
    expect(frame.height).toBeCloseTo(after.height, 0);
  });

  test('fits media in markdown and does not scroll vertically', async ({ page, request }) => {
    const md = tag + '/md';
    const svg = (w: number, h: number) => 'data:image/svg+xml,' + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="teal"/></svg>`);
    const start = Date.now() - 60 * 60 * 1000;
    for (const [i, [title, comment]] of ([['Big', `![](${svg(2000, 2000)})`], ['Wide', `![](${svg(1600, 900)})`], ['Wider', `![](${svg(1600, 900)})`]] as const).entries()) {
      const res = await request.post(`${api}/ref`, {
        headers: await headers(request),
        data: { url: `comment:${md}/${i}`, title, comment, tags: ['public', md], published: new Date(start + i * 60 * 1000).toISOString(), origin: localOrigin() },
      });
      expect(res.ok(), await res.text()).toBeTruthy();
    }
    await page.goto(`/tag/${md}?debug=USER&sort=published,ASC&view=carousel`, { waitUntil: 'networkidle' });
    const slide = page.locator('.carousel-slide[aria-label="Big"]');
    const image = slide.locator('.md .image-expand');
    await expect(image).not.toHaveClass(/loading/);
    const media = slide.locator('.carousel-media');
    await expect.poll(() => media.evaluate(m => {
      const v = m.firstElementChild!;
      return v.scrollHeight <= v.clientHeight && v.scrollWidth <= v.clientWidth;
    })).toBe(true);
    const box = (await image.boundingBox())!;
    const card = (await media.boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(card.width);
    expect(box.height).toBeLessThanOrEqual(card.height);
    // Markdown stays seamless in the dark theme
    await page.evaluate(() => document.body.classList.add('dark-theme'));
    await expect(media).toHaveCSS('filter', 'none');
    await expect(image).toHaveCSS('filter', 'none');
    await page.evaluate(() => document.body.classList.remove('dark-theme'));
    // Tilted neighbours reach past the track, but must not let it scroll
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.reload({ waitUntil: 'networkidle' });
    await expect(slide.locator('.md .image-expand')).not.toHaveClass(/loading/);
    const track = page.locator('.carousel-track');
    await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2);
    await page.mouse.wheel(0, 200);
    expect(await track.evaluate(t => t.scrollTop)).toBe(0);
    await expect(track).toHaveCSS('overflow-y', 'hidden');
  });

  test('centers a narrow slide at the end', async ({ page, request }) => {
    const narrow = tag + '/narrow';
    const svg = 'data:image/svg+xml,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="400"><rect width="100" height="400" fill="teal"/></svg>');
    const res = await request.post(`${api}/ref`, {
      headers: await headers(request),
      data: { url: `comment:${narrow}`, title: 'Narrow', tags: ['public', narrow, 'plugin/image'], plugins: { 'plugin/image': { url: svg } }, origin: localOrigin() },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    await page.goto(`/tag/${narrow}?debug=USER&view=carousel`, { waitUntil: 'networkidle' });
    const slide = page.locator('.carousel-slide[aria-label="Narrow"]');
    await expect(slide).toHaveClass(/sized/);
    const frame = (await page.locator('.carousel-frame').boundingBox())!;
    await expect.poll(async () => {
      const b = (await slide.boundingBox())!;
      return Math.abs(Math.round(b.x + b.width / 2 - (frame.x + frame.width / 2)));
    }).toBe(0);
    await expect(slide).toHaveCSS('opacity', '1');
  });

  test('shows the title of bookmarks without media', async ({ page, request }) => {
    const bookmark = tag + '/bookmark';
    const url = `https://example.com/${bookmark}`;
    const res = await request.post(`${api}/ref`, {
      headers: await headers(request),
      data: { url, title: 'Plain Bookmark', tags: ['public', bookmark], origin: localOrigin() },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    await page.goto(`/tag/${bookmark}?debug=USER&view=carousel`, { waitUntil: 'networkidle' });
    const title = page.locator('.carousel-slide.active .carousel-title');
    await expect(title).toBeVisible();
    await expect(title).toHaveText('Plain Bookmark');
    await expect(title).toHaveAttribute('href', url);
    await page.goto(`/tag/${tag}?debug=USER&pageSize=5&sort=published,ASC&view=carousel`, { waitUntil: 'networkidle' });
    await expect(page.locator('.carousel-slide.active .carousel-title')).toBeHidden();
  });

  test('retries a failed page', async ({ page }) => {
    let fail = true;
    await page.route(/\/api\/v1\/ref\/page\?(.*&)?page=[1-9]/, route => fail ? route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }) : route.fallback());
    await page.goto(`/tag/${tag}?debug=USER&pageSize=5&sort=published,ASC&view=carousel`, { waitUntil: 'networkidle' });
    const error = page.locator('.carousel-error');
    await expect(error).toContainText('Error loading more results.');
    fail = false;
    await error.locator('button', { hasText: 'Retry' }).click();
    await expect(error).toHaveCount(0);
    await expect.poll(() => page.locator('.carousel-slide').count()).toBeGreaterThan(5);
  });
});
