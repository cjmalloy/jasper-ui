/// <reference types="vitest/globals" />
import type { Map } from 'maplibre-gl';
import { GeocodeService } from '../../service/geocode.service';
import { addGeocoder, isDarkBasemap, renderResult, toFeatureCollection } from './geocoder';

describe('geocoder', () => {

  it('maps results to GeoJSON features', () => {
    expect(toFeatureCollection([{ name: 'Halifax', location: [-63.57, 44.65] }])).toEqual({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        text: 'Halifax',
        place_name: 'Halifax',
        place_type: ['place'],
        center: [-63.57, 44.65],
        properties: {},
        geometry: { type: 'Point', coordinates: [-63.57, 44.65] },
      }],
    });
  });

  it('escapes provider text when rendering results', () => {
    const [feature] = toFeatureCollection([{ name: '<img src=x onerror=alert(1)>, Halifax', location: [0, 1] }]).features;
    const el = document.createElement('div');
    el.innerHTML = renderResult(feature);
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('.maplibregl-ctrl-geocoder--result-title')?.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(el.querySelector('.maplibregl-ctrl-geocoder--result-address')?.textContent).toBe(' Halifax');
  });

  it('detects dark basemaps', () => {
    expect(isDarkBasemap({ name: 'Dark Matter' })).toBe(true);
    expect(isDarkBasemap({ name: 'Esri Satellite' })).toBe(true);
    expect(isDarkBasemap({ name: 'Google Hybrid' })).toBe(true);
    expect(isDarkBasemap({ name: 'OSM Liberty' })).toBe(false);
    expect(isDarkBasemap(undefined)).toBe(false);
  });

  it('adds the control top left and tracks the basemap theme', () => {
    const container = document.createElement('div');
    const listeners: Record<string, Function> = {};
    let style = { name: 'Dark Matter' };
    const map = {
      getContainer: () => container,
      getStyle: () => style,
      on: vi.fn((e: string, fn: Function) => listeners[e] = fn),
      off: vi.fn(),
      addControl: vi.fn((control: any, position: string) => container.appendChild(control.onAdd(map))),
      removeControl: vi.fn((control: any) => control.onRemove()),
    };
    const remove = addGeocoder(map as unknown as Map, {} as GeocodeService);
    expect(map.addControl).toHaveBeenCalledWith(expect.anything(), 'top-left');
    const el = container.querySelector('.maplibregl-ctrl-geocoder')!;
    expect(el.getAttribute('data-theme')).toBe('dark');
    style = { name: 'OSM Liberty' };
    listeners['styledata']();
    expect(el.hasAttribute('data-theme')).toBe(false);
    remove();
    expect(map.off).toHaveBeenCalledWith('styledata', listeners['styledata']);
    expect(map.removeControl).toHaveBeenCalled();
  });
});
