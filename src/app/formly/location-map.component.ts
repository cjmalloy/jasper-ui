import { ChangeDetectionStrategy, Component, Input, OnDestroy, ViewEncapsulation } from '@angular/core';
import { AbstractControl, FormArray, FormGroup } from '@angular/forms';
import { MapComponent as MglComponent } from '@maplibre/ngx-maplibre-gl';
import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';
import type { GeoJSONSource, MapMouseEvent } from 'maplibre-gl';
import { Map, Marker, setWorkerUrl } from 'maplibre-gl';
import { Subscription } from 'rxjs';
import { mapTemplate } from '../mods/map';
import { AdminService } from '../service/admin.service';

/**
 * Map picker for a location form control. Shows any other geo plugins on the
 * Ref (or sibling locations in the same list) so shape changes can be previewed.
 */
@Component({
  selector: 'app-location-map',
  host: { 'class': 'location-map' },
  template: `
    <mgl-map [mapStyle]="mapStyle"
             (mapLoad)="mapLoaded($event)"
             (mapClick)="mapClick($event)"
             (mapError)="onMapError($event)"></mgl-map>
  `,
  styleUrls: ['./location-map.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MglComponent],
})
export class LocationMapComponent implements OnDestroy {

  @Input({ required: true })
  control!: AbstractControl;

  private _mapStyle: any;
  private map?: Map;
  private marker?: Marker;
  private watch?: Subscription;
  private picking = false;

  constructor(
    private admin: AdminService,
  ) {
    setWorkerUrl('assets/maplibre-gl-worker.mjs');
  }

  get mapStyle() {
    if (this._mapStyle) return this._mapStyle;
    const style = {
      ...this.admin.getTemplate('map')?.defaults?.mapStyle || mapTemplate.defaults?.mapStyle || {},
      ...this.admin.getTemplate('map')?.config?.mapStyle || mapTemplate.config?.mapStyle || {},
    };
    const location = this.location;
    if (location) {
      style.center = location;
      style.zoom = Math.max(style.zoom ?? 0, 10);
    }
    return this._mapStyle = style;
  }

  get location(): [number, number] | undefined {
    return hasLocation(this.control.value) ? [this.control.value[0], this.control.value[1]] : undefined;
  }

  mapLoaded(map: Map) {
    this.map = map;
    map.addSource('location-context', { type: 'geojson', data: this.contextData });
    map.addLayer({
      id: 'location-context-polygons-fill',
      type: 'fill',
      source: 'location-context',
      filter: ['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false] as any,
      paint: { 'fill-color': '#4264fb', 'fill-opacity': 0.3 },
    });
    map.addLayer({
      id: 'location-context-lines',
      type: 'line',
      source: 'location-context',
      filter: ['match', ['geometry-type'], ['LineString', 'MultiLineString', 'Polygon', 'MultiPolygon'], true, false] as any,
      paint: { 'line-color': '#4264fb', 'line-width': 2 },
    });
    map.addLayer({
      id: 'location-context-points',
      type: 'circle',
      source: 'location-context',
      filter: ['match', ['geometry-type'], ['Point', 'MultiPoint'], true, false] as any,
      paint: { 'circle-radius': 5, 'circle-color': '#4264fb' },
    });
    this.watch?.unsubscribe();
    this.watch = this.contextRoot.valueChanges.subscribe(() => this.update());
    this.updateMarker(false);
  }

  mapClick(event: MapMouseEvent) {
    const { lng, lat } = event.lngLat.wrap();
    this.pick([lng, lat]);
  }

  onMapError(event: any) {
    console.error('MapLibre Engine Error:', event.error);
  }

  ngOnDestroy() {
    this.watch?.unsubscribe();
    this.marker?.remove();
    this.marker = undefined;
    this.map = undefined;
  }

  private pick(value: [number, number]) {
    if (this.control.disabled) return;
    this.picking = true;
    try {
      this.control.setValue(value);
      this.control.markAsDirty();
    } finally {
      this.picking = false;
    }
  }

  private update() {
    // Only pan when the location was changed outside the map (typing, geolocation)
    this.updateMarker(!this.picking);
    (this.map?.getSource('location-context') as GeoJSONSource | undefined)?.setData(this.contextData);
  }

  private updateMarker(pan: boolean) {
    if (!this.map) return;
    const location = this.location;
    if (!location) {
      this.marker?.remove();
      this.marker = undefined;
      return;
    }
    if (!this.marker) {
      this.marker = new Marker({ draggable: true, className: 'location-marker' })
        .setLngLat(location)
        .addTo(this.map);
      this.marker.on('dragend', () => {
        const { lng, lat } = this.marker!.getLngLat().wrap();
        this.pick([lng, lat]);
      });
    } else {
      this.marker.setLngLat(location);
    }
    this.marker.setDraggable(!this.control.disabled);
    if (pan) this.map.easeTo({ center: location, zoom: Math.max(this.map.getZoom(), 10) });
  }

  /**
   * The closest ancestor holding all geo plugins on the Ref, or the parent
   * group/array of this location when not part of a Ref plugins form.
   */
  private get contextRoot(): AbstractControl {
    let c: AbstractControl | null = this.control;
    while (c) {
      if (isGeoPlugins(c)) return c;
      c = c.parent;
    }
    return this.control.parent || this.control;
  }

  private get contextData(): FeatureCollection {
    const root = this.contextRoot;
    const features: Feature[] = [];
    if (isGeoPlugins(root)) {
      for (const [key, value] of Object.entries((root as FormGroup).getRawValue())) {
        if (!key.startsWith('plugin/geo/')) continue;
        const geometry = sanitize((value as any)?.geometry);
        if (geometry && !isEmpty(geometry)) features.push({ type: 'Feature', properties: {}, geometry });
      }
    } else if (root instanceof FormArray) {
      const points = root.getRawValue().filter(isPosition);
      if (points.length) features.push({ type: 'Feature', properties: {}, geometry: { type: 'MultiPoint', coordinates: points } });
      if (points.length > 1) features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: points } });
    }
    return { type: 'FeatureCollection', features };
  }
}

