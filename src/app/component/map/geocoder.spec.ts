/// <reference types="vitest/globals" />
import type { Map } from 'maplibre-gl';
import { GeocodeService } from '../../service/geocode.service';
import { addGeocoder, currentView, isDarkBasemap, renderResult, toFeatureCollection } from './geocoder';

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

  it('uses the configured position and reports results', () => {
    const container = document.createElement('div');
    let control: any;
    const map = {
      getContainer: () => container,
      getStyle: () => ({}),
      on: vi.fn(),
      off: vi.fn(),
      addControl: vi.fn((c: any) => container.appendChild((control = c).onAdd(map))),
      removeControl: vi.fn((c: any) => c.onRemove()),
    };
    const onResult = vi.fn();
    const onClear = vi.fn();
    const remove = addGeocoder(map as unknown as Map, {} as GeocodeService, 'top-right', onResult, onClear);
    expect(map.addControl).toHaveBeenCalledWith(expect.anything(), 'top-right');
    const [feature] = toFeatureCollection([{ name: 'Halifax', location: [-63.57, 44.65] }]).features;
    control._eventEmitter.emit('result', { result: feature });
    expect(onResult).toHaveBeenCalledWith([-63.57, 44.65], 'Halifax');
    control._eventEmitter.emit('clear');
    expect(onClear).toHaveBeenCalled();
    remove();
    control._eventEmitter.emit('result', { result: feature });
    expect(onResult).toHaveBeenCalledTimes(1);
  });

  it('gets the current view', () => {
    const map = (center: [number, number], [w, s, e, n]: number[]) => ({
      getCenter: () => ({ wrap: () => ({ lng: center[0], lat: center[1] }) }),
      getBounds: () => ({ getWest: () => w, getSouth: () => s, getEast: () => e, getNorth: () => n }),
    }) as unknown as Map;
    expect(currentView(map([-63.5, 44.6], [-64, 44, -63, 45]))).toEqual({ center: [-63.5, 44.6], bbox: [-64, 44, -63, 45] });
    expect(currentView(map([0, 0], [-200, -95, 200, 95]))).toEqual({ center: [0, 0], bbox: [-180, -90, 180, 90] });
    expect(currentView(map([0, 0], [170, -10, 190, 10]))).toEqual({ center: [0, 0] });
    expect(currentView(map([0, 0], [190, -10, 200, 10]))).toEqual({ center: [0, 0] });
    // Inverted bbox across the antimeridian is left out
    expect(currentView(map([180, 0], [170, -10, -170, 10]))).toEqual({ center: [180, 0] });
    expect(currentView({ getCenter: () => { throw new Error('not loaded'); } } as unknown as Map)).toBeUndefined();
  });

  it('reads the view at search time', async () => {
    const container = document.createElement('div');
    let control: any;
    let center: [number, number] = [0, 0];
    const map = {
      getContainer: () => container,
      getStyle: () => ({}),
      getCenter: () => ({ wrap: () => ({ lng: center[0], lat: center[1] }) }),
      getBounds: () => ({ getWest: () => center[0] - 1, getSouth: () => center[1] - 1, getEast: () => center[0] + 1, getNorth: () => center[1] + 1 }),
      on: vi.fn(),
      off: vi.fn(),
      addControl: vi.fn((c: any) => container.appendChild((control = c).onAdd(map))),
      removeControl: vi.fn((c: any) => c.onRemove()),
    };
    const geocode = vi.fn().mockResolvedValue([]);
    const remove = addGeocoder(map as unknown as Map, { geocode } as unknown as GeocodeService);
    center = [-63.5, 44.6];
    await control.options.externalGeocoder('halifax');
    expect(geocode).toHaveBeenCalledWith('halifax', undefined, { center: [-63.5, 44.6], bbox: [-64.5, 43.6, -62.5, 45.6] }, undefined);
    remove();
  });
});
