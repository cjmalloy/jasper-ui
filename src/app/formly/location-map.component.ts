import { Component, computed, DestroyRef, inject, input, untracked, viewChild, ViewEncapsulation } from '@angular/core';
import { AbstractControl, FormArray, FormGroup } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MapComponent as MglComponent } from '@maplibre/ngx-maplibre-gl';
import { provideMaplibreWorker } from '@maplibre/ngx-maplibre-gl/config';
import type { Feature, FeatureCollection } from 'geojson';
import type { GeoJSONSource } from 'maplibre-gl';
import { LngLatBounds, Map as MapLibreMap, MapMouseEvent, Marker } from 'maplibre-gl';
import { isEqual } from 'lodash-es';
import { Subscription } from 'rxjs';
import { CollapsedAttributionControl } from '../component/map/collapsed-attribution';
import { addGeocoder } from '../component/map/geocoder';
import { ResizeHandleDirective } from '../directive/resize-handle.directive';
import { preventSelectionDrag } from '../component/map/selection-drag';
import { onSingleClick } from '../component/map/single-click';
import { mapTemplate } from '../mods/map';
import { AdminService } from '../service/admin.service';
import { ConfigService } from '../service/config.service';
import { GeocodeService } from '../service/geocode.service';
import { geoFeatures, hasLocation, locationBounds } from '../util/geo';
import { addGeoLayers } from '../util/geo-style';
import { GeocoderPosition, isConfigured } from '../util/geocode';
import { closedRings, LocationList, locationLists, LocationPicker } from './location-picker';

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
    <mgl-map [mapStyle]="mapStyle()"
             [bounds]="bounds()"
             [fitBoundsOptions]="fitBoundsOptions"
             [attributionControl]="false"
             (styleData)="styleLoaded($event.target)"
             (mapLoad)="mapLoaded($event)"
             (mapContextMenu)="mapContextMenu($event)"
             (mapError)="onMapError($event)"
             (dragstart)="$event.preventDefault()"
             appResizeHandle
             [hitArea]="config.mobile() ? 48 : 20" />
  `,
  styleUrls: ['./location-map.component.scss'],
  encapsulation: ViewEncapsulation.None,
  imports: [MglComponent, ResizeHandleDirective],
  providers: [provideMaplibreWorker('assets/maplibre-gl-worker.mjs')],
})
export class LocationMapComponent {
  readonly config = inject(ConfigService);
  private admin = inject(AdminService);
  private geocoder = inject(GeocodeService);

  readonly picker = input.required<LocationPicker>();

  readonly fitBoundsOptions = { padding: 40, maxZoom: 15 };

  readonly resizeHandle = viewChild(ResizeHandleDirective);

  private map?: MapLibreMap;
  private geocoderMap?: MapLibreMap;
  private markers = new Map<AbstractControl, Marker>();
  private watch?: Subscription;
  private picking = false;
  private lastActive?: AbstractControl;
  private lastActiveValue?: any;
  private redrawPending = false;
  private attribution?: CollapsedAttributionControl;

  private geocoding = false;
  private geocoderPosition?: GeocoderPosition;
  private removeGeocoder?: () => void;
  private removeGeoLayers?: () => void;
  private searchMarker?: Marker;
  private removeClick?: () => void;
  private releaseMouseUp?: () => void;
  private redrawTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.geocoder.config$.pipe(takeUntilDestroyed()).subscribe(config => {
      this.geocoding = isConfigured(config);
      if (this.geocoderPosition !== config.geocoderPosition) {
        this.removeGeocoder?.();
        this.removeGeocoder = undefined;
      }
      this.geocoderPosition = config.geocoderPosition;
      this.updateGeocoder();
    });
  }

  /**
   * Style the map is created with, centred on the active location.
   */
  readonly mapStyle = computed(() => {
    this.picker();
    return untracked(() => this.initialStyle());
  });

  private initialStyle() {
    const style = {
      ...this.admin.getTemplate('map')?.defaults?.mapStyle || mapTemplate.defaults?.mapStyle || {},
      ...this.admin.getTemplate('map')?.config?.mapStyle || mapTemplate.config?.mapStyle || {},
    };
    const location = this.center;
    if (location) {
      style.center = location;
      style.zoom = Math.max(style.zoom ?? 0, 10);
    }
    return style;
  }

  /**
   * Fit the map to the locations being edited, or to the Ref's other geo
   * plugins when no location is set.
   */
  readonly bounds = computed((): LngLatBounds | undefined => {
    this.picker();
    return untracked(() => {
      const bbox = locationBounds(this.locations.map(c => c.value))
        || locationBounds(this.contextData.features.map(f => (f.geometry as any).coordinates));
      return bbox ? new LngLatBounds([bbox[0], bbox[1]], [bbox[2], bbox[3]]) : undefined;
    });
  });

  get control(): AbstractControl {
    return this.picker().host.formControl!;
  }

  /**
   * The active location, or the first location set when none is active.
   */
  get center(): [number, number] | undefined {
    const active = this.picker().active?.value;
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
    preventSelectionDrag(map);
    this.addAttribution(map);
    this.removeClick?.();
    const targets = new WeakMap<MapMouseEvent, AbstractControl>();
    this.removeClick = onSingleClick(map, e => {
      const target = targets.get(e);
      if (!target || target !== this.picker().active || !this.locations.includes(target)) {
        this.updateMarkers();
        return;
      }
      this.mapClick(e);
    }, {
      // Move the marker right away, so placing it does not wait for the double click delay
      preview: e => {
        const target = this.clickTarget(e);
        if (target) targets.set(e, target);
        this.previewClick(e);
      },
      cancel: () => this.updateMarkers(),
    });
    map.addSource('location-context', { type: 'geojson', data: this.contextData });
    this.removeGeoLayers = addGeoLayers(map, 'location-context', 'location-context', 5);
    this.watch?.unsubscribe();
    this.watch = this.contextRoot.valueChanges.subscribe(() => this.update());
    this.watch.add(this.picker().changes.subscribe(() => this.update()));
    this.updateMarkers();
    this.styleLoaded(map);
    // The location may have changed while the map style was loading
    this.panToActive();
  }

  /**
   * The picker is small, so the attribution starts collapsed to the ⓘ button.
   * Added once the style loads, since slow tiles can delay the map load event.
   */
  /**
   * Add the address search as soon as the style is ready, without waiting for the tiles to load.
   */
  styleLoaded(map: MapLibreMap) {
    this.addAttribution(map);
    if (this.geocoderMap === map) return;
    this.removeGeocoder?.();
    this.removeGeocoder = undefined;
    this.geocoderMap = map;
    this.updateGeocoder();
  }

  addAttribution(map: MapLibreMap) {
    if (this.attribution) return;
    map.addControl(this.attribution = new CollapsedAttributionControl());
  }

  mapClick(event: MapMouseEvent) {
    const active = this.clickTarget(event);
    if (!active) return;
    const { lng, lat } = event.lngLat.wrap();
    this.pick(active, [lng, lat]);
  }

  private previewClick(event: MapMouseEvent) {
    const active = this.clickTarget(event);
    if (active && !active.disabled) this.markers.get(active)?.setLngLat(event.lngLat.wrap());
  }

  /**
   * The location moved by clicking the map.
   */
  private clickTarget(event: MapMouseEvent) {
    // Releasing the resize handle is not a click on the map
    if (this.resizeHandle()?.dragging()) return undefined;
    if ((event.originalEvent?.target as Element | undefined)?.closest?.('.maplibregl-marker')) return undefined;
    const active = this.picker().active;
    if (!active || !this.locations.includes(active)) return undefined;
    return active;
  }

  /**
   * Right click adds a point to the line, ring or multi point being edited,
   * without moving focus away from the map.
   */
  mapContextMenu(event: MapMouseEvent) {
    event.preventDefault();
    event.originalEvent?.preventDefault();
    const list = this.addTarget;
    if (!list) return;
    const { lng, lat } = event.lngLat.wrap();
    let model: any = [lng, lat];
    for (let d = 1; d < list.depth; d++) model = [model];
    this.picking = true;
    try {
      list.add(undefined, model);
      if (list.depth > 1) {
        // Select the first point of the new list so further points are added to it
        const target = this.picker().target;
        const added = target && leaves(target);
        if (added?.length) this.picker().select(added[added.length - 1]);
      }
    } finally {
      this.picking = false;
    }
  }

  /**
   * The list added while the map is open, otherwise the list of the active
   * location, otherwise the last list in this picker or in the Ref's geo
   * plugins.
   */
  private get addTarget(): LocationList | undefined {
    const target = this.picker().target;
    const added = target && attached(target, this.control) && locationLists.get(target);
    if (added) return added;
    const parent = this.picker().active?.parent;
    const active = parent && locationLists.get(parent);
    if (active) return active;
    for (const root of [this.control, this.contextRoot]) {
      const lists = this.locationLists(root);
      if (lists.length) return lists[lists.length - 1];
    }
    return undefined;
  }

  private locationLists(c: AbstractControl, out: LocationList[] = []) {
    const list = locationLists.get(c);
    if (list?.depth === 1) {
      out.push(list);
    } else if (c instanceof FormArray || c instanceof FormGroup) {
      for (const child of Object.values(c.controls) as AbstractControl[]) this.locationLists(child, out);
    }
    return out;
  }

  onMapError(event: any) {
    console.error('MapLibre Engine Error:', event.error);
  }

  private readonly cleanup = inject(DestroyRef).onDestroy(() => {
    clearTimeout(this.redrawTimer);
    this.watch?.unsubscribe();
    this.removeClick?.();
    this.removeClick = undefined;
    this.releaseMouseUp?.();
    this.removeGeoLayers?.();
    this.removeGeoLayers = undefined;
    this.removeGeocoder?.();
    this.removeGeocoder = undefined;
    this.geocoderMap = undefined;
    this.clearSearchResult();
    for (const marker of this.markers.values()) marker.remove();
    this.markers.clear();
    this.map = undefined;
  });

  private updateGeocoder() {
    if (this.geocoding && this.geocoderMap && !this.removeGeocoder) {
      this.removeGeocoder = addGeocoder(this.geocoderMap, this.geocoder, this.geocoderPosition,
        location => this.showSearchResult(location),
        () => this.clearSearchResult());
    } else if (!this.geocoding && this.removeGeocoder) {
      this.removeGeocoder();
      this.removeGeocoder = undefined;
      this.clearSearchResult();
    }
  }

  /**
   * Mark an address search result. Clicking the marker moves the active
   * location there.
   */
  private showSearchResult(location: [number, number]) {
    if (!this.map) return;
    this.clearSearchResult();
    const marker = new Marker({ color: '#e5a50a', className: 'geocode-marker' })
      .setLngLat(location)
      .addTo(this.map);
    const el = marker.getElement();
    const label = $localize`Move the location here`;
    el.title = label;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', label);
    el.tabIndex = 0;
    const activate = (e: Event) => {
      e.stopPropagation();
      this.clearSearchResult();
      const active = this.picker().active && this.locations.includes(this.picker().active!)
        ? this.picker().active
        : this.locations[0];
      if (active) this.pick(active, location);
    };
    el.addEventListener('click', activate);
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activate(e);
      }
    });
    this.searchMarker = marker;
  }

  private clearSearchResult() {
    this.searchMarker?.remove();
    this.searchMarker = undefined;
  }

  private select(control: AbstractControl) {
    this.picking = true;
    try {
      this.picker().select(control);
    } finally {
      this.picking = false;
    }
  }

  private pick(control: AbstractControl, value: [number, number]) {
    if (control.disabled) return;
    this.picking = true;
    try {
      this.picker().select(control);
      control.setValue(value);
      control.markAsDirty();
    } finally {
      this.picking = false;
    }
  }

  private update() {
    this.redraw();
    // Only pan when the location was changed outside the map (typing, geolocation)
    if (!this.picking) this.panToActive();
    // Adding or removing a location rebuilds the form array after notifying,
    // so redraw again once it has settled
    if (!this.redrawPending) {
      this.redrawPending = true;
      this.redrawTimer = setTimeout(() => {
        this.redrawPending = false;
        this.redraw();
      });
    }
  }

  private redraw() {
    this.updateMarkers();
    (this.map?.getSource('location-context') as GeoJSONSource | undefined)?.setData(this.contextData);
  }

  private panToActive() {
    const active = this.picker().active;
    const value = active?.value;
    const changed = active !== this.lastActive || !isEqual(value, this.lastActiveValue);
    this.lastActive = active;
    this.lastActiveValue = Array.isArray(value) ? [...value] : value;
    if (!this.map || !changed || !hasLocation(value)) return;
    // Keep the view steady while the location is already visible
    if (this.map.getBounds().contains([value[0], value[1]])) return;
    this.map.easeTo({ center: [value[0], value[1]], zoom: Math.max(this.map.getZoom(), 10) });
  }

  /**
   * Markers only end a drag on a mouseup inside the map, so pass on a
   * mouseup released anywhere else on the page.
   */
  private captureMouseUp() {
    const map = this.map;
    if (!map) return;
    this.releaseMouseUp?.();
    const doc = map.getContainer().ownerDocument;
    const up = (e: MouseEvent) => {
      this.releaseMouseUp?.();
      if (map.getCanvasContainer().contains(e.target as Node)) return;
      map.fire(new MapMouseEvent('mouseup', map, e));
    };
    doc.addEventListener('mouseup', up, true);
    this.releaseMouseUp = () => {
      doc.removeEventListener('mouseup', up, true);
      this.releaseMouseUp = undefined;
    };
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
        m.on('dragstart', () => this.select(control));
        m.on('dragend', () => {
          const { lng, lat } = m.getLngLat().wrap();
          this.pick(control, [lng, lat]);
        });
        m.getElement().addEventListener('click', () => this.select(control));
        m.getElement().addEventListener('mousedown', e => {
          if (e.button === 0) this.captureMouseUp();
        });
        this.markers.set(control, m);
      } else {
        marker.setLngLat([location[0], location[1]]);
      }
      marker.setDraggable(!control.disabled);
      if (control === this.picker().active) {
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
        // Unset [0, 0] locations are not drawn
        features.push(...geoFeatures(value, hasLocation));
      }
    }
    return { type: 'FeatureCollection', features };
  }
}

function leaves(c: AbstractControl, out: AbstractControl[] = []): AbstractControl[] {
  if (c instanceof FormArray || c instanceof FormGroup) {
    const children = Object.values(c.controls) as AbstractControl[];
    // The closing position of a ring mirrors the first and is not editable
    if (closedRings.has(c)) children.pop();
    for (const child of children) leaves(child, out);
  } else {
    out.push(c);
  }
  return out;
}

/**
 * The control is still part of the root form.
 */
function attached(c: AbstractControl, root: AbstractControl) {
  for (let p = c.parent; c !== root; c = p, p = p.parent) {
    if (!p || !(Object.values(p.controls) as AbstractControl[]).includes(c)) return false;
  }
  return true;
}

function isGeoPlugins(c: AbstractControl) {
  return c instanceof FormGroup && Object.keys(c.controls).some(k => k.startsWith('plugin/geo/'));
}

export { hasLocation };
