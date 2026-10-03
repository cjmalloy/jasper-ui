import type { Map as MapLibreMap } from 'maplibre-gl';
import type { Schema } from 'jtd';

/**
 * Style of a GeoJSON feature, stored in the feature properties.
 * Every property is optional, and a missing property uses the default.
 */
export interface GeoStyle {
  /** Stroke color, also used for points. */
  color?: string;
  strokeWidth?: GeoStrokeWidth;
  strokeStyle?: GeoStrokeStyle;
  /** Fill color, defaults to the stroke color. */
  fillColor?: string;
  fillStyle?: GeoFillStyle;
}

export const GEO_STROKE_WIDTHS = ['small', 'medium', 'large'] as const;
export type GeoStrokeWidth = typeof GEO_STROKE_WIDTHS[number];

export const GEO_STROKE_STYLES = ['solid', 'dashed', 'dotted', 'blinking'] as const;
export type GeoStrokeStyle = typeof GEO_STROKE_STYLES[number];

export const GEO_FILL_STYLES = ['default', 'none', 'solid', 'ne', 'nw', 'crosshatch', 'blinking'] as const;
export type GeoFillStyle = typeof GEO_FILL_STYLES[number];

/**
 * JTD schema for the style feature properties. Other properties are allowed.
 */
export const geoStyleSchema: Schema = {
  optionalProperties: {
    color: { type: 'string' },
    strokeWidth: { enum: [...GEO_STROKE_WIDTHS] },
    strokeStyle: { enum: [...GEO_STROKE_STYLES] },
    fillColor: { type: 'string' },
    fillStyle: { enum: [...GEO_FILL_STYLES] },
  },
  additionalProperties: true,
};

export const GEO_DEFAULT_COLOR = '#4264fb';

/**
 * MapLibre paint color using the feature's color property, if valid.
 */
export const GEO_COLOR: any = ['to-color', ['get', 'color'], GEO_DEFAULT_COLOR];

/**
 * MapLibre paint fill color using the feature's fill color, or the stroke color.
 */
export const GEO_FILL_COLOR: any = ['to-color', ['get', 'fillColor'], ['get', 'color'], GEO_DEFAULT_COLOR];

/** Opacity of the default fill style. */
export const GEO_FILL_OPACITY = 0.3;

const STROKE_WIDTH: any = ['match', ['get', 'strokeWidth'], 'small', 1, 'large', 4, 2];
const POINT_SCALE: any = ['match', ['get', 'strokeWidth'], 'small', 0.6, 'large', 1.5, 1];
const DASHES: any = ['match', ['get', 'strokeStyle'], 'dotted', ['literal', [0, 2]], ['literal', [4, 2]]];
const PATTERN_STYLES = ['ne', 'nw', 'crosshatch'];
const PATTERN_PREFIX = 'geo-pattern-';
const PATTERN: any = ['concat', PATTERN_PREFIX, ['get', 'fillStyle'], '|', ['to-string', GEO_FILL_COLOR]];
const BLINK_MS = 500;

