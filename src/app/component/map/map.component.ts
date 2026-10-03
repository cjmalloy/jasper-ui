import { Component, Input, NgZone, OnChanges, OnDestroy, SimpleChanges, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import {
  ControlComponent,
  MapComponent as MglComponent,
  NavigationControlDirective,
  ScaleControlDirective
} from '@maplibre/ngx-maplibre-gl';
import { provideMaplibreWorker } from '@maplibre/ngx-maplibre-gl/config';
import type { FeatureCollection } from 'geojson';
import type { GeoJSONSource, MapMouseEvent } from 'maplibre-gl';
import { LngLatBounds, Map, Marker } from 'maplibre-gl';
import { catchError, forkJoin, map as rxMap, of, Subject, switchMap } from 'rxjs';
import { HasChanges } from '../../guard/pending-changes.guard';
import { Ext } from '../../model/ext';
import { Page } from '../../model/page';
import { Ref } from '../../model/ref';
import { features, mapTemplate } from '../../mods/map';
import { RootConfig } from '../../mods/root';
import { isInlineSvg } from '../../pipe/thumbnail.pipe';
import { AdminService } from '../../service/admin.service';
import { ProxyService } from '../../service/api/proxy.service';
import { RefService } from '../../service/api/ref.service';
import { AuthzService } from '../../service/authz.service';
import { GeocodeService } from '../../service/geocode.service';
import { Store } from '../../store/store';
import { getAddTags } from '../../util/add-tags';
import { getTitle } from '../../util/format';
import { geoFeatures, hasLocation } from '../../util/geo';
import { addGeoLayers } from '../../util/geo-style';
import { GeocoderPosition, isConfigured } from '../../util/geocode';
import { memo, MemoCache } from '../../util/memo';
import { hasPrefix, hasTag, repost } from '../../util/tag';
import { LoadingComponent } from '../loading/loading.component';
import { addGeocoder } from './geocoder';
import { PageControlsComponent } from '../page-controls/page-controls.component';
import { ResizeHandleDirective } from "../../directive/resize-handle.directive";

type MapEntry = [ref: Ref, bareRepost?: Ref];

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss'],
  encapsulation: ViewEncapsulation.None,
  host: { 'class': 'map ext' },
  providers: [provideMaplibreWorker('assets/maplibre-gl-worker.mjs')],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    MglComponent,
    ControlComponent,
    NavigationControlDirective,
    ScaleControlDirective,
    LoadingComponent,
    PageControlsComponent,
    ResizeHandleDirective,
  ]
})
export class MapComponent implements OnChanges, OnDestroy, HasChanges {

  @Input()
  tag = '';
  @Input()
  ext?: Ext;
  @Input()
  pageControls = true;
  @Input()
  emptyMessage = 'No results found';
  /**
   * Fit the map to this bounding box [west, south, east, north].
   * If empty, fits to the features on the map when fitFeatures is set.
   */
  @Input()
  bbox?: number[];
  @Input()
  fitFeatures = false;

  private _page?: Page<Ref>;
  private map?: Map;
  private markers: Marker[] = [];
  private mapDataUpdates$ = new Subject<Ref[]>();
  mapData: MapEntry[] = [];
  private geocoding = false;
  private geocoderPosition?: GeocoderPosition;
  private removeGeocoder?: () => void;
  private removeGeoLayers?: () => void;
  private searchMarker?: Marker;
  private reverseGeocode?: AbortController;

  constructor(
    private router: Router,
    private admin: AdminService,
    private proxy: ProxyService,
    private refs: RefService,
    private store: Store,
    private geocoder: GeocodeService,
    private auth: AuthzService,
    private zone: NgZone,
  ) {
    geocoder.config$.pipe(takeUntilDestroyed()).subscribe(config => {
      this.geocoding = isConfigured(config);
      if (this.geocoderPosition !== config.geocoderPosition) {
        this.removeGeocoder?.();
        this.removeGeocoder = undefined;
      }
      this.geocoderPosition = config.geocoderPosition;
      this.updateGeocoder();
    });
    this.mapDataUpdates$.pipe(
      switchMap(content => {
        if (!content.some(ref => this.isBareRepost(ref))) return of(content.map(ref => [ref] as MapEntry));
        return forkJoin(content.map(ref => this.getBareRepost(ref)));
      }),
      takeUntilDestroyed(),
    ).subscribe(mapData => {
      this.mapData = mapData;
      MemoCache.clear(this);
      this.updateMapData();
      if (this.fitFeatures) this.fit();
    });
  }

