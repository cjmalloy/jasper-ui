import type { Feature, Geometry, Position } from 'geojson';
import { cloneDeep } from 'lodash-es';

export function isPosition(p: any): p is Position {
  return Array.isArray(p) && p.length >= 2 && typeof p[0] === 'number' && typeof p[1] === 'number' && isFinite(p[0]) && isFinite(p[1]);
}

/**
 * A position other than the unset [0, 0] default.
 */
export function hasLocation(v: any): v is [number, number] {
  return isPosition(v)
    && v[0] >= -180 && v[0] <= 180
    && v[1] >= -90 && v[1] <= 90
    && (v[0] !== 0 || v[1] !== 0);
}

/**
 * Centre of the bounds of every location in the Ref's geo plugins.
 */
export function geoCenter(plugins?: Record<string, any>): [number, number] | undefined {
  const lons: number[] = [];
  let s = Infinity, n = -Infinity;
  const visit = (c: any) => {
    if (hasLocation(c)) {
      lons.push(c[0]);
      s = Math.min(s, c[1]);
      n = Math.max(n, c[1]);
    } else if (Array.isArray(c)) {
      c.forEach(visit);
    }
  };
  for (const [key, value] of Object.entries(plugins || {})) {
    if (!key.startsWith('plugin/geo/')) continue;
    for (const f of geoFeatures(value, value?.geometry?.type === 'Point' ? hasLocation : isPosition)) visit((f.geometry as any).coordinates);
  }
  if (!lons.length) return undefined;
  return [lonCenter(lons), (s + n) / 2];
}

/**
 * Centre of the smallest longitude interval containing every longitude,
 * allowing the interval to wrap across the antimeridian.
 */
function lonCenter(lons: number[]): number {
  const sorted = [...lons].sort((a, b) => a - b);
  const last = sorted.length - 1;
  // The interval is the complement of the largest gap between neighbours
  let gap = sorted[0] + 360 - sorted[last];
  let west = sorted[0], east = sorted[last];
  for (let i = 0; i < last; i++) {
    if (sorted[i + 1] - sorted[i] > gap) {
      gap = sorted[i + 1] - sorted[i];
      west = sorted[i + 1];
      east = sorted[i] + 360;
    }
  }
  const c = (west + east) / 2;
  return c > 180 ? c - 360 : c;
}

/**
 * A linear ring is closed with four or more positions, the first and last
 * being identical (RFC 7946 3.1.6).
 */
export function isLinearRing(ring: Position[]): boolean {
  if (ring.length < 4) return false;
  const first = ring[0];
  const last = ring[ring.length - 1];
  return first.length === last.length && first.every((n, i) => n === last[i]);
}

/**
 * Convert a feature or feature collection into renderable features. Rings are never closed
 * automatically: invalid polygons are drawn as open lines and points so the
 * map always shows exactly what is stored.
 */
export function geoFeatures(feature: any, valid: (p: any) => p is Position = isPosition): Feature[] {
  if (feature?.type === 'FeatureCollection') {
    return (Array.isArray(feature.features) ? feature.features : []).flatMap((f: any) => geoFeatures(f, valid));
  }
  const result: Feature[] = [];
  const add = (geometry?: Geometry) => {
    if (!geometry) return;
    if (geometry.type === 'GeometryCollection') {
      geometry.geometries.forEach(add);
    } else if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length) {
      result.push({ type: 'Feature', properties: feature?.properties || {}, geometry });
    }
  };
  add(sanitize(feature?.geometry, valid));
  return result;
}

function sanitize(geometry: any, valid: (p: any) => p is Position): Geometry | undefined {
  const c = geometry?.coordinates;
  const positions = (ps: any): Position[] => Array.isArray(ps) ? ps.filter(valid) : [];
  const polygon = (rings: any[]) => toPolygon(rings.map(positions));
  switch (geometry?.type) {
    case 'Point':
      return valid(c) ? { type: 'Point', coordinates: c } : undefined;
    case 'MultiPoint':
      return { type: 'MultiPoint', coordinates: positions(c) };
    case 'LineString':
      return line(positions(c));
    case 'MultiLineString':
      return {
        type: 'GeometryCollection',
        geometries: (Array.isArray(c) ? c : []).map(positions).filter(l => l.length).map(line),
      };
    case 'Polygon':
      return polygon(Array.isArray(c) ? c : []);
    case 'MultiPolygon': {
      const polys = (Array.isArray(c) ? c : []).map(p => polygon(Array.isArray(p) ? p : []));
      return { type: 'GeometryCollection', geometries: polys.filter(p => !!p) as Geometry[] };
    }
    case 'GeometryCollection':
      return {
        type: 'GeometryCollection',
        geometries: (Array.isArray(geometry.geometries) ? geometry.geometries : []).map((g: any) => sanitize(g, valid)).filter((g: any) => !!g),
      };
  }
  return undefined;
}

function line(ps: Position[]): Geometry {
  return ps.length > 1 ? { type: 'LineString', coordinates: ps } : { type: 'MultiPoint', coordinates: ps };
}

