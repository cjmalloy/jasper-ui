import { Injectable } from '@angular/core';
import { catchError, firstValueFrom, map, Observable, of, timeout } from 'rxjs';
import { mapTemplate } from '../mods/map';
import { Store } from '../store/store';
import { geocode, GeocodeResult, GeocodingConfig, isConfigured, reverseGeocode } from '../util/geocode';
import { AdminService } from './admin.service';
import { ExtService } from './api/ext.service';

@Injectable({
  providedIn: 'root',
})
export class GeocodeService {

  constructor(
    private admin: AdminService,
    private exts: ExtService,
    private store: Store,
  ) { }

  /**
   * The active geocoding config: built-in defaults, then the map template
   * defaults, then the map Ext config.
   */
  get config$(): Observable<GeocodingConfig> {
    const defaults = config({
      ...mapTemplate.defaults,
      ...this.admin.getTemplate('map')?.defaults,
    });
    if (!this.admin.getTemplate('map')) return of(defaults);
    return this.exts.getCachedExt('map', this.store.account.origin).pipe(
      timeout(5_000),
      map(ext => ({ ...defaults, ...config(ext?.config) })),
      catchError(() => of(defaults)),
    );
  }

  async geocode(query: string, signal?: AbortSignal): Promise<GeocodeResult[]> {
    return geocode(query, await firstValueFrom(this.config$), signal);
  }

  /**
   * Is a geocoding provider set up for searching addresses on maps.
   */
  get configured$(): Observable<boolean> {
    return this.config$.pipe(map(isConfigured));
  }

  async reverse(location: [number, number], signal?: AbortSignal): Promise<GeocodeResult | undefined> {
    return reverseGeocode(location, await firstValueFrom(this.config$), signal);
  }
}

function config(c?: any): GeocodingConfig {
  const result: GeocodingConfig = {};
  if (c?.geocodingProvider) result.geocodingProvider = c.geocodingProvider;
  if (c?.googleMapsApiKey) result.googleMapsApiKey = c.googleMapsApiKey;
  if (c?.photonUrl) result.photonUrl = c.photonUrl;
  return result;
}
