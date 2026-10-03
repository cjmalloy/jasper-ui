/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { GeocodeService } from './geocode.service';

describe('GeocodeService', () => {
  let service: GeocodeService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    service = TestBed.inject(GeocodeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should default to OSM', async () => {
    const config = await firstValueFrom(service.config$);
    expect(config.geocodingProvider).toBe('osm');
    expect(config.photonUrl).toBe('https://photon.komoot.io');
  });

  it('should use the config of a descendant map Ext', async () => {
    const config = await firstValueFrom(service.configFor$({
      tag: 'map/travel',
      config: { geocodingProvider: 'photon', photonUrl: 'https://photon.example.com', geocoderPosition: 'top-right' },
    }));
    expect(config.geocodingProvider).toBe('photon');
    expect(config.photonUrl).toBe('https://photon.example.com');
    expect(config.geocoderPosition).toBe('top-right');
  });

  it('should ignore the config of a non-map Ext', async () => {
    const config = await firstValueFrom(service.configFor$({
      tag: 'science',
      config: { geocodingProvider: 'photon' },
    }));
    expect(config.geocodingProvider).toBe('osm');
  });
});
