/// <reference types="vitest/globals" />
import {
  expandHierarchicalTags,
  filterInputTag,
  hierarchicalTagParents,
  hierarchicalTagTemplate,
  inputTagDefaults,
  inputTagQuery,
  inputTagSuggestion,
  inputTagValues,
  matchesInputTag,
  parseInputTag,
  partialInputTag,
  resolveInputTag
} from './input-tag';

describe('inputTag', () => {
  const car = parseInputTag('car/year/<Year>/make/<Make>/model/<Model>');

  it('parses placeholders', () => {
    expect(parseInputTag('car/<Year>/<Make>')).toEqual([
      { options: ['car'], depth: 0 },
      { label: 'Year', depth: 1 },
      { label: 'Make', depth: 2, rest: true },
    ]);
  });

  it('appends a placeholder to a template without one', () => {
    expect(parseInputTag('+plugin/secret')).toEqual([{ options: ['+plugin/secret'], depth: 0 }, { label: '', depth: 2, rest: true }]);
  });

  it('groups the prefix before the first input into one dropdown', () => {
    const parts = parseInputTag('+plugin,_plugin/secret/<Secret>');
    expect(parts).toEqual([{ options: ['+plugin/secret', '_plugin/secret'], depth: 0 }, { label: 'Secret', depth: 2, rest: true }]);
    expect(inputTagDefaults(parts)).toEqual(['+plugin/secret', '']);
    expect(resolveInputTag(parts, ['_plugin/secret', 'openai'])).toBe('_plugin/secret/openai');
    expect(resolveInputTag(parts, ['plugin/secret', 'openai'])).toBe('');
    expect(inputTagQuery(parts, ['_plugin/secret', ''], 1)).toBe('_plugin/secret');
  });

  it('adds every permutation when several segments have commas', () => {
    expect(parseInputTag('+a,_a/b/c,d/<X>/e,f')).toEqual([
      { options: ['+a/b/c', '+a/b/d', '_a/b/c', '_a/b/d'], depth: 0 },
      { label: 'X', depth: 3 },
      { options: ['e', 'f'], depth: 4 },
    ]);
  });

  it('resolves once every part is valid', () => {
    expect(resolveInputTag(car, ['car/year', '2020', 'make', 'toyota', 'model', 'corolla'])).toBe('car/year/2020/make/toyota/model/corolla');
    expect(resolveInputTag(car, ['car/year', '2020', 'make', '', 'model', 'corolla'])).toBe('');
    expect(resolveInputTag(car, ['car/year', '2020', 'make', 'Toyota', 'model', 'corolla'])).toBe('');
    expect(resolveInputTag(parseInputTag('+plugin/secret'), ['+plugin/secret', 'openai'])).toBe('+plugin/secret/openai');
    expect(resolveInputTag(parseInputTag('<Tag>'), ['+protected'])).toBe('+protected');
  });

  it('queries the filled prefix when filled out in order', () => {
    expect(inputTagQuery(car, ['car/year', '2020', 'make', 'toyota', 'model', ''], 5)).toBe('car/year/2020/make/toyota/model');
    expect(inputTagQuery(car, ['car/year', '', 'make', '', 'model', ''], 1)).toBe('car/year');
    expect(inputTagQuery(parseInputTag('<Tag>/<Sub>'), ['', ''], 0)).toBeUndefined();
  });

  it('queries every possibility when filled out of order', () => {
    const values = ['car/year', '', 'make', 'toyota', 'model', ''];
    expect(inputTagQuery(car, values, 5)).toBe('car/year');
    expect(inputTagSuggestion(car, values, 5, 'car/year/2020/make/toyota/model/corolla')).toBe('corolla');
    expect(inputTagSuggestion(car, values, 5, 'car/year/2020/make/honda/model/civic')).toBeUndefined();
    expect(inputTagSuggestion(car, ['car/year', '', 'make', '', 'model', ''], 5, 'car/year/2020/make/honda/model/civic')).toBe('civic');
  });

  it('suggests the placeholder segment of matching tags', () => {
    const values = inputTagDefaults(car);
    expect(inputTagSuggestion(car, values, 1, 'car/year/2020')).toBe('2020');
    expect(inputTagSuggestion(car, values, 1, 'car/year/2020/make')).toBe('2020');
    expect(inputTagSuggestion(car, values, 1, 'car/year')).toBeUndefined();
    expect(inputTagSuggestion(car, values, 1, 'car/month/2020')).toBeUndefined();
  });

  it('allows more than one segment in the last placeholder', () => {
    const kanban = parseInputTag('kanban/<Board>');
    expect(resolveInputTag(kanban, ['kanban', 'jasper/bugs'])).toBe('kanban/jasper/bugs');
    expect(resolveInputTag(kanban, ['kanban', 'jasper/'])).toBe('');
    expect(resolveInputTag(car, ['car/year', '2020/1', 'make', 'toyota', 'model', 'corolla'])).toBe('');
    expect(matchesInputTag(kanban, 'kanban/jasper/bugs')).toBe(true);
    expect(inputTagSuggestion(kanban, ['kanban', ''], 1, 'kanban/jasper')).toBe('jasper');
    expect(inputTagSuggestion(kanban, ['kanban', ''], 1, 'kanban/jasper/bugs')).toBe('jasper/bugs');
    expect(inputTagValues(kanban, 'kanban/jasper/bugs')).toEqual(['kanban', 'jasper/bugs']);
  });
});

