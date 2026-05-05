import { Component, Input, OnChanges, OnDestroy, SimpleChanges, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';
import {
  ControlComponent,
  MapComponent as MglComponent,
  NavigationControlDirective,
  ScaleControlDirective
} from '@maplibre/ngx-maplibre-gl';
import type { FeatureCollection } from 'geojson';
import type { GeoJSONSource } from 'maplibre-gl';
import { Map, Marker, setWorkerUrl } from 'maplibre-gl';
import { catchError, forkJoin, map as rxMap, of, Subject, switchMap, takeUntil } from 'rxjs';
import { HasChanges } from '../../guard/pending-changes.guard';
import { Ext } from '../../model/ext';
import { Page } from '../../model/page';
import { Ref } from '../../model/ref';
import { features, mapTemplate } from '../../mods/map';
import { AdminService } from '../../service/admin.service';
import { ProxyService } from '../../service/api/proxy.service';
import { RefService } from '../../service/api/ref.service';
import { Store } from '../../store/store';
import { memo, MemoCache } from '../../util/memo';
import { hasPrefix, hasTag, repost } from '../../util/tag';
import { LoadingComponent } from '../loading/loading.component';
import { PageControlsComponent } from '../page-controls/page-controls.component';
import { ResizeHandleDirective } from "../../directive/resize-handle.directive";

type MapEntry = [ref: Ref, bareRepost?: Ref];

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss'],
  encapsulation: ViewEncapsulation.None,
  host: { 'class': 'map ext' },
  imports: [
    MglComponent,
    ControlComponent,
    NavigationControlDirective,
    ScaleControlDirective,
    LoadingComponent,
    PageControlsComponent,
    ResizeHandleDirective
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

  private _page?: Page<Ref>;
  private map?: Map;
  private markers: Marker[] = [];
  private destroy$ = new Subject<void>();
  private mapDataUpdates$ = new Subject<Ref[]>();
  mapData: MapEntry[] = [];

  constructor(
    private router: Router,
    private admin: AdminService,
    private proxy: ProxyService,
    private refs: RefService,
    private store: Store,
  ) {
    setWorkerUrl('assets/maplibre-gl-csp-worker.js');
    this.mapDataUpdates$.pipe(
      switchMap(content => {
        if (!content.some(ref => this.isBareRepost(ref))) return of(content.map(ref => [ref] as MapEntry));
        return forkJoin(content.map(ref => this.getBareRepost(ref)));
      }),
      takeUntil(this.destroy$),
    ).subscribe(mapData => {
      this.mapData = mapData;
      MemoCache.clear(this);
      this.updateMapData();
    });
  }

  @memo
  get mapStyle() {
    return {
      ...this.ext?.config.mapStyle || this.admin.getTemplate('map')?.defaults?.mapStyle || mapTemplate.defaults?.mapStyle || {},
      ...this.admin.getTemplate('map')?.config?.mapStyle || {},
    };
  }

  saveChanges() {
    return true;
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['ext']) {
      MemoCache.clear(this);
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.mapDataUpdates$.complete();
    this.clearMarkers();
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
      features: this.mapData.flatMap(([ref]) => features(ref)).filter(f =>
        f.type === 'Feature' && f.geometry != null && f.geometry.type !== 'Point'
      ) || [],
    };
  }
  onMapError(event: any) {
    console.error('MapLibre Engine Error:', event.error);
  }

  mapLoaded(map: Map) {
    this.map = map;
    map.addSource('geo-features', { type: 'geojson', data: this.geoData });
    // Line layer for LineString and MultiLineString
    map.addLayer({
      id: 'geo-lines',
      type: 'line',
      source: 'geo-features',
      filter: ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false] as any,
      paint: {
        'line-color': '#4264fb',
        'line-width': 2,
      },
    });
    // Fill layer for Polygon and MultiPolygon
    map.addLayer({
      id: 'geo-polygons-fill',
      type: 'fill',
      source: 'geo-features',
      filter: ['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false] as any,
      paint: {
        'fill-color': '#4264fb',
        'fill-opacity': 0.3,
      },
    });
    // Outline layer for Polygon and MultiPolygon
    map.addLayer({
      id: 'geo-polygons-outline',
      type: 'line',
      source: 'geo-features',
      filter: ['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false] as any,
      paint: {
        'line-color': '#4264fb',
        'line-width': 2,
      },
    });
    // Circle layer for MultiPoint
    map.addLayer({
      id: 'geo-multipoints',
      type: 'circle',
      source: 'geo-features',
      filter: ['==', ['geometry-type'], 'MultiPoint'] as any,
      paint: {
        'circle-radius': 8,
        'circle-color': '#4264fb',
      },
    });
    this.updateMapData();
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
      if (pointFeature?.geometry?.type === 'Point' && pointFeature.geometry?.coordinates.length >= 2) {
        const el = this.createMarkerElement(ref);
        const marker = el ? new Marker({ element: el }) : new Marker();
        marker.addClassName('map-thumbnail');
        marker.setLngLat(pointFeature.geometry.coordinates).addTo(map);
        marker.on('click', () => this.router.navigate(['/ref', ref.url]));
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
    if (thumbnailPlugin.url) {
      const isProxy = this.admin.getPlugin('plugin/thumbnail')?.config?.proxy;
      const url = isProxy
        ? this.proxy.getFetch(thumbnailPlugin.url, ref.origin, ref.title || 'thumbnail', true)
        : thumbnailPlugin.url;
      el.style.backgroundImage = `url(${url})`;
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
