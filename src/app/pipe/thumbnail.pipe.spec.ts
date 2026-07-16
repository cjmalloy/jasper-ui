/// <reference types="vitest/globals" />
import { firstValueFrom, of } from 'rxjs';
import { ThumbnailPipe } from './thumbnail.pipe';

describe('ThumbnailPipe', () => {
  const externalUrl = 'https://example.com/thumbnail.png';
  const inlineSvg = 'data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22/%3E';
  let admin: any;
  let store: any;
  let proxy: any;
  let pipe: ThumbnailPipe;

  beforeEach(() => {
    admin = {
      getPlugin: vi.fn(),
      getEmbeds: vi.fn().mockReturnValue([]),
    };
    store = {
      get: vi.fn().mockReturnValue(of(undefined)),
    };
    proxy = {
      getFetch: vi.fn((url: string) => `proxy:${url}`),
    };
    pipe = new ThumbnailPipe(admin, store, proxy);
  });

  it('does not resolve image thumbnails without the image plugin', async () => {
    const ref = {
      url: externalUrl,
      origin: '',
      tags: ['plugin/thumbnail', 'plugin/image', 'plugin/embed'],
      plugins: {
        'plugin/thumbnail': { url: externalUrl },
        'plugin/image': { url: externalUrl },
      },
    };

    await expect(firstValueFrom(pipe.transform([ref], true))).resolves.toBe('');
    expect(store.get).not.toHaveBeenCalled();
    expect(proxy.getFetch).not.toHaveBeenCalled();
  });

  it('resolves inline SVG thumbnail URLs without the image plugin', async () => {
    const ref = {
      url: 'comment:test',
      origin: '',
      tags: ['plugin/thumbnail'],
      plugins: { 'plugin/thumbnail': { url: inlineSvg } },
    };

    await expect(firstValueFrom(pipe.transform([ref]))).resolves.toBe(inlineSvg);
  });

  it('does not resolve inline raster image URLs without the image plugin', async () => {
    const ref = {
      url: 'comment:test',
      origin: '',
      tags: ['plugin/thumbnail'],
      plugins: { 'plugin/thumbnail': { url: 'data:image/png;base64,AAAA' } },
    };

    await expect(firstValueFrom(pipe.transform([ref]))).resolves.toBe('');
  });

  it('keeps resolving image thumbnails when the image plugin is installed', async () => {
    admin.getPlugin.mockImplementation((plugin: string) => plugin === 'plugin/image' ? {} : undefined);
    const ref = {
      url: externalUrl,
      origin: '',
      tags: ['plugin/thumbnail'],
      plugins: { 'plugin/thumbnail': { url: externalUrl } },
    };

    await expect(firstValueFrom(pipe.transform([ref]))).resolves.toBe(externalUrl);
  });
});