const POLYGONS: any = ['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false];
const LINES: any = ['match', ['geometry-type'], ['LineString', 'MultiLineString', 'Polygon', 'MultiPolygon'], true, false];
const POINTS: any = ['match', ['geometry-type'], ['Point', 'MultiPoint'], true, false];
const fillStyle = (...styles: string[]): any => ['match', ['get', 'fillStyle'], styles, true, false];
const strokeStyle = (...styles: string[]): any => ['match', ['get', 'strokeStyle'], styles, true, false];

/**
 * Add layers drawing the features of a GeoJSON source with their style
 * properties. Layer ids start with the prefix.
 * Blinking runs on a timer, so call this outside the Angular zone.
 * Returns a function removing the timer and pattern image resolver.
 */
export function addGeoLayers(map: MapLibreMap, source: string, prefix: string, pointRadius: number): () => void {
  // Hatch patterns are generated for each color when first needed
  map.setMissingStyleImageResolver(id => {
    if (!id.startsWith(PATTERN_PREFIX) || map.hasImage(id)) return;
    const [style, color] = id.substring(PATTERN_PREFIX.length).split('|');
    const image = geoPattern(style, color);
    if (image) map.addImage(id, image, { pixelRatio: PATTERN_PIXEL_RATIO });
  });
  map.addLayer({
    id: prefix + '-fill',
    type: 'fill',
    source,
    filter: ['all', POLYGONS, ['!', fillStyle('none', 'blinking', ...PATTERN_STYLES)]],
    paint: {
      'fill-color': GEO_FILL_COLOR,
      'fill-opacity': ['match', ['get', 'fillStyle'], 'solid', 1, GEO_FILL_OPACITY],
    },
  });
  map.addLayer({
    id: prefix + '-fill-pattern',
    type: 'fill',
    source,
    filter: ['all', POLYGONS, fillStyle(...PATTERN_STYLES)],
    paint: { 'fill-pattern': PATTERN },
  });
  map.addLayer({
    id: prefix + '-fill-blink',
    type: 'fill',
    source,
    filter: ['all', POLYGONS, fillStyle('blinking')],
    paint: { 'fill-color': GEO_FILL_COLOR, 'fill-opacity': GEO_FILL_OPACITY },
  });
  map.addLayer({
    id: prefix + '-lines',
    type: 'line',
    source,
    filter: ['all', LINES, ['!', strokeStyle('dashed', 'dotted', 'blinking')]],
    paint: { 'line-color': GEO_COLOR, 'line-width': STROKE_WIDTH },
  });
  map.addLayer({
    id: prefix + '-lines-dashed',
    type: 'line',
    source,
    filter: ['all', LINES, strokeStyle('dashed', 'dotted')],
    layout: { 'line-cap': 'round' },
    paint: { 'line-color': GEO_COLOR, 'line-width': STROKE_WIDTH, 'line-dasharray': DASHES },
  });
  map.addLayer({
    id: prefix + '-lines-blink',
    type: 'line',
    source,
    filter: ['all', LINES, strokeStyle('blinking')],
    paint: { 'line-color': GEO_COLOR, 'line-width': STROKE_WIDTH },
  });
  map.addLayer({
    id: prefix + '-points',
    type: 'circle',
    source,
    filter: ['all', POINTS, ['!', strokeStyle('blinking')]],
    paint: { 'circle-radius': ['*', pointRadius, POINT_SCALE], 'circle-color': GEO_COLOR },
  });
  map.addLayer({
    id: prefix + '-points-blink',
    type: 'circle',
    source,
    filter: ['all', POINTS, strokeStyle('blinking')],
    paint: { 'circle-radius': ['*', pointRadius, POINT_SCALE], 'circle-color': GEO_COLOR },
  });
  let on = true;
  const blink = setInterval(() => {
    on = !on;
    try {
      map.setPaintProperty(prefix + '-fill-blink', 'fill-opacity', on ? GEO_FILL_OPACITY * 2 : 0);
      map.setPaintProperty(prefix + '-lines-blink', 'line-opacity', on ? 1 : 0.2);
      map.setPaintProperty(prefix + '-points-blink', 'circle-opacity', on ? 1 : 0.2);
    } catch {
      // Map removed
      clearInterval(blink);
    }
  }, BLINK_MS);
  return () => {
    clearInterval(blink);
    try {
      map.setMissingStyleImageResolver(null);
    } catch {
      // Map removed
    }
  };
}

const PATTERN_SIZE = 12;
const PATTERN_PIXEL_RATIO = 2;

/**
 * Hatch pattern image for a fill style and color.
 */
export function geoPattern(style: string, color: string): ImageData | undefined {
  if (!PATTERN_STYLES.includes(style)) return undefined;
  const s = PATTERN_SIZE * PATTERN_PIXEL_RATIO;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = s;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;
  ctx.strokeStyle = color;
  ctx.lineWidth = PATTERN_PIXEL_RATIO * 1.5;
  ctx.beginPath();
  // Draw each diagonal three times so the pattern tiles seamlessly
  for (const k of [-s, 0, s]) {
    if (style !== 'nw') {
      ctx.moveTo(k, s);
      ctx.lineTo(k + s, 0);
    }
    if (style !== 'ne') {
      ctx.moveTo(k, 0);
      ctx.lineTo(k + s, s);
    }
  }
  ctx.stroke();
  return ctx.getImageData(0, 0, s, s);
}
