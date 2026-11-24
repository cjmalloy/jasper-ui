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
    await expect(slides.first()).toBeVisible();
    await expect(page.locator('.carousel-slide.active .carousel-caption .link a')).toHaveText('Slide 0');
    await expect(page.locator('.carousel-prev')).toBeDisabled();
    await expect(page.locator('.page-controls')).toHaveCount(0);

    const caption = page.locator('.carousel-slide.active .carousel-caption');
    await expect(caption).toBeHidden();
    await page.locator('.carousel-slide.active .carousel-media').hover();
    await expect(caption).toBeVisible();
    await expect(slides.nth(1)).toHaveCSS('opacity', /^0\.[45]/);

    await page.locator('.carousel-next').click();
    await expect(page.locator('.carousel-slide.active .carousel-caption .link a')).toHaveText('Slide 1');
    await expect(slides).toHaveCount(10);

    await page.locator('.carousel-frame').focus();
    for (let i = 2; i < count; i++) {
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('.carousel-slide.active .carousel-caption .link a')).toHaveText(`Slide ${i}`);
    }
    await expect(slides).toHaveCount(count);
    await expect(page.locator('.carousel-next')).toBeDisabled();
    await expect(slides.first().locator('.carousel-caption')).toBeEmpty();
    await expect(slides.last().locator('.carousel-media')).toContainText(`Slide body ${count - 1}`);

    await page.keyboard.press('Home');
    await expect(page.locator('.carousel-slide.active .carousel-caption .link a')).toHaveText('Slide 0');
    await expect(slides.last().locator('.carousel-caption')).toBeEmpty();
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
    await expect(carousel.locator('.carousel-slide.active .carousel-caption .link a')).toHaveText('Slide 0');
    await carousel.locator('.carousel-next').click();
    await expect(carousel.locator('.carousel-slide.active .carousel-caption .link a')).toHaveText('Slide 1');
  });
});
