/// <reference types="vitest/globals" />
import { inputTagDefaults, inputTagQuery, inputTagSuggestion, parseInputTag, resolveInputTag } from './input-tag';

describe('inputTag', () => {
  const car = parseInputTag('car/year/<Year>/make/<Make>/model/<Model>');

  it('parses placeholders', () => {
    expect(parseInputTag('car/<Year>/<Make>')).toEqual([{ literal: 'car' }, { label: 'Year' }, { label: 'Make' }]);
  });

  it('appends a placeholder to a template without one', () => {
    expect(parseInputTag('+plugin/secret')).toEqual([{ literal: '+plugin' }, { literal: 'secret' }, { label: '' }]);
  });

  it('parses a segment with commas as a fixed choice', () => {
    const segments = parseInputTag('+plugin,_plugin/secret/<Secret>');
    expect(segments).toEqual([{ choices: ['+plugin', '_plugin'] }, { literal: 'secret' }, { label: 'Secret' }]);
    expect(inputTagDefaults(segments)).toEqual(['+plugin', '']);
    expect(resolveInputTag(segments, ['_plugin', 'openai'])).toBe('_plugin/secret/openai');
    expect(resolveInputTag(segments, ['plugin', 'openai'])).toBe('');
    expect(inputTagQuery(segments, ['_plugin', ''], 2)).toBe('_plugin/secret');
  });

  it('resolves once every placeholder is valid', () => {
    expect(resolveInputTag(car, ['2020', 'toyota', 'corolla'])).toBe('car/year/2020/make/toyota/model/corolla');
    expect(resolveInputTag(car, ['2020', '', 'corolla'])).toBe('');
    expect(resolveInputTag(car, ['2020', 'Toyota', 'corolla'])).toBe('');
    expect(resolveInputTag(parseInputTag('+plugin/secret'), ['openai'])).toBe('+plugin/secret/openai');
    expect(resolveInputTag(parseInputTag('<Tag>'), ['+protected'])).toBe('+protected');
  });

  it('queries the filled prefix when filled out in order', () => {
    expect(inputTagQuery(car, ['2020', 'toyota', ''], 6)).toBe('car/year/2020/make/toyota/model');
    expect(inputTagQuery(car, ['', '', ''], 2)).toBe('car/year');
    expect(inputTagQuery(parseInputTag('<Tag>/<Sub>'), ['', ''], 0)).toBeUndefined();
  });

  it('queries every possibility when filled out of order', () => {
    expect(inputTagQuery(car, ['', 'toyota', ''], 6)).toBe('car/year');
    expect(inputTagSuggestion(car, ['', 'toyota', ''], 6, 'car/year/2020/make/toyota/model/corolla')).toBe('corolla');
    expect(inputTagSuggestion(car, ['', 'toyota', ''], 6, 'car/year/2020/make/honda/model/civic')).toBeUndefined();
    expect(inputTagSuggestion(car, ['', '', ''], 6, 'car/year/2020/make/honda/model/civic')).toBe('civic');
  });

  it('suggests the placeholder segment of matching tags', () => {
    expect(inputTagSuggestion(car, ['', '', ''], 2, 'car/year/2020')).toBe('2020');
    expect(inputTagSuggestion(car, ['', '', ''], 2, 'car/year/2020/make')).toBe('2020');
    expect(inputTagSuggestion(car, ['', '', ''], 2, 'car/year')).toBeUndefined();
    expect(inputTagSuggestion(car, ['', '', ''], 2, 'car/month/2020')).toBeUndefined();
  });
});
