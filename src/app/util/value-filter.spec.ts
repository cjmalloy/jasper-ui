/// <reference types="vitest/globals" />
import { Ref } from '../model/ref';
import {
  columnAmount,
  columnTag,
  formatAmount,
  humanAmount,
  parseAmount,
  rangeStops,
  roundAmount,
  roundSeconds,
  serverValue,
  splitAmount,
  STOPS,
  stopAmount,
  stopIndex,
  unitValue,
  UNITS,
  valueUnit
} from './value-filter';

describe('value-filter', () => {
  it('defaults to duration for :dur columns', () => {
    expect(valueUnit('tags->plugin/duration:dur')).toBe('duration');
    expect(valueUnit('plugins->_plugin/cache->contentLength:num')).toBeUndefined();
    expect(valueUnit('plugins->_plugin/cache->contentLength:num', { unit: 'bytes' })).toBe('bytes');
  });

  describe('parseAmount', () => {
    it('parses durations', () => {
      expect(parseAmount('duration', 'pt1h30m')).toBe(5400);
      expect(parseAmount('duration', 'PT5M')).toBe(300);
      expect(parseAmount('duration', '1h30m')).toBe(5400);
      expect(parseAmount('duration', '1h 30m')).toBe(5400);
      expect(parseAmount('duration', '1.5h')).toBe(5400);
      expect(parseAmount('duration', '2d')).toBe(172800);
      expect(parseAmount('duration', '90s')).toBe(90);
      expect(parseAmount('duration', '90')).toBe(90);
    });

    it('rejects invalid durations', () => {
      expect(parseAmount('duration', '')).toBeUndefined();
      expect(parseAmount('duration', 'abc')).toBeUndefined();
      expect(parseAmount('duration', 'px')).toBeUndefined();
      expect(parseAmount('duration', '5mb')).toBeUndefined();
    });

    it('parses sizes', () => {
      expect(parseAmount('bytes', '1000')).toBe(1000);
      expect(parseAmount('bytes', '10mb')).toBe(10 * 1024 * 1024);
      expect(parseAmount('bytes', '1.5 GB')).toBe(1.5 * 1024 ** 3);
      expect(parseAmount('bytes', '20kB')).toBe(20 * 1024);
      expect(parseAmount('bytes', '5b')).toBe(5);
    });

    it('rejects invalid sizes', () => {
      expect(parseAmount('bytes', 'mb')).toBeUndefined();
      expect(parseAmount('bytes', '10m')).toBeUndefined();
    });
  });

  it('splits into the largest unit', () => {
    expect(splitAmount('bytes', 10 * 1024 * 1024)).toEqual({ number: 10, option: UNITS.bytes[2] });
    expect(splitAmount('bytes', 1536)).toEqual({ number: 1.5, option: UNITS.bytes[1] });
    expect(splitAmount('bytes', 10_000_000)).toEqual({ number: 9.537, option: UNITS.bytes[2] });
    expect(splitAmount('bytes', 0)).toEqual({ number: 0, option: UNITS.bytes[0] });
    expect(splitAmount('duration', 5400)).toEqual({ number: 1.5, option: UNITS.duration[2] });
  });

  it('formats values', () => {
    expect(unitValue('bytes', 10, UNITS.bytes[2])).toBe('10mb');
    expect(unitValue('bytes', 500, UNITS.bytes[0])).toBe('500');
    expect(unitValue('duration', 1.5, UNITS.duration[2])).toBe('pt1h30m');
    expect(formatAmount('duration', 300)).toBe('pt5m');
    expect(formatAmount('bytes', 1.5 * 1024 * 1024)).toBe('1.5mb');
    expect(humanAmount('bytes', 1.5 * 1024 * 1024)).toBe('1.5 MB');
    expect(humanAmount('duration', 5400)).toContain('1');
  });

  it('converts shorthand for the server', () => {
    expect(serverValue('tags->plugin/duration:dur', '1h30m')).toBe('pt1h30m');
    expect(serverValue('tags->plugin/duration:dur', 'pt5m')).toBe('pt5m');
    expect(serverValue('tags->plugin/duration:dur', 'bad')).toBe('bad');
    expect(serverValue('plugins->_plugin/cache->contentLength:num', '10mb')).toBe(String(10 * 1024 * 1024));
    expect(serverValue('plugins->_plugin/cache->contentLength:num', '1000')).toBe('1000');
    expect(serverValue('plugins->plugin/test->title', '10mb')).toBe('10mb');
  });

  it('reads column values', () => {
    expect(columnTag('tags->plugin/duration:dur')).toBe('plugin/duration');
    expect(columnTag('plugins->_plugin/cache->contentLength:num')).toBe('_plugin/cache');
    expect(columnAmount({ url: '', tags: ['public', 'plugin/duration/pt10m'] } as Ref, 'tags->plugin/duration:dur', 'duration')).toBe(600);
    expect(columnAmount({ url: '', tags: ['plugin/duration'] } as Ref, 'tags->plugin/duration:dur', 'duration')).toBeUndefined();
    expect(columnAmount({ url: '', plugins: { '_plugin/cache': { contentLength: 2048 } } } as Ref, 'plugins->_plugin/cache->contentLength:num', 'bytes')).toBe(2048);
    expect(columnAmount({ url: '' } as Ref, 'plugins->_plugin/cache->contentLength:num', 'bytes')).toBeUndefined();
  });

  describe('rangeStops', () => {
    it('uses every stop without an extent', () => {
      expect(rangeStops('duration')).toEqual(STOPS.duration);
    });

    it('clips to the stops around the extent', () => {
      expect(rangeStops('duration', undefined, 90, 700)).toEqual([60, 120, 300, 600, 900]);
      expect(rangeStops('duration', undefined, undefined, 50)).toEqual([10, 30, 60]);
    });

    it('keeps every stop when the extent is a single stop', () => {
      expect(rangeStops('duration', undefined, 0, 5)).toEqual(STOPS.duration);
    });

    it('includes the current value outside the stops', () => {
      expect(rangeStops('duration', 400, 90, 700)).toEqual([60, 120, 300, 600, 900]);
      expect(rangeStops('duration', 1200, 90, 700)).toEqual([60, 120, 300, 600, 900, 1200]);
    });
  });

  describe('stopAmount', () => {
    it('reads stops at whole positions', () => {
      expect(stopAmount([60, 120, 300], 1)).toBe(120);
      expect(stopAmount([60, 120, 300], 2)).toBe(300);
    });

    it('uses a log scale between stops', () => {
      expect(stopAmount([100, 10000], 0.5)).toBeCloseTo(1000);
      expect(stopIndex([100, 10000], 1000)).toBeCloseTo(0.5);
    });

    it('is linear from zero', () => {
      expect(stopAmount([0, 60], 0.25)).toBe(15);
      expect(stopIndex([0, 60], 15)).toBe(0.25);
    });

    it('finds positions of stops', () => {
      expect(stopIndex([60, 120, 300], 120)).toBe(1);
      expect(stopIndex([60, 120, 300], 10)).toBe(0);
      expect(stopIndex([60, 120, 300], 600)).toBe(2);
    });
  });

  describe('roundAmount', () => {
    it('keeps the two largest units of a duration', () => {
      expect(roundAmount('duration', 3 * 3600 + 17 * 60 + 42.4)).toBe(3 * 3600 + 18 * 60);
      expect(roundAmount('duration', 45.6)).toBe(46);
      expect(roundSeconds(3 * 24 * 3600 + 4 * 3600 + 60).toISO()).toBe('P3DT4H');
      expect(roundSeconds(4 * 24 * 3600 + 13.9 * 3600).toISO()).toBe('P4DT14H');
      expect(roundSeconds(3600 + 59.7 * 60).toISO()).toBe('PT2H');
      expect(roundSeconds(42).toISO()).toBe('PT42S');
    });

    it('keeps 3 significant digits of a size', () => {
      expect(roundAmount('bytes', 3.14159 * 1024 ** 2)).toBe(Math.round(3.14 * 1024 ** 2));
    });
  });
});
