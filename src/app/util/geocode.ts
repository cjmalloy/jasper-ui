/// <reference types="google.maps" />
export type GeocodingProvider = 'google' | 'photon' | 'osm';
export type GeocoderPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface GeocodingConfig {
  geocodingProvider?: GeocodingProvider;
  googleMapsApiKey?: string;
  photonUrl?: string;
  geocoderPosition?: GeocoderPosition;
}

export interface GeocodeResult {
  name: string;
  /** [longitude, latitude] */
  location: [number, number];
}

export interface GeocodeView {
  /** [longitude, latitude] */
  center: [number, number];
  /**
   * [west, south, east, north] with longitudes in [-180, 180].
   * When the view crosses the antimeridian west > east.
   */
  bbox?: [number, number, number, number];
}

export const DEFAULT_PHOTON_URL = 'https://photon.komoot.io';
export const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

const LIMIT = 10;
/** Nominatim usage policy allows at most 1 request per second. */
const NOMINATIM_INTERVAL = 1_000;
const NOMINATIM_CACHE_SIZE = 100;

/**
 * URL for the web service providers. Google is called through the Maps
 * JavaScript API SDK instead, since its web service does not support CORS.
 */
export function geocodeUrl(query: string, config: GeocodingConfig, view?: GeocodeView): string {
  const q = encodeURIComponent(query);
  const bbox = view?.bbox;
  switch (provider(config)) {
    case 'photon':
      return `${photonUrl(config)}/api/?q=${q}&limit=${LIMIT}`
        + (view ? `&lat=${view.center[1]}&lon=${view.center[0]}` : '');
    default:
      return `${NOMINATIM_URL}/search?format=jsonv2&limit=${LIMIT}&q=${q}`
        // Nominatim viewboxes cannot cross the antimeridian
        + (bbox && bbox[0] <= bbox[2] ? `&viewbox=${bbox.join(',')}` : '');
  }
}