  @memo
  get mapStyle() {
    return {
      ...this.ext?.config?.mapStyle || this.admin.getTemplate('map')?.defaults?.mapStyle || mapTemplate.defaults?.mapStyle || {},
      ...this.admin.getTemplate('map')?.config?.mapStyle || {},
    };
  }

  private updateGeocoder() {
    if (this.geocoding && this.map && !this.removeGeocoder) {
      this.removeGeocoder = addGeocoder(this.map, this.geocoder, this.geocoderPosition,
        (location, name) => this.showSearchResult(location, name),
        () => this.clearSearchResult());
    } else if (!this.geocoding && this.removeGeocoder) {
      this.removeGeocoder();
      this.removeGeocoder = undefined;
      this.clearSearchResult();
    }
  }

  /**
   * Mark an address search result. Clicking the marker submits a new Ref there.
   * Returns a function to update the marker's title.
   */
  private showSearchResult(location: [number, number], name = '') {
    if (!this.map) return undefined;
    this.clearSearchResult();
    const marker = new Marker({ color: '#e5a50a', className: 'geocode-marker' })
      .setLngLat(location);
    const el = marker.getElement();
    const setName = (value: string) => {
      name = value;
      const label = name || $localize`Submit a Ref here`;
      el.title = label;
      el.setAttribute('aria-label', label);
    };
    setName(name);
    el.setAttribute('role', 'button');
    el.tabIndex = 0;
    const activate = (e: Event) => {
      e.stopPropagation();
      // Marker events run outside Angular
      this.zone.run(() => {
        this.clearSearchResult();
        this.router.navigate(['/submit/text'], {
          queryParams: {
            tag: [...this.addTags.filter(t => t !== 'plugin/geo/point'), 'plugin/geo/point'],
            location: location.join(','),
            ...name ? { title: name } : {},
          },
        });
      });
    };
    el.addEventListener('click', activate);
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activate(e);
      }
    });
    marker.addTo(this.map);
    this.searchMarker = marker;
    return setName;
  }

  /**
   * Tags added to a Ref submitted from the map, the same as the sidebar
   * Submit button.
   */
  get addTags(): string[] {
    const tag = this.tag || undefined;
    const plugin = tag ? this.admin.getPlugin(tag) : undefined;
    const root = this.admin.getTemplate('');
    const rootConfig = root
      ? (this.ext?.config || (tag && this.admin.getTemplate(tag)?.defaults) || root.defaults) as RootConfig
      : undefined;
    return getAddTags(tag, plugin, rootConfig).filter(t => this.auth.canAddTag(t));
  }

  private clearSearchResult() {
    this.reverseGeocode?.abort();
    this.reverseGeocode = undefined;
    this.searchMarker?.remove();
    this.searchMarker = undefined;
  }

  /**
   * Clicking the map marks that point, titled with its reverse geocoded address.
   */
  private mapClick = (e: MapMouseEvent) => {
    if ((e.originalEvent?.target as Element | null)?.closest?.('.maplibregl-marker')) return;
    const { lng, lat } = e.lngLat.wrap();
    const location: [number, number] = [round(lng), round(lat)];
    const setName = this.showSearchResult(location);
    if (!setName || !this.geocoding) return;
    const controller = this.reverseGeocode = new AbortController();
    this.geocoder.reverse(location, controller.signal)
      .then(result => {
        if (!controller.signal.aborted && result?.name) setName(result.name);
      })
      .catch(err => {
        if (!controller.signal.aborted) console.error('Reverse geocoding error:', err);
      });
  };

  saveChanges() {
    return true;
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['ext']) {
      MemoCache.clear(this);
    }
    if (changes['bbox'] && !changes['bbox'].firstChange) {
      MemoCache.clear(this);
      this.fit();
    }
  }

  ngOnDestroy() {
    this.mapDataUpdates$.complete();
    this.clearMarkers();
    this.clearSearchResult();
    this.removeGeocoder = undefined;
    this.removeGeoLayers?.();
    this.removeGeoLayers = undefined;
    try {
      this.map?.remove();
    } catch (ignored) { }
    this.map = undefined;
  }

  get page(): Page<Ref> | undefined {
    return this._page;
  }

  @Input()
  set page(value: Page<Ref> | undefined) {
    MemoCache.clear(this);
    this._page = value;
    this.mapDataUpdates$.next(value?.content || []);
    if (this._page) {
      if (this._page.page.number > 0 && this._page.page.number >= this._page.page.totalPages) {
        this.router.navigate([], {
          queryParams: {
            pageNumber: this._page.page.totalPages - 1
          },
          queryParamsHandling: 'merge',
        });
      }
    }
  }

  @memo
  get geoData(): FeatureCollection {
    return {
      type: 'FeatureCollection',
      // Geo points are shown as markers
      features: this.mapData.flatMap(([ref]) => features(ref, 'plugin/geo/point'))
        .filter(f => f?.type === 'Feature')
        .flatMap(f => geoFeatures(f)),
    };
  }
  onMapError(event: any) {
    console.error('MapLibre Engine Error:', event.error);
  }

  mapLoaded(map: Map) {
    this.map = map;
    this.updateGeocoder();
    map.on('click', this.mapClick);
    map.addSource('geo-features', { type: 'geojson', data: this.geoData });
    this.removeGeoLayers = this.zone.runOutsideAngular(() => addGeoLayers(map, 'geo-features', 'geo', 8));
    this.updateMapData();
    this.fit();
  }

  private fit() {
    if (!this.map) return;
    const bounds = this.bounds;
    if (!bounds) return;
    this.map.fitBounds(bounds, { ...this.fitBoundsOptions, animate: false });
  }

  readonly fitBoundsOptions = { padding: 40, maxZoom: 14 };

  /**
   * Bounds the map is created with, so it doesn't render the style's
   * default center first and then jump to the features.
   */
  @memo
  get bounds(): LngLatBounds | undefined {
    const bbox = this.bbox;
    if (bbox && (bbox.length === 4 || bbox.length === 6) && bbox.every(n => typeof n === 'number' && isFinite(n))) {
      const east = bbox.length === 6 ? bbox[3] : bbox[2];
      const north = bbox.length === 6 ? bbox[4] : bbox[3];
      if (Math.abs(bbox[1]) <= 90 && Math.abs(north) <= 90) {
        return new LngLatBounds([bbox[0], bbox[1]], [east, north]);
      }
    }
    if (!this.fitFeatures) return undefined;
    const lngs: number[] = [];
    let south = Infinity;
    let north = -Infinity;
    const extend = (c: any): void => {
      if (!Array.isArray(c)) return;
      if (typeof c[0] === 'number' && typeof c[1] === 'number') {
        if (isFinite(c[0]) && isFinite(c[1])) {
          lngs.push(((c[0] + 180) % 360 + 360) % 360 - 180);
          south = Math.min(south, c[1]);
          north = Math.max(north, c[1]);
        }
      } else {
        c.forEach(extend);
      }
    };
    this.mapData
      .flatMap(([ref]) => features(ref))
      .flatMap(f => geoFeatures(f, hasLocation))
      .forEach(f => extend((f.geometry as any).coordinates));
    if (!lngs.length) return undefined;
    const [west, east] = minimalLngInterval(lngs);
    return new LngLatBounds([west, south], [east, north]);
  }

  private updateMapData() {
    if (!this.map) return;
    const source = this.map.getSource('geo-features') as GeoJSONSource | undefined;
    if (source) {
      source.setData(this.geoData);
    }
    this.clearMarkers();
    this.addMarkers(this.map);
  }

  private clearMarkers() {
    this.markers.forEach(m => m.remove());
    this.markers = [];
  }

  private addMarkers(map: Map) {
    this.mapData.forEach(entry => {
      const [ref] = entry;
      const pointFeature = ref.plugins?.['plugin/geo/point'];
      if (pointFeature?.geometry?.type === 'Point' && hasLocation(pointFeature.geometry?.coordinates)) {
        const el = this.createMarkerElement(ref);
        const marker = el ? new Marker({ element: el }) : new Marker();
        marker.addClassName('map-thumbnail');
        const title = getTitle(ref);
        const markerElement = marker.getElement();
        markerElement.title = title;
        markerElement.setAttribute('aria-label', title);
        markerElement.setAttribute('role', 'link');
        markerElement.tabIndex = 0;
        marker.setLngLat(pointFeature.geometry.coordinates).addTo(map);
        const openRef = () => this.zone.run(() => this.router.navigate(['/ref', ref.url]));
        marker.on('click', openRef);
        markerElement.addEventListener('keydown', event => {
          if (event.key === 'Enter') {
            event.preventDefault();
            openRef();
          }
        });
        this.markers.push(marker);
      }
    });
  }

  private createMarkerElement(ref: Ref): HTMLElement | undefined {
    if (!this.admin.getPlugin('plugin/thumbnail')) return undefined;
    const thumbnailPlugin = ref.plugins?.['plugin/thumbnail'];
    if (!thumbnailPlugin) return undefined;
    const el = document.createElement('div');
    el.className = 'thumbnail';
    if (thumbnailPlugin.color) el.style.backgroundColor = thumbnailPlugin.color;
    if (thumbnailPlugin.radius) el.style.borderRadius = thumbnailPlugin.radius + 'px';
    if (thumbnailPlugin.emoji) el.textContent = thumbnailPlugin.emoji;
    if (thumbnailPlugin.url && (this.admin.getPlugin('plugin/image') || isInlineSvg(thumbnailPlugin.url))) {
      const isProxy = this.admin.getPlugin('plugin/thumbnail')?.config?.proxy;
      const url = isProxy && !isInlineSvg(thumbnailPlugin.url)
        ? this.proxy.getFetch(thumbnailPlugin.url, ref.origin, 'thumbnail', true)
        : thumbnailPlugin.url;
      el.style.backgroundImage = `url(${url})`;
      el.style.backgroundSize = thumbnailPlugin.radius ? 'cover' : 'contain';
    }
    return el;
  }

  private getBareRepost(ref: Ref) {
    if (!this.isBareRepost(ref)) return of([ref] as MapEntry);
    const source = repost(ref);
    return (this.store.view.top?.url === source
        ? of(this.store.view.top)
        : this.refs.getCurrent(source)
    ).pipe(
      rxMap(sourceRef => [this.withRepostGeo(ref, sourceRef), ref] as MapEntry),
      catchError(() => of([ref] as MapEntry)),
    );
  }

  private isBareRepost(ref: Ref) {
    return !!ref.sources?.[0] && hasTag('plugin/repost', ref) && !ref.title && !ref.comment;
  }

  private withRepostGeo(repostRef: Ref, sourceRef: Ref) {
    if (!hasTag('plugin/geo', repostRef)) return { ...sourceRef, url: repostRef.url };
    const tags = [
      ...(sourceRef.tags || []).filter(tag => !hasPrefix(tag, 'plugin/geo')),
      ...(repostRef.tags || []).filter(tag => hasPrefix(tag, 'plugin/geo')),
    ];
    const plugins = {
      ...this.filterPlugins(sourceRef.plugins, false),
      ...this.filterPlugins(repostRef.plugins, true),
    };
    return {
      ...sourceRef,
      url: repostRef.url,
      tags: [...new Set(tags)],
      plugins: Object.keys(plugins).length ? plugins : undefined,
    };
  }

  private filterPlugins(plugins: Ref['plugins'], geo: boolean) {
    return Object.fromEntries(Object.entries(plugins || {}).filter(([key]) => key.startsWith('plugin/geo/') === geo));
  }
}

function round(n: number) {
  return Math.round(n * 1e6) / 1e6;
}

/**
 * Smallest longitude interval containing all normalized longitudes, possibly
 * crossing the antimeridian. Returns [west, east] with east >= west, where east
 * may exceed 180 when the interval crosses the antimeridian.
 */
export function minimalLngInterval(lngs: number[]): [number, number] {
  const sorted = [...lngs].sort((a, b) => a - b);
  let gap = sorted[0] + 360 - sorted[sorted.length - 1];
  let start = 0;
  for (let i = 1; i < sorted.length; i++) {
    const g = sorted[i] - sorted[i - 1];
    if (g > gap) {
      gap = g;
      start = i;
    }
  }
  const west = sorted[start];
  const east = sorted[(start + sorted.length - 1) % sorted.length];
  return [west, east < west ? east + 360 : east];
}