function toPolygon(rings: Position[][]): Geometry | undefined {
  const rs = rings.filter(r => r.length);
  if (!rs.length) return undefined;
  if (!isLinearRing(rings[0])) return { type: 'GeometryCollection', geometries: rs.map(line) };
  const geometries: Geometry[] = [
    { type: 'Polygon', coordinates: rs.filter(isLinearRing) },
    ...rs.filter(r => !isLinearRing(r)).map(line),
  ];
  return geometries.length === 1 ? geometries[0] : { type: 'GeometryCollection', geometries };
}

const DEPTH: Record<string, number> = {
  Point: 0,
  MultiPoint: 1,
  LineString: 1,
  MultiLineString: 2,
  Polygon: 2,
  MultiPolygon: 3,
};

/**
 * Convert geometry to another GeoJSON geometry type, keeping as much as
 * possible. Single geometries are wrapped when converting to a multi type,
 * and the first is kept when converting back, except a multi point keeps
 * every position. Polygon rings are lines that
 * are closed when converting to a polygon, and opened when converting back.
 * A geometry collection keeps every geometry when converting to a multi type,
 * otherwise only the first.
 */
export function convertGeometry(geometry: any, type: string): Geometry {
  if (!(type in DEPTH)) throw new Error('Unknown geometry type: ' + type);
  if (geometry?.type === 'GeometryCollection') {
    const geometries: any[] = Array.isArray(geometry.geometries) ? geometry.geometries : [];
    if (!type.startsWith('Multi')) return convertGeometry(geometries[0], type);
    return {
      type,
      coordinates: geometries.flatMap(g => (convertGeometry(g, type) as any).coordinates),
    } as Geometry;
  }
  if (geometry?.type === type) return cloneDeep(geometry);
  let depth = DEPTH[geometry?.type] ?? -1;
  let c: any = cloneDeep(geometry?.coordinates);
  // Open polygon rings into lines
  if (depth === 2 && geometry.type === 'Polygon') c = openRings(c);
  if (depth === 3) c = (Array.isArray(c) ? c : []).map(openRings);
  if (depth === 0 && !hasLocation(c) || depth < 0 || depth > 0 && !Array.isArray(c)) {
    // Nothing to keep
    depth = 1;
    c = [];
  }
  const target = DEPTH[type];
  if (type === 'MultiPoint' && depth > 1) {
    // Keep every position
    c = c.flat(depth - 1);
    depth = 1;
  }
  while (depth > target) {
    c = depth === 1 ? c[0] : c[0] || [];
    depth--;
  }
  while (depth < target) {
    if (Array.isArray(c) && !c.length) {
      depth = target;
      break;
    }
    c = [c];
    depth++;
  }
  if (target === 0 && !isPosition(c)) c = [0, 0];
  if (type === 'Polygon') c = closeRings(c);
  if (type === 'MultiPolygon') c = c.map(closeRings);
  return { type, coordinates: c } as Geometry;
}

function openRings(rings: any): Position[][] {
  return (Array.isArray(rings) ? rings : []).map((r: any) => Array.isArray(r) && isLinearRing(r) ? r.slice(0, -1) : r);
}

function closeRings(rings: Position[][]): Position[][] {
  return rings.map(r => r.length >= 3 && !isLinearRing(r) ? [...r, [...r[0]]] : r);
}

/**
 * Convert GeoJSON plugin data (a Feature or FeatureCollection) to the type of
 * the plugin defaults, keeping as much as possible. A FeatureCollection keeps
 * the properties of each feature, otherwise the first feature's properties
 * are kept.
 * Properties are dropped if not allowed.
 */
export function convertFeature(value: any, defaults: any, properties = true): any {
  if (!defaults?.type) return undefined;
  const sourceFeatures: any[] = value?.type === 'FeatureCollection'
    ? (Array.isArray(value.features) ? value.features : [])
    : value?.geometry ? [value] : [];
  if (!sourceFeatures.length) return undefined;
  const result: any = cloneDeep(defaults);
  if (value.bbox) result.bbox = cloneDeep(value.bbox);
  if (defaults.type === 'FeatureCollection') {
    const template = defaults.features?.[0];
    result.features = sourceFeatures.map(f => ({
      type: 'Feature',
      ...f.properties ? { properties: cloneDeep(f.properties) } : {},
      geometry: template?.geometry?.type ? convertGeometry(f.geometry, template.geometry.type) : cloneDeep(f.geometry),
    }));
    return result;
  }
  const type = defaults.geometry?.type;
  if (!type) return undefined;
  const geometry = sourceFeatures.length === 1
    ? sourceFeatures[0].geometry
    : { type: 'GeometryCollection', geometries: sourceFeatures.map(f => f.geometry).filter(g => !!g) };
  result.geometry = convertGeometry(geometry, type);
  const props = sourceFeatures.find(f => f.properties)?.properties;
  if (properties && props) result.properties = cloneDeep(props);
  return result;
}
