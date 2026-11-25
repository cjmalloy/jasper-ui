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
    await mod(page, '#mod-carousel');
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
});