export function reverseGeocodeUrl([lng, lat]: [number, number], config: GeocodingConfig): string {
  switch (provider(config)) {
    case 'photon':
      return `${photonUrl(config)}/reverse?lat=${lat}&lon=${lng}`;
    default:
      return `${NOMINATIM_URL}/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
  }
}

/**
 * Convert a provider response into results.
 */
export function parseGeocode(response: any, config: GeocodingConfig): GeocodeResult[] {
  const results: GeocodeResult[] = [];
  switch (provider(config)) {
    case 'google':
      for (const r of Array.isArray(response?.results) ? response.results : []) {
        const l = r?.geometry?.location;
        add(results, r?.formatted_address, typeof l?.lng === 'function' ? l.lng() : l?.lng, typeof l?.lat === 'function' ? l.lat() : l?.lat);
      }
      break;
    case 'photon':
      for (const f of Array.isArray(response?.features) ? response.features : []) {
        const c = f?.geometry?.type === 'Point' ? f.geometry.coordinates : undefined;
        add(results, photonName(f?.properties), c?.[0], c?.[1]);
      }
      break;
    default:
      for (const r of Array.isArray(response) ? response : response ? [response] : []) {
        if (r?.error) continue;
        add(results, r?.display_name, parseFloat(r?.lon), parseFloat(r?.lat));
      }
  }
  return results;
}

/**
 * Find locations matching an address or place name.
 */
export async function geocode(query: string, config: GeocodingConfig, signal?: AbortSignal, view?: GeocodeView): Promise<GeocodeResult[]> {
  if (!query.trim()) return [];
  const response = provider(config) === 'google'
    ? await googleGeocode(config, signal, { address: query.trim(), ...view?.bbox ? { bounds: bounds(view.bbox) } : {} })
    : await fetchGeocode(geocodeUrl(query.trim(), config, view), signal);
  const results = parseGeocode(response, config);
  return view ? sortByDistance(results, view.center) : results;
}

/**
 * Sort results nearest first by great-circle distance. Ties keep the
 * provider's order.
 */
export function sortByDistance(results: GeocodeResult[], center: [number, number]): GeocodeResult[] {
  return results
    .map((r, i) => ({ r, i, d: distance(r.location, center) }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .map(({ r }) => r);
}

/**
 * Find a readable address for a location.
 */
export async function reverseGeocode(location: [number, number], config: GeocodingConfig, signal?: AbortSignal): Promise<GeocodeResult | undefined> {
  const response = provider(config) === 'google'
    ? await googleGeocode(config, signal, { location: { lng: location[0], lat: location[1] } })
    : await fetchGeocode(reverseGeocodeUrl(location, config), signal);
  return parseGeocode(response, config)[0];
}

/**
 * Has a geocoding provider been set up.
 */
export function isConfigured(config: GeocodingConfig) {
  if (!config.geocodingProvider) return false;
  return provider(config) !== 'google' || !!config.googleMapsApiKey;
}

/**
 * Haversine distance in radians.
 */
function distance([lng1, lat1]: [number, number], [lng2, lat2]: [number, number]) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function provider(config: GeocodingConfig): GeocodingProvider {
  if (config.geocodingProvider === 'google' || config.geocodingProvider === 'photon') return config.geocodingProvider;
  return 'osm';
}

function googleKey(config: GeocodingConfig) {
  if (!config.googleMapsApiKey) throw $localize`Google Maps API key is not configured.`;
  return config.googleMapsApiKey;
}

function photonUrl(config: GeocodingConfig) {
  return (config.photonUrl || DEFAULT_PHOTON_URL).replace(/\/+$/, '');
}

function photonName(p: any): string {
  if (!p) return '';
  const street = [p.housenumber, p.street].filter(s => !!s).join(' ');
  const parts = [p.name, street, p.city || p.district || p.locality, p.state, p.country];
  return parts.filter((s, i) => !!s && parts.indexOf(s) === i).join(', ');
}

function add(results: GeocodeResult[], name: any, lng: any, lat: any) {
  if (typeof lng !== 'number' || typeof lat !== 'number' || !isFinite(lng) || !isFinite(lat)) return;
  results.push({ name: typeof name === 'string' && name ? name : `${lat}, ${lng}`, location: [lng, lat] });
}

/**
 * Google bounds cross the antimeridian when west > east.
 */
function bounds([west, south, east, north]: [number, number, number, number]) {
  return { west, south, east, north };
}

let googleLoaded = false;

/**
 * Geocode with the Maps JavaScript API SDK. The API key is set on first use,
 * changing it requires reloading the page.
 */
async function googleGeocode(config: GeocodingConfig, signal: AbortSignal | undefined, request: google.maps.GeocoderRequest): Promise<any> {
  const key = googleKey(config);
  signal?.throwIfAborted();
  const { importLibrary, setOptions } = await import('@googlemaps/js-api-loader');
  if (!googleLoaded) {
    setOptions({ key, v: 'weekly' });
    googleLoaded = true;
  }
  const { Geocoder } = await importLibrary('geocoding');
  signal?.throwIfAborted();
  const response = await new Geocoder().geocode(request).catch((e: any) => {
    if (e?.code === 'ZERO_RESULTS') return { results: [] };
    throw e?.message || e?.code || e;
  });
  signal?.throwIfAborted();
  return response;
}

const nominatimCache = new Map<string, any>();
let nominatimQueue: Promise<void> = Promise.resolve();
let nominatimLast = 0;

/**
 * Clear the Nominatim cache and rate limit.
 */
export function resetNominatim() {
  nominatimCache.clear();
  nominatimQueue = Promise.resolve();
  nominatimLast = 0;
}

/**
 * Requests to the public Nominatim service are cached and throttled to
 * 1 request per second as required by its usage policy.
 */
async function fetchGeocode(url: string, signal?: AbortSignal): Promise<any> {
  if (!url.startsWith(NOMINATIM_URL + '/')) return get(url, signal);
  if (nominatimCache.has(url)) {
    const cached = nominatimCache.get(url);
    nominatimCache.delete(url);
    nominatimCache.set(url, cached);
    return cached;
  }
  await nominatimTurn(signal);
  const response = await get(url, signal);
  nominatimCache.set(url, response);
  if (nominatimCache.size > NOMINATIM_CACHE_SIZE) nominatimCache.delete(nominatimCache.keys().next().value!);
  return response;
}

/**
 * Wait until a Nominatim request is allowed. Aborted requests give up their
 * place in line without using up a request.
 */
function nominatimTurn(signal?: AbortSignal): Promise<void> {
  const turn = nominatimQueue.then(async () => {
    signal?.throwIfAborted();
    const wait = nominatimLast + NOMINATIM_INTERVAL - Date.now();
    if (wait > 0) await sleep(wait, signal);
    nominatimLast = Date.now();
  });
  nominatimQueue = turn.catch(() => {});
  return turn;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(signal!.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', abort, { once: true });
  });
}

/**
 * Uses fetch directly instead of HttpClient so the Jasper auth headers added by
 * interceptors are never sent to third party geocoders.
 */
async function get(url: string, signal?: AbortSignal): Promise<any> {
  const res = await fetch(url, {
    signal,
    credentials: 'omit',
    referrerPolicy: 'strict-origin-when-cross-origin',
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) throw `${res.status} ${res.statusText}`;
  return res.json();
}
