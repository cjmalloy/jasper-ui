/// <reference types="vitest/globals" />
import { geocode, geocodeUrl, isConfigured, parseGeocode, resetNominatim, reverseGeocode, reverseGeocodeUrl, sortByDistance } from './geocode';

describe('geocode', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    resetNominatim();
  });

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

  it('geocodes with the Google Maps JavaScript API', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const location = { lat: () => 44.6, lng: () => -63.5 };
    const geocodeFn = vi.fn()
      .mockResolvedValueOnce({ results: [{ formatted_address: 'Halifax, NS, Canada', geometry: { location } }] })
      .mockResolvedValueOnce({ results: [] })
      .mockResolvedValueOnce({ results: [{ formatted_address: 'Halifax, NS, Canada', geometry: { location } }] })
      .mockRejectedValueOnce({ code: 'ZERO_RESULTS' })
      .mockRejectedValueOnce({ code: 'REQUEST_DENIED', message: 'Bad key' });
    const importLibrary = vi.fn().mockResolvedValue({ Geocoder: class { geocode = geocodeFn; } });
    vi.stubGlobal('google', { maps: { importLibrary } });
    const config = { geocodingProvider: 'google' as const, googleMapsApiKey: 'key' };
    const view = { center: [-63.5, 44.6] as [number, number], bbox: [-64, 44, -63, 45] as [number, number, number, number] };
    expect(await geocode('halifax', config, undefined, view)).toEqual([{ name: 'Halifax, NS, Canada', location: [-63.5, 44.6] }]);
    expect(geocodeFn).toHaveBeenLastCalledWith({ address: 'halifax', bounds: { west: -64, south: 44, east: -63, north: 45 } });
    await geocode('fiji', config, undefined, { center: [180, 0], bbox: [170, -10, -170, 10] });
    expect(geocodeFn).toHaveBeenLastCalledWith({ address: 'fiji', bounds: { west: 170, south: -10, east: -170, north: 10 } });
    expect(await reverseGeocode([-63.5, 44.6], config)).toEqual({ name: 'Halifax, NS, Canada', location: [-63.5, 44.6] });
    expect(geocodeFn).toHaveBeenLastCalledWith({ location: { lng: -63.5, lat: 44.6 } });
    expect(await geocode('nowhere', config)).toEqual([]);
    await expect(geocode('halifax', config)).rejects.toBe('Bad key');
    await expect(geocode('halifax', { geocodingProvider: 'google' })).rejects.toBeTruthy();
    expect(importLibrary).toHaveBeenCalledWith('geocoding');
    expect(fetch).not.toHaveBeenCalled();
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
    const response = { results: [{ formatted_address: 'Halifax, NS, Canada', geometry: { location: { lat: () => 44.6, lng: () => -63.5 } } }] };
    expect(parseGeocode(response, config)).toEqual([{ name: 'Halifax, NS, Canada', location: [-63.5, 44.6] }]);
    expect(parseGeocode({ results: [] }, config)).toEqual([]);
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
    // Nominatim viewboxes cannot cross the antimeridian
    expect(geocodeUrl('fiji', {}, { center: [180, 0], bbox: [170, -10, -170, 10] })).toBe('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=10&q=fiji');
    expect(geocodeUrl('halifax', {}, { center: [-63.5, 44.6] })).toBe('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=10&q=halifax');
    expect(geocodeUrl('halifax', { geocodingProvider: 'photon' })).toBe('https://photon.komoot.io/api/?q=halifax&limit=10');
    expect(geocodeUrl('halifax', {})).toBe('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=10&q=halifax');
    // Nominatim never restricts results to the view
    for (const v of [undefined, view, { center: view.center }]) {
      expect(geocodeUrl('halifax', {}, v)).not.toContain('bounded=1');
    }
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

  it('caches and rate limits Nominatim', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([{ display_name: 'Halifax', lat: '44.6', lon: '-63.5' }]) });
    vi.stubGlobal('fetch', fetch);
    await geocode('halifax', {});
    expect(fetch).toHaveBeenCalledTimes(1);
    await geocode('halifax', {});
    expect(fetch).toHaveBeenCalledTimes(1);
    const second = geocode('dartmouth', {});
    await vi.advanceTimersByTimeAsync(500);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(500);
    await second;
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not use a Nominatim request when aborted while waiting', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });
    vi.stubGlobal('fetch', fetch);
    await geocode('a', {});
    const controller = new AbortController();
    const aborted = geocode('b', {}, controller.signal);
    const next = geocode('c', {});
    controller.abort('cancel');
    await expect(aborted).rejects.toBe('cancel');
    await vi.advanceTimersByTimeAsync(1_000);
    await next;
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1][0]).toContain('q=c');
  });

  it('does not rate limit Photon', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ features: [] }) });
    vi.stubGlobal('fetch', fetch);
    await geocode('a', { geocodingProvider: 'photon' });
    await geocode('a', { geocodingProvider: 'photon' });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
