import MaplibreGeocoder, { type CarmenGeojsonFeature, type MaplibreGeocoderSuggestion } from '@maplibre/maplibre-gl-geocoder';
import type { Map } from 'maplibre-gl';
import { Ext } from '../../model/ext';
import { GeocodeService } from '../../service/geocode.service';
import { isPosition } from '../../util/geo';
import { GeocodeResult, GeocoderPosition, GeocodeView } from '../../util/geocode';

const DARK_BASEMAP = /dark|satellite|hybrid/i;

/**
 * Convert geocode results into the GeoJSON used by the geocoder control.
 */
export function toFeatureCollection(results: GeocodeResult[]) {
  return {
    type: 'FeatureCollection' as const,
    features: results.map(item => ({
      type: 'Feature',
      text: item.name,
      place_name: item.name,
      place_type: ['place'],
      center: item.location,
      properties: {},
      geometry: { type: 'Point', coordinates: item.location },
    }) as CarmenGeojsonFeature),
  };
}

/**
 * Render a result without trusting the provider's text as HTML.
 */
export function renderResult(item: CarmenGeojsonFeature | MaplibreGeocoderSuggestion) {
  const [title, ...address] = ('place_name' in item && item.place_name || item.text || '').split(',');
  return '<div class="maplibregl-ctrl-geocoder--result">'
    + '<div class="maplibregl-ctrl-geocoder--result-title">' + escapeHtml(title) + '</div>'
    + '<div class="maplibregl-ctrl-geocoder--result-address">' + escapeHtml(address.join(',')) + '</div>'
    + '</div>';
}

/**
 * Is the basemap style dark enough that the geocoder should be dark as well.
 */
export function isDarkBasemap(style?: { name?: string }) {
  return DARK_BASEMAP.test(style?.name || '');
}

/**
 * The current map view, used to bias geocoding results.
 */
export function currentView(map: Map): GeocodeView | undefined {
  try {
    const c = map.getCenter().wrap();
    const view: GeocodeView = { center: [c.lng, c.lat] };
    const b = map.getBounds();
    const west = clamp(b.getWest(), -180, 180);
    const east = clamp(b.getEast(), -180, 180);
    const south = clamp(b.getSouth(), -90, 90);
    const north = clamp(b.getNorth(), -90, 90);
    if (west < east) view.bbox = [west, south, east, north];
    return view;
  } catch {
    return undefined;
  }
}

/**
 * Add an address search control to the map. Choosing a result moves the map
 * and calls onResult with the location found.
 * Searches use the geocoding config of the map's Ext, if given.
 * Returns a function to remove the control.
 */
export function addGeocoder(
  map: Map,
  geocoder: GeocodeService,
  position: GeocoderPosition = 'top-left',
  onResult?: (location: [number, number], name: string) => void,
  onClear?: () => void,
  ext?: () => Ext | undefined,
): () => void {
  const control = new MaplibreGeocoder({
    // All results come from the externalGeocoder
    forwardGeocode: async () => ({ type: 'FeatureCollection', features: [] }),
  }, {
    externalGeocoder: async query => {
      try {
        return toFeatureCollection(await geocoder.geocode(query, undefined, currentView(map), ext?.())).features;
      } catch (e) {
        console.error('Geocoding error:', e);
        throw e;
      }
    },
    render: renderResult,
    placeholder: $localize`Search address`,
    zoom: 14,
    showResultMarkers: false,
    marker: false,
    popup: false,
    clearAndBlurOnEsc: true,
    trackProximity: false,
    showResultsWhileTyping: false,
  });
  const result = ({ result }: { result: CarmenGeojsonFeature }) => {
    const location = result?.center || (result?.geometry as any)?.coordinates;
    if (!isPosition(location)) return;
    onResult?.([location[0], location[1]], result.place_name || result.text || '');
  };
  const clear = () => onClear?.();
  control.on('result', result);
  control.on('clear', clear);
  map.addControl(control, position);
  const el = map.getContainer().querySelector<HTMLElement>('.maplibregl-ctrl-geocoder');
  // Keep events from reaching the map or any form the map is in
  const stop = (e: Event) => {
    e.stopPropagation();
    if (e instanceof KeyboardEvent && e.key === 'Enter') e.preventDefault();
  };
  const events = ['mousedown', 'touchstart', 'dblclick', 'wheel', 'keydown', 'focusout'];
  for (const e of events) el?.addEventListener(e, stop);
  const theme = () => {
    let style;
    try {
      style = map.getStyle();
    } catch { }
    if (isDarkBasemap(style)) {
      el?.setAttribute('data-theme', 'dark');
    } else {
      el?.removeAttribute('data-theme');
    }
  };
  map.on('styledata', theme);
  theme();
  return () => {
    map.off('styledata', theme);
    control.off('result', result);
    control.off('clear', clear);
    for (const e of events) el?.removeEventListener(e, stop);
    try {
      map.removeControl(control);
    } catch { }
  };
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function escapeHtml(text: string) {
  const el = document.createElement('div');
  el.textContent = text;
  return el.innerHTML;
}
