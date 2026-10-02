import { geoCenter, geoFeatures, isLinearRing } from './geo';

describe('geo', () => {
  describe('isLinearRing', () => {
    it('requires a closed ring with four or more positions', () => {
      expect(isLinearRing([[0, 0], [1, 0], [1, 1], [0, 0]])).toBe(true);
      expect(isLinearRing([[0, 0], [1, 0], [1, 1]])).toBe(false);
      expect(isLinearRing([[0, 0], [1, 0], [0, 0]])).toBe(false);
      expect(isLinearRing([[0, 0], [1, 0], [1, 1], [0, 1]])).toBe(false);
    });
  });

  describe('geoFeatures', () => {
    const polygon = (coordinates: any) => ({ type: 'Feature', geometry: { type: 'Polygon', coordinates } });

    it('renders closed rings as polygons unchanged', () => {
      const ring = [[0, 0], [1, 0], [1, 1], [0, 0]];
      expect(geoFeatures(polygon([ring])).map(f => f.geometry)).toEqual([{ type: 'Polygon', coordinates: [ring] }]);
    });

    it('does not auto close rings', () => {
      const ring = [[0, 0], [1, 0], [1, 1], [0, 1]];
      expect(geoFeatures(polygon([ring])).map(f => f.geometry)).toEqual([{ type: 'LineString', coordinates: ring }]);
    });

    it('keeps closed rings when a hole is incomplete', () => {
      const ring = [[0, 0], [4, 0], [4, 4], [0, 0]];
      expect(geoFeatures(polygon([ring, [[1, 1]]])).map(f => f.geometry)).toEqual([
        { type: 'Polygon', coordinates: [ring] },
        { type: 'MultiPoint', coordinates: [[1, 1]] },
      ]);
    });

    it('renders incomplete parts as points', () => {
      expect(geoFeatures(polygon([[[0, 0]]])).map(f => f.geometry)).toEqual([{ type: 'MultiPoint', coordinates: [[0, 0]] }]);
    });

    it('flattens multi polygons', () => {
      const ring = [[0, 0], [1, 0], [1, 1], [0, 0]];
      const result = geoFeatures({ type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: [[ring], [[[5, 5], [6, 6]]]] } });
      expect(result.map(f => f.geometry)).toEqual([
        { type: 'Polygon', coordinates: [ring] },
        { type: 'LineString', coordinates: [[5, 5], [6, 6]] },
      ]);
    });
  });

  it('skips positions rejected by the filter', () => {
    const unset = (p: any): p is [number, number] => Array.isArray(p) && (p[0] !== 0 || p[1] !== 0);
    const features = geoFeatures({ geometry: { type: 'LineString', coordinates: [[1, 1], [2, 2], [0, 0]] } }, unset);
    expect(features.map(f => f.geometry)).toEqual([{ type: 'LineString', coordinates: [[1, 1], [2, 2]] }]);
  });

  it('centres on the bounds of all geo plugins', () => {
    expect(geoCenter({
      'plugin/geo/point': { geometry: { type: 'Point', coordinates: [-64, 44] } },
      'plugin/geo/linestring': { geometry: { type: 'LineString', coordinates: [[-62, 46], [0, 0]] } },
      'plugin/map': { bbox: [100, 100, 100, 100] },
    })).toEqual([-63, 45]);
    expect(geoCenter({ 'plugin/geo/point': { geometry: { type: 'Point', coordinates: [0, 0] } } })).toBeUndefined();
    expect(geoCenter(undefined)).toBeUndefined();
  });
});
