/// <reference types="vitest/globals" />
import { geocode, geocodeUrl, isConfigured, parseGeocode, reverseGeocode, reverseGeocodeUrl, sortByDistance } from './geocode';

describe('geocode', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('checks if geocoding is configured', () => {
    expect(isConfigured({})).toBe(false);
    expect(isConfigured({ geocodingProvider: 'osm' })).toBe(true);
    expect(isConfigured({ geocodingProvider: 'photon' })).toBe(true);
    expect(isConfigured({ geocodingProvider: 'google' })).toBe(false);
    expect(isConfigured({ geocodingProvider: 'google', googleMapsApiKey: 'key' })).toBe(true);
  });

  it('defaults to Nominatim', () => {
    expect(geocodeUrl('Halifax, NS', {})).toBe('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=10&q=Halifax%2C%20NS');
    expect(reverseGeocodeUrl([-63.5, 44.6], {})).toBe('https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=44.6&lon=-63.5');
  });

  it('builds Photon URLs', () => {
    const config = { geocodingProvider: 'photon' as const, photonUrl: 'http://localhost:2322/' };
    expect(geocodeUrl('halifax', config)).toBe('http://localhost:2322/api/?q=halifax&limit=10');
    expect(reverseGeocodeUrl([-63.5, 44.6], config)).toBe('http://localhost:2322/reverse?lat=44.6&lon=-63.5');
    expect(geocodeUrl('halifax', { geocodingProvider: 'photon' })).toBe('https://photon.komoot.io/api/?q=halifax&limit=10');
  });

  it('builds Google URLs', () => {
    const config = { geocodingProvider: 'google' as const, googleMapsApiKey: 'key' };
    expect(geocodeUrl('halifax', config)).toBe('https://maps.googleapis.com/maps/api/geocode/json?address=halifax&key=key');
    expect(reverseGeocodeUrl([-63.5, 44.6], config)).toBe('https://maps.googleapis.com/maps/api/geocode/json?latlng=44.6,-63.5&key=key');
    expect(() => geocodeUrl('halifax', { geocodingProvider: 'google' })).toThrow();
  });

  it('parses Nominatim results', () => {
    expect(parseGeocode([{ display_name: 'Halifax', lat: '44.6', lon: '-63.5' }], {}))
      .toEqual([{ name: 'Halifax', location: [-63.5, 44.6] }]);
    expect(parseGeocode({ display_name: 'Halifax', lat: '44.6', lon: '-63.5' }, {}))
      .toEqual([{ name: 'Halifax', location: [-63.5, 44.6] }]);
    expect(parseGeocode({ error: 'Unable to geocode' }, {})).toEqual([]);
  });

  it('parses Photon GeoJSON', () => {
    const response = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-63.5, 44.6] },
        properties: { name: 'Citadel', housenumber: '5425', street: 'Sackville St', city: 'Halifax', state: 'Nova Scotia', country: 'Canada' },
      }],
    };
    expect(parseGeocode(response, { geocodingProvider: 'photon' }))
      .toEqual([{ name: 'Citadel, 5425 Sackville St, Halifax, Nova Scotia, Canada', location: [-63.5, 44.6] }]);
  });

  it('parses Google results', () => {
    const config = { geocodingProvider: 'google' as const, googleMapsApiKey: 'key' };
    const response = { status: 'OK', results: [{ formatted_address: 'Halifax, NS, Canada', geometry: { location: { lat: 44.6, lng: -63.5 } } }] };
    expect(parseGeocode(response, config)).toEqual([{ name: 'Halifax, NS, Canada', location: [-63.5, 44.6] }]);
    expect(parseGeocode({ status: 'ZERO_RESULTS', results: [] }, config)).toEqual([]);
    expect(() => parseGeocode({ status: 'REQUEST_DENIED', error_message: 'Bad key' }, config)).toThrow();
  });

  it('fetches without credentials', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([{ display_name: 'Halifax', lat: '44.6', lon: '-63.5' }]) });
    vi.stubGlobal('fetch', fetch);
    expect(await geocode('halifax', {})).toEqual([{ name: 'Halifax', location: [-63.5, 44.6] }]);
    expect(await reverseGeocode([-63.5, 44.6], {})).toEqual({ name: 'Halifax', location: [-63.5, 44.6] });
    expect(fetch.mock.calls[0][1].credentials).toBe('omit');
    expect(await geocode('  ', {})).toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('biases search URLs toward the view', () => {
    const view = { center: [-63.5, 44.6] as [number, number], bbox: [-64, 44, -63, 45] as [number, number, number, number] };
    expect(geocodeUrl('halifax', {}, view)).toBe('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=10&q=halifax&viewbox=-64,44,-63,45');
    expect(geocodeUrl('halifax', { geocodingProvider: 'photon' }, view)).toBe('https://photon.komoot.io/api/?q=halifax&limit=10&lat=44.6&lon=-63.5');
    expect(geocodeUrl('halifax', { geocodingProvider: 'google', googleMapsApiKey: 'key' }, view))
      .toBe('https://maps.googleapis.com/maps/api/geocode/json?address=halifax&key=key&bounds=44,-64|45,-63');
    expect(geocodeUrl('halifax', {}, { center: [-63.5, 44.6] })).toBe('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=10&q=halifax');
  });

  it('sorts results nearest first', () => {
    const far = { name: 'Halifax, UK', location: [-1.86, 53.72] as [number, number] };
    const near = { name: 'Halifax, NS', location: [-63.57, 44.65] as [number, number] };
    const near2 = { name: 'Also Halifax, NS', location: [-63.57, 44.65] as [number, number] };
    expect(sortByDistance([far, near, near2], [-63.5, 44.6])).toEqual([near, near2, far]);
    expect(sortByDistance([near2, far, near], [-63.5, 44.6])).toEqual([near2, near, far]);
  });

  it('sorts fetched results when given a view', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([
      { display_name: 'Halifax, UK', lat: '53.72', lon: '-1.86' },
      { display_name: 'Halifax, NS', lat: '44.65', lon: '-63.57' },
    ]) }));
    expect((await geocode('halifax', {}, undefined, { center: [-63.5, 44.6] })).map(r => r.name)).toEqual(['Halifax, NS', 'Halifax, UK']);
  });
});
