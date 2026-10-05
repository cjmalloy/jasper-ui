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
    + '<div class="maplibregl-ctrl-geocoder--result-address">' + escapeHtml(address.join(',').trim()) + '</div>'
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
    const bbox = viewBbox([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
    if (bbox) view.bbox = bbox;
    return view;
  } catch {
    return undefined;
  }
}

/**
 * Normalize map bounds, which may extend into world copies, to longitudes
 * in [-180, 180]. A view crossing the antimeridian has west > east.
 */
export function viewBbox([west, south, east, north]: number[]): GeocodeView['bbox'] {
  if (![west, south, east, north].every(n => isFinite(n))) return undefined;
  if (east < west) east += 360;
  south = clamp(south, -90, 90);
  north = clamp(north, -90, 90);
  if (south >= north || west === east) return undefined;
  if (east - west >= 360) return [-180, south, 180, north];
  const shift = Math.floor((west + 180) / 360) * 360;
  west -= shift;
  east -= shift;
  if (east > 180) east -= 360;
  return [west, south, east, north];
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
  // Fit to the placeholder once it has been laid out
  const measured = () => {
    if (el) measurePlaceholder(el);
    return !el || el.classList.contains('measured');
  };
  const resized = !measured() && window.ResizeObserver && new ResizeObserver(() => {
    if (measured()) resized?.disconnect();
  }) || undefined;
  resized?.observe(map.getContainer());
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
    resized?.disconnect();
    control.off('result', result);
    control.off('clear', clear);
    for (const e of events) el?.removeEventListener(e, stop);
    try {
      map.removeControl(control);
    } catch { }
  };
}

/**
 * Size the resting control to fit its placeholder, in whatever language it is.
 * The width is stored in em so it follows the control's responsive font size.
 */
export function measurePlaceholder(el: HTMLElement) {
  const input = el.querySelector<HTMLInputElement>('input');
  if (!input) return;
  if (!input.placeholder) {
    show(el, '0em');
    return;
  }
  const span = document.createElement('span');
  span.textContent = input.placeholder;
  span.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font:inherit';
  el.appendChild(span);
  const width = span.getBoundingClientRect().width;
  const fontSize = parseFloat(getComputedStyle(span).fontSize);
  span.remove();
  if (!width || !fontSize) return;
  show(el, Math.ceil(width / fontSize * 100) / 100 + 'em');
}

/**
 * Set the measured width, then enable the width transition.
 */
function show(el: HTMLElement, width: string) {
  el.style.setProperty('--map-geocoder-placeholder-width', width);
  if (el.classList.contains('measured')) return;
  // Apply the width before the transition is enabled, so it does not animate
  void el.offsetWidth;
  el.classList.add('measured');
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function escapeHtml(text: string) {
  const el = document.createElement('div');
  el.textContent = text;
  return el.innerHTML;
}
