/// <reference types="vitest/globals" />
import { TestBed } from '@angular/core/testing';
import { AdminService } from '../../../service/admin.service';
import { ProxyService } from '../../../service/api/proxy.service';
import { GridCellComponent } from './grid-cell.component';

describe('GridCellComponent', () => {
  const externalUrl = 'https://example.com/thumbnail.png';
  const inlineSvg = 'data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22/%3E';
  let admin: any;
  let proxy: any;
  let sanitizer: any;
  let component: GridCellComponent;

  beforeEach(() => {
    admin = { getPlugin: vi.fn() };
    proxy = { getFetch: vi.fn() };
    sanitizer = { bypassSecurityTrustUrl: vi.fn(url => url) };
    component = new GridCellComponent(admin, proxy, sanitizer);
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
    expect(sanitizer.bypassSecurityTrustUrl).toHaveBeenCalledWith(inlineSvg);
    expect(proxy.getFetch).not.toHaveBeenCalled();
  });

  it('renders inline SVG images without an unsafe URL', async () => {
    await TestBed.configureTestingModule({
      imports: [GridCellComponent],
      providers: [
        { provide: AdminService, useValue: admin },
        { provide: ProxyService, useValue: proxy },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(GridCellComponent);
    fixture.componentInstance.agInit({
      value: inlineSvg,
      data: { origin: '', title: 'Thumbnail' },
      colDef: { type: 'image' },
    } as any);

    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.grid-image').getAttribute('src')).toBe(inlineSvg);
  });

  it('keeps resolving images when the image plugin is installed', () => {
    admin.getPlugin.mockReturnValue({ config: {} });
    setImage(externalUrl);

    expect(component.imageUrl).toBe(externalUrl);
  });
});