describe('partial inputTag', () => {
  const secret = parseInputTag('+plugin,_plugin/secret/<Name>');

  it('only keeps prefixes that can be added', () => {
    expect(filterInputTag(secret, t => !t.startsWith('_'))[0].options).toEqual(['+plugin/secret']);
    expect(filterInputTag(secret, () => false)[0].options).toEqual(['+plugin/secret']);
  });

  it('reads values from a partial tag', () => {
    expect(inputTagValues(secret)).toEqual(['+plugin/secret', '']);
    expect(inputTagValues(secret, '_plugin/secret')).toEqual(['_plugin/secret', '']);
    expect(inputTagValues(secret, '_plugin/secret/openai')).toEqual(['_plugin/secret', 'openai']);
    expect(inputTagValues(parseInputTag('car/<Year>/<Make>'), 'car/2020')).toEqual(['car', '2020', '']);
  });

  it('is the known prefix until filled out', () => {
    expect(partialInputTag(secret, ['_plugin/secret', ''])).toBe('_plugin/secret');
    expect(partialInputTag(secret, ['_plugin/secret', 'openai'])).toBe('_plugin/secret/openai');
    expect(partialInputTag(parseInputTag('<Tag>'), [''])).toBe('');
  });

  it('matches complete tags', () => {
    expect(matchesInputTag(secret, '+plugin/secret/openai')).toBe(true);
    expect(matchesInputTag(secret, '+plugin/secret')).toBe(false);
    expect(matchesInputTag(secret, 'plugin/secret/openai')).toBe(false);
    expect(matchesInputTag(secret, '+plugin/secret/openai/key')).toBe(true);
    expect(matchesInputTag(parseInputTag('a/<X>/b'), 'a/x/y/b')).toBe(false);
    expect(matchesInputTag(secret, null)).toBe(false);
  });
});

describe('hierarchicalTag', () => {
  it('finds the parent of each template', () => {
    expect(hierarchicalTagParents(['car/<Make>', 'car/<Make>/<Model>', 'car/<Make>/<Model>/<Trim>'])).toEqual([-1, 0, 1]);
    expect(hierarchicalTagParents(['<Make>/<Model>', '<Make>'])).toEqual([1, -1]);
    expect(hierarchicalTagParents(['car/<Make>', 'color/<Color>'])).toEqual([-1, -1]);
    expect(hierarchicalTagParents(['car/<Make>', 'car/<Brand>/<Model>'])).toEqual([-1, 0]);
  });

  it('adds a line for every level', () => {
    expect(expandHierarchicalTags(['car/<Make>', 'car/<Make>/<Model>'])).toEqual(['car/<Make>', 'car/<Make>/<Model>']);
    expect(expandHierarchicalTags(['car/<Make>/<Model>', 'car/<Make>/<Model>/<Trim>'])).toEqual(['car/<Make>', 'car/<Make>/<Model>', 'car/<Make>/<Model>/<Trim>']);
    expect(expandHierarchicalTags(['car/<Make>', 'car/<Brand>/<Model>'])).toEqual(['car/<Make>', 'car/<Brand>/<Model>']);
    expect(expandHierarchicalTags(['car/year/<Year>/make/<Make>'])).toEqual(['car/year/<Year>', 'car/year/<Year>/make/<Make>']);
    expect(expandHierarchicalTags(['<Make>/<Model>'])).toEqual(['<Make>', '<Make>/<Model>']);
  });

  it('fills in the parent tag once it is filled out', () => {
    expect(hierarchicalTagTemplate('car/<Make>')).toBe('car/<Make>');
    expect(hierarchicalTagTemplate('car/<Make>/<Model>', 'car/<Make>', 'car/toyota')).toBe('car/toyota/<Model>');
    expect(hierarchicalTagTemplate('car/<Make>/<Model>', 'car/<Make>', 'car')).toBe('');
    expect(hierarchicalTagTemplate('car/<Make>/<Model>', 'car/<Make>', null)).toBe('');
    expect(hierarchicalTagTemplate('<Make>/<Model>', '<Make>', 'toyota')).toBe('toyota/<Model>');
  });
});
