/// <reference types="vitest/globals" />
import { fixIndexConfig, hasIndexes, indexList, indexNeeds, missingIndexes } from './index-helper';

describe('Index Helper', () => {
  it('needs nothing without args', () => {
    expect(hasIndexes(indexNeeds())).toBe(false);
    expect(hasIndexes(indexNeeds({ query: '@*' }))).toBe(false);
    expect(hasIndexes(indexNeeds({ query: '*' }))).toBe(false);
  });

  it('needs the tags index for tag queries', () => {
    expect(indexNeeds({ query: 'science@origin' }).flags).toEqual(['tags']);
    expect(indexNeeds({ query: '+user/bob' }).flags).toEqual(['tags']);
  });

  it('needs flags for search, sources, responses and dates', () => {
    expect(indexNeeds({
      search: 'cats',
      sources: 'https://a.com',
      noResponses: 'https://b.com',
      publishedAfter: '2020-01-01',
      sort: ['modified,DESC'],
    }).flags).toEqual(['fulltext', 'responses', 'internalResponses', 'sources', 'published', 'modified']);
  });

  it('needs the sources index for responses filters', () => {
    expect(indexNeeds({ responses: 'https://a.com' }).flags).toEqual(['sources']);
    expect(indexNeeds({ noSources: 'https://a.com' }).flags).toEqual(['responses', 'internalResponses']);
  });

  it('needs hot tags for tag value sorts and filters', () => {
    expect(indexNeeds({
      sort: ['tags->plugin/progress:num,DESC', 'tags->plugin/duration:dur'],
      tagBefore: ['tags->plugin/progress:num/50'],
      tagAfter: ['tags->plugin/title/m'],
    }).hotTags).toEqual(['plugin/progress:num', 'plugin/duration:dur', 'plugin/title']);
  });

  it('needs hot plugins for plugin filters but not sorts', () => {
    expect(indexNeeds({
      sort: ['plugins->plugin/test->size:num'],
      pluginAfter: ['plugins->_plugin/cache->contentLength:num/1000'],
      pluginBefore: ['plugins->plugin/score:num/10'],
    }).hotPlugins).toEqual(['plugin/score:num', '_plugin/cache->contentLength:num']);
  });

  it('finds missing indexes', () => {
    const needs = indexNeeds({
      query: 'science',
      search: 'cats',
      sort: ['tags->plugin/progress:num'],
      pluginAfter: ['plugins->plugin/score:num/10', 'plugins->plugin/test->name/m'],
    });
    const missing = missingIndexes(needs, {
      fulltext: false,
      hotTags: ['plugin/progress:num'],
      hotPlugins: ['plugins->plugin/score:num'],
    });
    expect(missing).toEqual({ flags: ['fulltext'], hotTags: [], hotPlugins: ['plugin/test->name'] });
    expect(hasIndexes(missing)).toBe(true);
    expect(hasIndexes(missingIndexes(needs, {
      hotTags: ['plugin/progress:num'],
      hotPlugins: ['plugin/score:num', 'plugin/test->name'],
    }))).toBe(false);
  });

  it('fixes the config', () => {
    const config = { fulltext: false, hotTags: ['plugin/a', ''], hotPlugins: ['plugin/b'] };
    const missing = { flags: ['fulltext' as const], hotTags: ['plugin/c:num'], hotPlugins: [] };
    expect(fixIndexConfig(missing, config)).toEqual({
      fulltext: true,
      hotTags: ['plugin/a', 'plugin/c:num'],
    });
    expect(indexList(missing)).toBe('* `fulltext`\n* `hotTags`: `plugin/c:num`');
  });
});
