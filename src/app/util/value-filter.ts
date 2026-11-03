import { Duration } from 'luxon';
import { Ref } from '../model/ref';
import { FilterConfig } from '../model/tag';

export type ValueUnit = NonNullable<FilterConfig['unit']>;

export interface UnitOption {
  suffix: string;
  label: string;
  factor: number;
}

export const UNITS: Record<ValueUnit, UnitOption[]> = {
  duration: [
    { suffix: 's', label: $localize`sec`, factor: 1 },
    { suffix: 'm', label: $localize`min`, factor: 60 },
    { suffix: 'h', label: $localize`hr`, factor: 60 * 60 },
    { suffix: 'd', label: $localize`days`, factor: 24 * 60 * 60 },
  ],
  // Binary units, like the cache mod shows sizes
  bytes: [
    { suffix: 'b', label: 'B', factor: 1 },
    { suffix: 'kb', label: 'kB', factor: 1024 },
    { suffix: 'mb', label: 'MB', factor: 1024 ** 2 },
    { suffix: 'gb', label: 'GB', factor: 1024 ** 3 },
    { suffix: 'tb', label: 'TB', factor: 1024 ** 4 },
  ],
};

/**
 * Log scale range stops, in seconds or bytes.
 */
export const STOPS: Record<ValueUnit, number[]> = {
  duration: [10, 30, 60, 2 * 60, 5 * 60, 10 * 60, 15 * 60, 30 * 60, 45 * 60, 60 * 60, 90 * 60, 2 * 60 * 60, 3 * 60 * 60, 5 * 60 * 60, 10 * 60 * 60, 24 * 60 * 60],
  bytes: [10, 100, 500, 1024, 5 * 1024, 10 * 1024, 50 * 1024, 100 * 1024, 500 * 1024, 1024 ** 2, 5 * 1024 ** 2, 10 * 1024 ** 2].map(kb => kb * 1024),
};

const NUMBER = '\\d+(?:\\.\\d+)?';
const DURATION_SHORTHAND = new RegExp(`^(?:(${NUMBER})d)?(?:(${NUMBER})h)?(?:(${NUMBER})m)?(?:(${NUMBER})s)?$`, 'i');
const BYTES_SHORTHAND = new RegExp(`^(${NUMBER})\\s*(b|kb|mb|gb|tb)?$`, 'i');

export function valueUnit(column: string, config?: FilterConfig): ValueUnit | undefined {
  return config?.unit || (column.endsWith(':dur') ? 'duration' : undefined);
}

/**
 * Parse a filter value in seconds or bytes.
 * Durations may be ISO 8601 (pt1h30m), shorthand (1h30m, 1.5h) or seconds.
 * Sizes may be bytes or shorthand (10mb, 1.5 GB).
 */
export function parseAmount(unit: ValueUnit, value: string): number | undefined {
  value = value.trim();
  if (!value) return undefined;
  if (unit === 'duration') {
    value = value.replace(/\s+/g, '');
    if (/^p/i.test(value)) {
      const d = Duration.fromISO(value.toUpperCase());
      return d.isValid ? d.as('seconds') : undefined;
    }
    if (/^\d+(\.\d+)?$/.test(value)) return Number(value);
    const m = DURATION_SHORTHAND.exec(value);
    if (!m || !m.slice(1).some(n => n)) return undefined;
    return UNITS.duration
      .map((u, i) => Number(m[4 - i] || 0) * u.factor)
      .reduce((a, b) => a + b);
  }
  const m = BYTES_SHORTHAND.exec(value);
  if (!m) return undefined;
  return Math.round(Number(m[1]) * (UNITS.bytes.find(u => u.suffix === m[2]?.toLowerCase())?.factor || 1));
}

/**
 * Split an amount into the largest unit it fills.
 */
export function splitAmount(unit: ValueUnit, amount: number): { number: number, option: UnitOption } {
  const options = UNITS[unit];
  const option = [...options].reverse().find(u => amount >= u.factor) || options[0];
  return { number: Math.round(amount / option.factor * 1000) / 1000, option };
}

/**
 * Format a number of units as a filter value.
 * Durations are ISO 8601 (pt1h30m), sizes are shorthand (10mb).
 */
export function unitValue(unit: ValueUnit, number: number, option: UnitOption) {
  if (unit === 'duration') {
    return Duration.fromObject({ seconds: number * option.factor }).rescale().toISO()!.toLowerCase();
  }
  return option.factor === 1 ? String(number) : number + option.suffix;
}

export function formatAmount(unit: ValueUnit, amount: number) {
  if (unit === 'duration') return unitValue(unit, amount, { factor: 1 } as UnitOption);
  const { number, option } = splitAmount(unit, amount);
  // Keep the exact amount when the unit would round it
  if (number * option.factor !== amount) return unitValue(unit, amount, UNITS[unit][0]);
  return unitValue(unit, number, option);
}

