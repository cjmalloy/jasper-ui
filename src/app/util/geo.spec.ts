import { convertFeature, convertGeometry, geoCenter, geoFeatures, isLinearRing, locationBounds } from './geo';

describe('geo', () => {
  describe('locationBounds', () => {
    it('bounds every nested location, ignoring unset locations', () => {
      expect(locationBounds([[[-63.5, 44.6], [0, 0], [-63.4, 44.7]], [-63.45, 44.65]])).toEqual([-63.5, 44.6, -63.4, 44.7]);
    });

    it('crosses the antimeridian', () => {
      expect(locationBounds([[179, 1], [-179, 2]])).toEqual([179, 1, 181, 2]);
    });

    it('is undefined without a location', () => {
      expect(locationBounds([[0, 0]])).toBeUndefined();
    });
  });

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
      'plugin/geo': { bbox: [100, 100, 100, 100] },
    })).toEqual([-63, 45]);
    expect(geoCenter({ 'plugin/geo/point': { geometry: { type: 'Point', coordinates: [0, 0] } } })).toBeUndefined();
    expect(geoCenter(undefined)).toBeUndefined();
  });

  it('centres across the antimeridian', () => {
    expect(geoCenter({
      'plugin/geo/linestring': { geometry: { type: 'LineString', coordinates: [[179, 10], [-179, 20]] } },
    })).toEqual([180, 15]);
    expect(geoCenter({
      'plugin/geo/linestring': { geometry: { type: 'LineString', coordinates: [[170, 10], [-160, 20]] } },
    })).toEqual([-175, 15]);
  });

  describe('convertGeometry', () => {
    const ring = [[0, 0], [1, 0], [1, 1], [0, 0]];
    const open = [[0, 0], [1, 0], [1, 1]];

    it('keeps the first polygon of a multi polygon', () => {
      expect(convertGeometry({ type: 'MultiPolygon', coordinates: [[ring], [[[5, 5]]]] }, 'Polygon'))
        .toEqual({ type: 'Polygon', coordinates: [ring] });
      expect(convertGeometry({ type: 'Polygon', coordinates: [ring] }, 'MultiPolygon'))
        .toEqual({ type: 'MultiPolygon', coordinates: [[ring]] });
    });

    it('makes a polygon of a single point', () => {
      expect(convertGeometry({ type: 'Point', coordinates: [1, 2] }, 'Polygon'))
        .toEqual({ type: 'Polygon', coordinates: [[[1, 2]]] });
    });

    it('does not keep an unset point', () => {
      expect(convertGeometry({ type: 'Point', coordinates: [0, 0] }, 'LineString'))
        .toEqual({ type: 'LineString', coordinates: [] });
      expect(convertGeometry({ type: 'LineString', coordinates: [] }, 'Point'))
        .toEqual({ type: 'Point', coordinates: [0, 0] });
    });

    it('treats lines as unclosed polygon rings', () => {
      expect(convertGeometry({ type: 'LineString', coordinates: open }, 'Polygon'))
        .toEqual({ type: 'Polygon', coordinates: [ring] });
      expect(convertGeometry({ type: 'Polygon', coordinates: [ring, [[5, 5]]] }, 'LineString'))
        .toEqual({ type: 'LineString', coordinates: open });
      expect(convertGeometry({ type: 'Polygon', coordinates: [ring] }, 'MultiLineString'))
        .toEqual({ type: 'MultiLineString', coordinates: [open] });
    });

    it('keeps every position in a multi point', () => {
      expect(convertGeometry({ type: 'Polygon', coordinates: [ring, [[5, 5]]] }, 'MultiPoint'))
        .toEqual({ type: 'MultiPoint', coordinates: [...open, [5, 5]] });
    });

    it('converts from geometry collections', () => {
      const point = { type: 'Point', coordinates: [1, 2] };
      const line = { type: 'LineString', coordinates: open };
      const collection = { type: 'GeometryCollection', geometries: [point, line] };
      expect(convertGeometry(collection, 'Point')).toEqual(point);
      expect(convertGeometry(collection, 'MultiPoint'))
        .toEqual({ type: 'MultiPoint', coordinates: [[1, 2], ...open] });
      expect(convertGeometry({ type: 'GeometryCollection', geometries: [] }, 'Polygon'))
        .toEqual({ type: 'Polygon', coordinates: [] });
    });
  });

  describe('convertFeature', () => {
    const point = { type: 'Point', coordinates: [1, 2] };
    const line = { type: 'LineString', coordinates: [[0, 0], [1, 1]] };
    const featureCollection = { type: 'FeatureCollection', features: [] };

    it('wraps a feature in a feature collection', () => {
      const value = { type: 'Feature', properties: { color: 'red' }, geometry: line };
      expect(convertFeature(value, featureCollection)).toEqual({
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: { color: 'red' }, geometry: line }],
      });
    });

    it('collects features into a multi geometry', () => {
      const value = { type: 'FeatureCollection', features: [
        { type: 'Feature', properties: { color: 'red' }, geometry: point },
        { type: 'Feature', properties: { color: 'blue' }, geometry: line },
      ] };
      const defaults = { type: 'Feature', geometry: { type: 'MultiPoint', coordinates: [] } };
      expect(convertFeature(value, defaults)).toEqual({
        type: 'Feature',
        properties: { color: 'red' },
        geometry: { type: 'MultiPoint', coordinates: [[1, 2], [0, 0], [1, 1]] },
      });
    });

    it('drops properties when not allowed', () => {
      const value = { type: 'Feature', properties: { color: 'red' }, geometry: line };
      const defaults = { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] } };
      expect(convertFeature(value, defaults, false)).toEqual({ type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] } });
    });
  });

  it('renders each feature of a feature collection', () => {
    const value = { type: 'FeatureCollection', features: [
      { type: 'Feature', properties: { color: 'red' }, geometry: { type: 'Point', coordinates: [1, 2] } },
      { type: 'Feature', properties: { color: 'blue' }, geometry: { type: 'Point', coordinates: [3, 4] } },
    ] };
    expect(geoFeatures(value).map(f => f.properties)).toEqual([{ color: 'red' }, { color: 'blue' }]);
  });
});
