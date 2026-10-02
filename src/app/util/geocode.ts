export type GeocodingProvider = 'google' | 'photon' | 'osm';

export interface GeocodingConfig {
  geocodingProvider?: GeocodingProvider;
  googleMapsApiKey?: string;
  photonUrl?: string;
}

export interface GeocodeResult {
  name: string;
  /** [longitude, latitude] */
  location: [number, number];
}

export const DEFAULT_PHOTON_URL = 'https://photon.komoot.io';
export const GOOGLE_GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
export const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

const LIMIT = 5;

export function geocodeUrl(query: string, config: GeocodingConfig): string {
  const q = encodeURIComponent(query);
  switch (provider(config)) {
    case 'google':
      return `${GOOGLE_GEOCODE_URL}?address=${q}&key=${encodeURIComponent(googleKey(config))}`;
    case 'photon':
      return `${photonUrl(config)}/api/?q=${q}&limit=${LIMIT}`;
    default:
      return `${NOMINATIM_URL}/search?format=jsonv2&limit=${LIMIT}&q=${q}`;
  }
}

export function reverseGeocodeUrl([lng, lat]: [number, number], config: GeocodingConfig): string {
  switch (provider(config)) {
    case 'google':
      return `${GOOGLE_GEOCODE_URL}?latlng=${lat},${lng}&key=${encodeURIComponent(googleKey(config))}`;
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
      if (response?.status && response.status !== 'OK' && response.status !== 'ZERO_RESULTS') {
        throw response.error_message || response.status;
      }
      for (const r of Array.isArray(response?.results) ? response.results : []) {
        add(results, r?.formatted_address, r?.geometry?.location?.lng, r?.geometry?.location?.lat);
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
export async function geocode(query: string, config: GeocodingConfig, signal?: AbortSignal): Promise<GeocodeResult[]> {
  if (!query.trim()) return [];
  return parseGeocode(await get(geocodeUrl(query.trim(), config), signal), config);
}

/**
 * Find a readable address for a location.
 */
export async function reverseGeocode(location: [number, number], config: GeocodingConfig, signal?: AbortSignal): Promise<GeocodeResult | undefined> {
  return parseGeocode(await get(reverseGeocodeUrl(location, config), signal), config)[0];
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
