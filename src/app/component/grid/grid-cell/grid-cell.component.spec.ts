/// <reference types="vitest/globals" />
import { GridCellComponent } from './grid-cell.component';

describe('GridCellComponent', () => {
  const externalUrl = 'https://example.com/thumbnail.png';
  const inlineSvg = 'data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22/%3E';
  let admin: any;
  let proxy: any;
  let component: GridCellComponent;

  beforeEach(() => {
    admin = { getPlugin: vi.fn() };
    proxy = { getFetch: vi.fn() };
    component = new GridCellComponent(admin, proxy);
  });

  function setImage(url: string) {
    component.agInit({
      value: url,
      data: { origin: '', title: 'Thumbnail' },
      colDef: { type: 'image' },
    } as any);
  }

  it('does not resolve images without the image plugin', () => {
    setImage(externalUrl);

    expect(component.imageUrl).toBe('');
    expect(proxy.getFetch).not.toHaveBeenCalled();
  });

  it('resolves inline SVG images without the image plugin', () => {
    setImage(inlineSvg);

    expect(component.imageUrl).toBe(inlineSvg);
    expect(proxy.getFetch).not.toHaveBeenCalled();
  });

  it('keeps resolving images when the image plugin is installed', () => {
    admin.getPlugin.mockReturnValue({ config: {} });
    setImage(externalUrl);

    expect(component.imageUrl).toBe(externalUrl);
  });
});
