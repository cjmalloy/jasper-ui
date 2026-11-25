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
      return Math.round(s.x + s.width / 2 - (c.x + c.width / 2));
    }).toBe(0);
    const after = (await container.boundingBox())!;
    expect(after.width).toBeCloseTo(before.width - 100, -1);
    expect(after.height).toBeLessThan(before.height - 50);
    expect((await slide.boundingBox())!.width).toBeCloseTo(after.width + 16, 0);
    // The frame fills the box the grip is drawn on
    const frame = (await iframe.boundingBox())!;
    expect(frame.width).toBeCloseTo(after.width, 0);
    expect(frame.height).toBeCloseTo(after.height, 0);
  });
});
