import type { Feature, Geometry, Position } from 'geojson';

export function isPosition(p: any): p is Position {
  return Array.isArray(p) && p.length >= 2 && typeof p[0] === 'number' && typeof p[1] === 'number' && isFinite(p[0]) && isFinite(p[1]);
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
 * Convert geometry into renderable features. Rings are never closed
 * automatically: invalid polygons are drawn as open lines and points so the
 * map always shows exactly what is stored.
 */
export function geoFeatures(feature: any): Feature[] {
  const result: Feature[] = [];
  const add = (geometry?: Geometry) => {
    if (!geometry) return;
    if (geometry.type === 'GeometryCollection') {
      geometry.geometries.forEach(add);
    } else if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length) {
      result.push({ type: 'Feature', properties: feature?.properties || {}, geometry });
    }
  };
  add(sanitize(feature?.geometry));
  return result;
}

function positions(ps: any): Position[] {
  return Array.isArray(ps) ? ps.filter(isPosition) : [];
}

function sanitize(geometry: any): Geometry | undefined {
  const c = geometry?.coordinates;
  switch (geometry?.type) {
    case 'Point':
      return isPosition(c) ? { type: 'Point', coordinates: c } : undefined;
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
        geometries: (Array.isArray(geometry.geometries) ? geometry.geometries : []).map(sanitize).filter((g: any) => !!g),
      };
  }
  return undefined;
}

function line(ps: Position[]): Geometry {
  return ps.length > 1 ? { type: 'LineString', coordinates: ps } : { type: 'MultiPoint', coordinates: ps };
}

function polygon(rings: any[]): Geometry | undefined {
  const rs = rings.map(positions).filter(r => r.length);
  if (!rs.length) return undefined;
  if (rs.every(isLinearRing)) return { type: 'Polygon', coordinates: rs };
  return { type: 'GeometryCollection', geometries: rs.map(line) };
}
