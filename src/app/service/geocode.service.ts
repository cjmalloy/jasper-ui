import { Injectable } from '@angular/core';
import { catchError, firstValueFrom, map, Observable, of, timeout } from 'rxjs';
import { Ext } from '../model/ext';
import { mapTemplate } from '../mods/map';
import { Store } from '../store/store';
import { geocode, GeocodeResult, GeocodeView, GeocodingConfig, reverseGeocode } from '../util/geocode';
import { hasPrefix } from '../util/tag';
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

  /**
   * The geocoding config for a map: the active config, then the config of
   * the map's own Ext (such as map/travel).
   */
  configFor$(ext?: Ext): Observable<GeocodingConfig> {
    if (!ext || !hasPrefix(ext.tag, 'map')) return this.config$;
    return this.config$.pipe(map(c => ({ ...c, ...config(ext.config) })));
  }

  async geocode(query: string, signal?: AbortSignal, view?: GeocodeView, ext?: Ext): Promise<GeocodeResult[]> {
    return geocode(query, await firstValueFrom(this.configFor$(ext)), signal, view);
  }

  async reverse(location: [number, number], signal?: AbortSignal, ext?: Ext): Promise<GeocodeResult | undefined> {
    return reverseGeocode(location, await firstValueFrom(this.configFor$(ext)), signal);
  }
}

function config(c?: any): GeocodingConfig {
  const result: GeocodingConfig = {};
  if (c?.geocodingProvider) result.geocodingProvider = c.geocodingProvider;
  if (c?.googleMapsApiKey) result.googleMapsApiKey = c.googleMapsApiKey;
  if (c?.photonUrl) result.photonUrl = c.photonUrl;
  if (c?.geocoderPosition) result.geocoderPosition = c.geocoderPosition;
  return result;
}
