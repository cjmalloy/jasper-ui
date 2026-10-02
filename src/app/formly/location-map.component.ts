import { ChangeDetectionStrategy, Component, Input, NgZone, OnDestroy, ViewEncapsulation } from '@angular/core';
import { AbstractControl, FormArray, FormGroup } from '@angular/forms';
import { MapComponent as MglComponent } from '@maplibre/ngx-maplibre-gl';
import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';
import type { GeoJSONSource, MapMouseEvent } from 'maplibre-gl';
import { Map as MapLibreMap, Marker, setWorkerUrl } from 'maplibre-gl';
import { Subscription } from 'rxjs';
import { mapTemplate } from '../mods/map';
import { AdminService } from '../service/admin.service';
import { LocationPicker } from './location-picker';

/**
 * Map picker shared by all location inputs in a plugin form. Every location
 * is shown as a draggable marker, and clicking the map sets the active one.
 * Any other geo plugins on the Ref are shown so shape changes can be previewed.
 */
@Component({
  selector: 'app-location-map',
  host: {
    'class': 'location-map',
    // Prevent panning the map from starting a list drag and drop
    '(mousedown)': '$event.stopPropagation()',
    '(touchstart)': '$event.stopPropagation()',
  },
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
  picker!: LocationPicker;

  private _mapStyle: any;
  private map?: MapLibreMap;
  private markers = new Map<AbstractControl, Marker>();
  private watch?: Subscription;
  private picking = false;
  private lastActive?: AbstractControl;
  private lastActiveValue?: any;

  constructor(
    private admin: AdminService,
    private zone: NgZone,
  ) {
    setWorkerUrl('assets/maplibre-gl-worker.mjs');
  }

  get mapStyle() {
    if (this._mapStyle) return this._mapStyle;
    const style = {
      ...this.admin.getTemplate('map')?.defaults?.mapStyle || mapTemplate.defaults?.mapStyle || {},
      ...this.admin.getTemplate('map')?.config?.mapStyle || mapTemplate.config?.mapStyle || {},
    };
    const location = this.center;
    if (location) {
      style.center = location;
      style.zoom = Math.max(style.zoom ?? 0, 10);
    }
    return this._mapStyle = style;
  }

  get control(): AbstractControl {
    return this.picker.host.formControl!;
  }

  /**
   * The active location, or the first location set when none is active.
   */
  get center(): [number, number] | undefined {
    const active = this.picker.active?.value;
    if (hasLocation(active)) return [active[0], active[1]];
    const first = this.locations.map(c => c.value).find(hasLocation);
    return first && [first[0], first[1]];
  }

  /**
   * All location controls in this picker.
   */
  get locations(): AbstractControl[] {
    return leaves(this.control);
  }

  mapLoaded(map: MapLibreMap) {
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
    this.watch.add(this.picker.changes.subscribe(() => this.update()));
    this.updateMarkers();
    // The location may have changed while the map style was loading
    this.panToActive();
  }

  mapClick(event: MapMouseEvent) {
    if ((event.originalEvent?.target as Element | undefined)?.closest?.('.maplibregl-marker')) return;
    const active = this.picker.active;
    if (!active || !this.locations.includes(active)) return;
    const { lng, lat } = event.lngLat.wrap();
    this.pick(active, [lng, lat]);
  }

  onMapError(event: any) {
    console.error('MapLibre Engine Error:', event.error);
  }

  ngOnDestroy() {
    this.watch?.unsubscribe();
    for (const marker of this.markers.values()) marker.remove();
    this.markers.clear();
    this.map = undefined;
  }

  private select(control: AbstractControl) {
    this.picking = true;
    try {
      this.picker.select(control);
    } finally {
      this.picking = false;
    }
  }

  private pick(control: AbstractControl, value: [number, number]) {
    if (control.disabled) return;
    this.picking = true;
    try {
      this.picker.select(control);
      control.setValue(value);
      control.markAsDirty();
    } finally {
      this.picking = false;
    }
  }

  private update() {
    this.updateMarkers();
    // Only pan when the location was changed outside the map (typing, geolocation)
    if (!this.picking) this.panToActive();
    (this.map?.getSource('location-context') as GeoJSONSource | undefined)?.setData(this.contextData);
  }

  private panToActive() {
    const active = this.picker.active;
    const value = active?.value;
    const changed = active !== this.lastActive || value !== this.lastActiveValue;
    this.lastActive = active;
    this.lastActiveValue = value;
    if (!this.map || !changed || !hasLocation(value)) return;
    this.map.easeTo({ center: [value[0], value[1]], zoom: Math.max(this.map.getZoom(), 10) });
  }

  private updateMarkers() {
    if (!this.map) return;
    const seen = new Set<AbstractControl>();
    for (const control of this.locations) {
      const location = control.value;
      if (!hasLocation(location)) continue;
      seen.add(control);
      let marker = this.markers.get(control);
      if (!marker) {
        marker = new Marker({ draggable: true, className: 'location-marker' })
          .setLngLat([location[0], location[1]])
          .addTo(this.map);
        const m = marker;
        m.on('dragstart', () => this.zone.run(() => this.select(control)));
        m.on('dragend', () => this.zone.run(() => {
          const { lng, lat } = m.getLngLat().wrap();
          this.pick(control, [lng, lat]);
        }));
        m.getElement().addEventListener('click', () => this.zone.run(() => this.select(control)));
        this.markers.set(control, m);
      } else {
        marker.setLngLat([location[0], location[1]]);
      }
      marker.setDraggable(!control.disabled);
      if (control === this.picker.active) {
        marker.addClassName('active');
      } else {
        marker.removeClassName('active');
      }
    }
    for (const [control, marker] of this.markers) {
      if (seen.has(control)) continue;
      marker.remove();
      this.markers.delete(control);
    }
  }

  /**
   * The closest ancestor holding all geo plugins on the Ref, or the picker
   * host when not part of a Ref plugins form.
   */
  private get contextRoot(): AbstractControl {
    let c: AbstractControl | null = this.control;
    while (c) {
      if (isGeoPlugins(c)) return c;
      c = c.parent;
    }
    return this.control;
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
    }
    return { type: 'FeatureCollection', features };
  }
}

function leaves(c: AbstractControl, out: AbstractControl[] = []): AbstractControl[] {
  if (c instanceof FormArray || c instanceof FormGroup) {
    for (const child of Object.values(c.controls) as AbstractControl[]) leaves(child, out);
  } else {
    out.push(c);
  }
  return out;
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
    case 'MultiLineString': {
      const lines = (Array.isArray(c) ? c : []).map(positions).filter(l => l.length);
      return {
        type: 'GeometryCollection',
        geometries: lines.map(l => l.length > 1
          ? { type: 'LineString', coordinates: l }
          : { type: 'Point', coordinates: l[0] }),
      };
    }
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
