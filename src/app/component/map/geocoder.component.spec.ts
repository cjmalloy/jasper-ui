/// <reference types="vitest/globals" />
import { TestBed } from '@angular/core/testing';
import { MapService } from '@maplibre/ngx-maplibre-gl';
import { GeocodeService } from '../../service/geocode.service';
import { GeocoderComponent } from './geocoder.component';

describe('GeocoderComponent', () => {
  const map = { flyTo: vi.fn(), getZoom: () => 6 };
  const geocode = vi.fn();

  beforeEach(async () => {
    map.flyTo.mockReset();
    geocode.mockReset();
    await TestBed.configureTestingModule({
      imports: [GeocoderComponent],
      providers: [
        { provide: MapService, useValue: { mapInstance: map } },
        { provide: GeocodeService, useValue: { geocode } },
      ],
    }).compileComponents();
  });

  it('overlays results and flies to the selected one', async () => {
    geocode.mockResolvedValue([{ name: 'Halifax', location: [-63.57, 44.65] }]);
    const fixture = TestBed.createComponent(GeocoderComponent);
    const el: HTMLElement = fixture.nativeElement;
    fixture.componentInstance.input('Halifax');
    await fixture.componentInstance.search();
    fixture.detectChanges();
    expect(geocode).toHaveBeenCalledWith('Halifax', expect.any(AbortSignal));
    (el.querySelector('.geocoder-result') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(map.flyTo).toHaveBeenCalledWith({ center: [-63.57, 44.65], zoom: 14 });
    expect(el.querySelector('.geocoder-result')).toBeNull();
  });

  it('shows when nothing is found', async () => {
    geocode.mockResolvedValue([]);
    const fixture = TestBed.createComponent(GeocoderComponent);
    fixture.componentInstance.input('nowhere');
    await fixture.componentInstance.search();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.geocoder-status')?.textContent).toBe('No results found.');
  });
});