function isGeoPlugins(c: AbstractControl) {
  return c instanceof FormGroup && Object.keys(c.controls).some(k => k.startsWith('plugin/geo/'));
}

export function hasLocation(v: any): v is [number, number] {
  return isPosition(v) && (v[0] !== 0 || v[1] !== 0);
}

function isPosition(p: any): p is Position {
  return Array.isArray(p) && p.length >= 2 && typeof p[0] === 'number' && typeof p[1] === 'number' && isFinite(p[0]) && isFinite(p[1]);
}

function isEmpty(geometry: Geometry): boolean {
  if (geometry.type === 'GeometryCollection') return !geometry.geometries.length;
  return Array.isArray(geometry.coordinates) && !geometry.coordinates.length;
}

function positions(ps: any): Position[] {
  return Array.isArray(ps) ? ps.filter(isPosition) : [];
}

/**
 * Convert partially edited geometry into something renderable, so incomplete
 * shapes can still be previewed while editing.
 */
function sanitize(geometry: any): Geometry | undefined {
  const c = geometry?.coordinates;
  switch (geometry?.type) {
    case 'Point':
      return isPosition(c) ? { type: 'Point', coordinates: c } : undefined;
    case 'MultiPoint':
      return { type: 'MultiPoint', coordinates: positions(c) };
    case 'LineString': {
      const ps = positions(c);
      return ps.length > 1 ? { type: 'LineString', coordinates: ps } : { type: 'MultiPoint', coordinates: ps };
    }
    case 'MultiLineString':
      return { type: 'MultiLineString', coordinates: (Array.isArray(c) ? c : []).map(positions).filter(l => l.length > 1) };
    case 'Polygon':
      return polygon(Array.isArray(c) ? c : []);
    case 'MultiPolygon': {
      const polys = (Array.isArray(c) ? c : []).map(p => polygon(Array.isArray(p) ? p : []));
      return { type: 'GeometryCollection', geometries: polys.filter(p => !!p) as Geometry[] };
    }
  }
  return undefined;
}

function polygon(rings: any[]): Geometry | undefined {
  const rs = rings.map(positions).filter(r => r.length);
  if (!rs.length) return undefined;
  if (rs.every(r => r.length >= 3)) {
    return { type: 'Polygon', coordinates: rs.map(close) };
  }
  return {
    type: 'GeometryCollection',
    geometries: rs.map(r => r.length > 1
      ? { type: 'LineString', coordinates: r }
      : { type: 'Point', coordinates: r[0] }),
  };
}

function close(ring: Position[]): Position[] {
  const [first] = ring;
  const last = ring[ring.length - 1];
  return first[0] === last[0] && first[1] === last[1] ? ring : [...ring, first];
}