export function humanAmount(unit: ValueUnit, amount: number) {
  if (unit === 'duration') return Duration.fromObject({ seconds: amount }).rescale().toHuman({ unitDisplay: 'short' });
  const { number, option } = splitAmount(unit, amount);
  return number + ' ' + option.label;
}

/**
 * Convert shorthand in a value filter to the value the server accepts:
 * ISO 8601 for :dur columns, and bytes for :num sizes like 10mb.
 */
export function serverValue(column: string, value: string) {
  if (column.endsWith(':dur')) {
    if (/^p/i.test(value)) return value;
    const seconds = parseAmount('duration', value);
    return seconds === undefined ? value : formatAmount('duration', seconds);
  }
  if (column.endsWith(':num') && /[a-z]$/i.test(value)) {
    const bytes = parseAmount('bytes', value);
    if (bytes !== undefined) return String(bytes);
  }
  return value;
}

/**
 * The tag to query for Refs with a value in this sort column.
 */
export function columnTag(column: string) {
  if (column.startsWith('tags->')) return column.substring('tags->'.length).replace(/:\w+$/, '');
  return column.substring('plugins->'.length).split('->')[0].replace(/:\w+$/, '');
}

/**
 * Read the value of a sort column from a Ref.
 */
export function columnAmount(ref: Ref, column: string, unit: ValueUnit): number | undefined {
  const tag = columnTag(column);
  if (column.startsWith('tags->')) {
    const value = ref.tags?.find(t => t.startsWith(tag + '/'))?.substring(tag.length + 1).split('/')[0];
    return value ? parseAmount(unit, value) : undefined;
  }
  let value: any = ref.plugins?.[tag];
  for (const field of column.substring('plugins->'.length).replace(/:\w+$/, '').split('->').slice(1)) {
    // Array elements such as sizes[0]
    for (const [, key, index] of field.matchAll(/([^[\]]+)|\[(\d+)]/g)) value = value?.[key ?? +index];
  }
  return value === undefined || value === null ? undefined : parseAmount(unit, String(value));
}

/**
 * Range stops, limited to the stops around the values found,
 * plus the current value if it is outside them.
 */
export function rangeStops(unit: ValueUnit, current?: number, min?: number, max?: number) {
  let stops = STOPS[unit];
  const lo = min === undefined ? 0 : Math.max(0, stops.filter(s => s <= min).length - 1);
  const hi = max === undefined ? -1 : stops.findIndex(s => s >= max);
  const clipped = stops.slice(lo, hi < 0 ? stops.length : hi + 1);
  if (clipped.length >= 2) stops = clipped;
  if (current !== undefined && (current < stops[0] || current > stops[stops.length - 1])) {
    stops = [...stops, current].sort((a, b) => a - b);
  }
  return stops;
}

/**
 * The amount at a slider position between stops, on a log scale
 * (linear from a zero stop).
 */
export function stopAmount(stops: number[], index: number) {
  const i = Math.max(0, Math.min(Math.floor(index), stops.length - 1));
  const f = index - i;
  if (!f || i === stops.length - 1) return stops[i];
  const a = stops[i];
  const b = stops[i + 1];
  return a > 0 ? a * (b / a) ** f : b * f;
}

/**
 * The slider position of an amount between stops, the inverse of {@link stopAmount}.
 */
export function stopIndex(stops: number[], amount: number) {
  if (amount <= stops[0]) return 0;
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (amount > b) continue;
    if (amount === b) return i + 1;
    return i + (a > 0 ? Math.log(amount / a) / Math.log(b / a) : amount / b);
  }
  return stops.length - 1;
}

/**
 * Round a duration in seconds to its two largest units, like 3 hours 17 minutes.
 */
export function roundSeconds(seconds: number) {
  const units = ['years', 'months', 'days', 'hours', 'minutes', 'seconds'] as const;
  const d = Duration.fromObject({ seconds: Math.round(seconds) });
  const i = Math.min(units.findIndex(u => d.as(u) >= 1), units.length - 2);
  if (i < 0) return d;
  const shifted = d.shiftTo(units[i], units[i + 1]).toObject();
  return Duration.fromObject({
    [units[i]]: shifted[units[i]],
    [units[i + 1]]: Math.round(shifted[units[i + 1]]!),
  }).shiftTo(units[i], units[i + 1]);
}

/**
 * Round an amount picked between stops so it reads well:
 * durations to their two largest units, sizes to 3 significant digits.
 */
export function roundAmount(unit: ValueUnit, amount: number) {
  if (unit === 'duration') return roundSeconds(amount).as('seconds');
  const { option } = splitAmount(unit, amount);
  return Math.round(Number((amount / option.factor).toPrecision(3)) * option.factor);
}
