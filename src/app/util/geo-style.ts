import type { Map as MapLibreMap, StyleImageInterface } from 'maplibre-gl';
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
const pattern = (style: any, color: any): any => ['concat', PATTERN_PREFIX, style, '|', ['to-string', color]];
const BLINK_MS = 500;
/** Radius of the blinking point image, in CSS pixels. */
const BLINK_POINT_RADIUS = 16;

const POLYGONS: any = ['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false];
const LINES: any = ['match', ['geometry-type'], ['LineString', 'MultiLineString', 'Polygon', 'MultiPolygon'], true, false];
const POINTS: any = ['match', ['geometry-type'], ['Point', 'MultiPoint'], true, false];
const fillStyle = (...styles: string[]): any => ['match', ['get', 'fillStyle'], styles, true, false];
const strokeStyle = (...styles: string[]): any => ['match', ['get', 'strokeStyle'], styles, true, false];

/**
 * Add layers drawing the features of a GeoJSON source with their style
 * properties. Layer ids start with the prefix.
 * Hatched and blinking styles use pattern images generated for each color
 * when first needed. Blinking images are animated, and only repaint the map
 * while they are drawn, so call this outside the Angular zone.
 * Returns a function removing the pattern image resolver and blink repaints.
 */
export function addGeoLayers(map: MapLibreMap, source: string, prefix: string, pointRadius: number): () => void {
  const blink = new BlinkClock(map);
  map.setMissingStyleImageResolver(id => {
    if (!id.startsWith(PATTERN_PREFIX) || map.hasImage(id)) return;
    const [style, color] = id.substring(PATTERN_PREFIX.length).split('|');
    const image = style.startsWith('blink-')
      ? blinkImage(style, color, blink)
      : geoPattern(style, color);
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
    filter: ['all', POLYGONS, fillStyle(...PATTERN_STYLES, 'blinking')],
    paint: {
      'fill-pattern': pattern(['match', ['get', 'fillStyle'], 'blinking', 'blink-fill', ['get', 'fillStyle']], GEO_FILL_COLOR),
    },
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
    paint: { 'line-pattern': pattern('blink-line', GEO_COLOR), 'line-width': STROKE_WIDTH },
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
    type: 'symbol',
    source,
    filter: ['all', POINTS, strokeStyle('blinking')],
    layout: {
      'icon-image': pattern('blink-point', GEO_COLOR),
      'icon-size': ['*', pointRadius / BLINK_POINT_RADIUS, POINT_SCALE],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  });
  return () => {
    blink.dispose();
    try {
      map.setMissingStyleImageResolver(null);
    } catch {
      // Map removed
    }
  };
}

/**
 * Shared blink phase, so every blinking feature blinks together. Repaints the
 * map once at the next phase change, only when a blinking image was drawn.
 */
export class BlinkClock {
  private timeout?: ReturnType<typeof setTimeout>;
  private disposed = false;

  constructor(private map: Pick<MapLibreMap, 'triggerRepaint'>) { }

  get on() {
    return Math.floor(performance.now() / BLINK_MS) % 2 === 0;
  }

  /**
   * Called each frame a blinking image is drawn.
   */
  drawn() {
    if (this.disposed || this.timeout) return;
    const wait = BLINK_MS - performance.now() % BLINK_MS + 1;
    this.timeout = setTimeout(() => {
      this.timeout = undefined;
      if (!this.disposed) this.map.triggerRepaint();
    }, wait);
  }

  dispose() {
    this.disposed = true;
    clearTimeout(this.timeout);
    this.timeout = undefined;
  }
}

/**
 * Animated pattern image for a blinking fill, line or point. Swaps between an
 * on and off frame, only uploading a frame when the blink phase changes.
 */
export function blinkImage(style: string, color: string, clock: BlinkClock): StyleImageInterface | undefined {
  const on = blinkFrame(style, color, true);
  const off = blinkFrame(style, color, false);
  if (!on || !off) return undefined;
  let shown = true;
  const data = new Uint8Array(on.data.buffer.slice(0));
  return {
    width: on.width,
    height: on.height,
    data,
    render() {
      clock.drawn();
      const next = clock.on;
      if (next === shown) return false;
      shown = next;
      data.set((next ? on : off).data);
      return true;
    },
  };
}

function blinkFrame(style: string, color: string, on: boolean): ImageData | undefined {
  const point = style === 'blink-point';
  const s = (point ? BLINK_POINT_RADIUS * 2 : 4) * PATTERN_PIXEL_RATIO;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = s;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;
  ctx.fillStyle = color;
  switch (style) {
    case 'blink-fill':
      ctx.globalAlpha = on ? GEO_FILL_OPACITY * 2 : 0;
      ctx.fillRect(0, 0, s, s);
      break;
    case 'blink-line':
      ctx.globalAlpha = on ? 1 : 0.2;
      ctx.fillRect(0, 0, s, s);
      break;
    case 'blink-point':
      ctx.globalAlpha = on ? 1 : 0.2;
      ctx.beginPath();
      ctx.arc(s / 2, s / 2, s / 2 - 1, 0, Math.PI * 2);
      ctx.fill();
      break;
    default:
      return undefined;
  }
  return ctx.getImageData(0, 0, s, s);
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
