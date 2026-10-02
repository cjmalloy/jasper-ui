import MaplibreGeocoder, { type CarmenGeojsonFeature, type MaplibreGeocoderSuggestion } from '@maplibre/maplibre-gl-geocoder';
import type { Map } from 'maplibre-gl';
import { GeocodeService } from '../../service/geocode.service';
import { GeocodeResult } from '../../util/geocode';

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
 * Add an address search control to the map. Choosing a result only moves the map.
 * Returns a function to remove the control.
 */
export function addGeocoder(map: Map, geocoder: GeocodeService): () => void {
  const control = new MaplibreGeocoder({
    // All results come from the externalGeocoder
    forwardGeocode: async () => ({ type: 'FeatureCollection', features: [] }),
  }, {
    externalGeocoder: async query => {
      try {
        return toFeatureCollection(await geocoder.geocode(query)).features;
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
  });
  map.addControl(control, 'top-left');
  const el = map.getContainer().querySelector<HTMLElement>('.maplibregl-ctrl-geocoder');
  // Keep events from reaching the map or any form the map is in
  const stop = (e: Event) => {
    e.stopPropagation();
    if (e instanceof KeyboardEvent && e.key === 'Enter') e.preventDefault();
  };
  const events = ['mousedown', 'touchstart', 'dblclick', 'wheel', 'keydown'];
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
    for (const e of events) el?.removeEventListener(e, stop);
    try {
      map.removeControl(control);
    } catch { }
  };
}

function escapeHtml(text: string) {
  const el = document.createElement('div');
  el.textContent = text;
  return el.innerHTML;
}
