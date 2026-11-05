/// <reference types="vitest/globals" />
import { fixIndexConfig, hasFixable, hasIndexes, indexList, indexNeeds, missingIndexes } from './index-helper';

describe('Index Helper', () => {
  it('needs nothing without args', () => {
    expect(hasIndexes(indexNeeds())).toBe(false);
    expect(hasIndexes(indexNeeds({ query: '@*' }))).toBe(false);
    expect(hasIndexes(indexNeeds({ query: '*' }))).toBe(false);
    expect(hasIndexes(indexNeeds({ sort: ['url'] }))).toBe(false);
    expect(indexNeeds({ sort: ['created,DESC'] }).flags).toEqual(['created']);
  });

  it('flags sorts that cannot be indexed', () => {
    expect(indexNeeds({ sort: ['metadata->responses'] }).unindexed).toEqual(['metadata->responses']);
    expect(indexNeeds({ sort: ['metadata->newResponse,DESC'] })).toEqual({ flags: ['newResponse'], hotTags: [], hotPlugins: [], hotResponses: [], hotRemoteResponses: [], unindexed: [] });
    expect(indexNeeds({ sort: ['metadata->newReaction'] }).flags).toEqual(['newReaction']);
    expect(indexNeeds({ sort: ['published', 'metadata->newResponse'] }).flags).toEqual(['published']);
    expect(indexNeeds({ sort: ['url', 'title'] }).unindexed).toEqual([]);
    expect(indexNeeds({ sort: ['published', 'modified,ASC', 'origin,ASC'] }).unindexed).toEqual([]);
    const needs = indexNeeds({ sort: ['plugins->plugin/user/vote:score,DESC', 'title'] });
    expect(needs.unindexed).toEqual(['plugins->plugin/user/vote:score']);
    expect(hasIndexes(needs)).toBe(true);
    const missing = missingIndexes(needs, {});
    expect(missing.unindexed).toEqual(needs.unindexed);
    expect(hasFixable(missing)).toBe(false);
  });

  it('needs the tags index for tag queries', () => {
    expect(indexNeeds({ query: 'science@origin' }).flags).toEqual(['tags']);
    expect(indexNeeds({ query: '+user/bob' }).flags).toEqual(['tags']);
  });

  it('needs flags for search, sources, responses and dates', () => {
    expect(indexNeeds({
      search: 'cats',
      sources: 'https://a.com',
      responses: 'https://b.com',
      filterAfter: ['published/2020-01-01T00:00:00.000Z', 'metadata->newReaction/2020-01-01T00:00:00.000Z'],
      filterBefore: ['created/2020-01-01T00:00:00.000Z'],
      sort: ['modified,DESC'],
    }).flags).toEqual(['fulltext', 'alts', 'responses', 'internalResponses', 'sources', 'modified', 'created', 'published', 'newReaction']);
  });

  it('needs the alts index for url filters', () => {
    expect(indexNeeds({ url: 'https://a.com' }).flags).toEqual(['alts']);
  });

  it('needs the sources index for responses filters', () => {
    expect(indexNeeds({ responses: 'https://a.com' }).flags).toEqual(['sources']);
    expect(indexNeeds({ sources: 'https://a.com' }).flags).toEqual(['responses', 'internalResponses']);
  });

  it('needs hot tags for tag value sorts and filters', () => {
    expect(indexNeeds({
      sort: ['tags->plugin/progress:num,DESC', 'tags->plugin/duration:dur'],
      filterBefore: ['tags->plugin/progress:num/50'],
      filterAfter: ['tags->plugin/title/m'],
    }).hotTags).toEqual(['plugin/progress:num', 'plugin/duration:dur', 'plugin/title']);
  });

  it('needs hot plugins for plugin sorts and filters', () => {
    expect(indexNeeds({
      sort: ['plugins->plugin/test->size:num,DESC', 'plugins->plugin/test->name'],
      filterAfter: ['plugins->_plugin/cache->contentLength:num/1000'],
      filterBefore: ['plugins->plugin/score:num/10'],
    }).hotPlugins).toEqual(['plugin/test->size:num', 'plugin/score:num', '_plugin/cache->contentLength:num']);
    expect(indexNeeds({ sort: ['plugins->plugin/ninja.triangle->ids[0]:num'] }).hotPlugins).toEqual(['plugin/ninja.triangle->ids[0]:num']);
    const invalid = indexNeeds({ sort: ['plugins->plugin/test->a.b,DESC'] });
    expect(invalid.hotPlugins).toEqual([]);
    expect(invalid.unindexed).toEqual(['plugins->plugin/test->a.b']);
  });

  it('needs hot responses for plugin response count sorts and filters', () => {
    const needs = indexNeeds({
      sort: ['metadata->remotePlugins->plugin/comment,DESC'],
      filterAfter: ['metadata->plugins->plugin/thread/0'],
      filterEquals: ['metadata->plugins->+plugin/log/0'],
    });
    expect(needs).toEqual({
      flags: [],
      hotTags: [],
      hotPlugins: [],
      hotResponses: ['plugin/thread', '+plugin/log'],
      hotRemoteResponses: ['plugin/comment'],
      unindexed: [],
    });
    expect(indexNeeds({ sort: ['metadata->plugins->plugin/comment:num'] }).hotResponses).toEqual(['plugin/comment']);
    expect(indexNeeds({ sort: ['metadata->plugins->plugin/ninja.triangle'] }).hotResponses).toEqual(['plugin/ninja.triangle']);
    expect(indexNeeds({ sort: ['metadata->plugins->plugin.x'] }).unindexed).toEqual(['metadata->plugins->plugin.x']);
    expect(indexNeeds({ sort: ['published', 'metadata->remotePlugins->plugin/comment'] }).hotRemoteResponses).toEqual([]);
    expect(indexNeeds({ sort: ['metadata->plugins->plugin/comment->x'] }).unindexed).toEqual(['metadata->plugins->plugin/comment->x']);
    expect(indexNeeds({ filterAfter: ['metadata->remotePlugins->plugin/user/read/10'] }).hotRemoteResponses).toEqual(['plugin/user/read']);
    expect(indexNeeds({ filterAfter: ['metadata->responses/0', 'plugins->plugin/user/vote:top/5'] }).unindexed).toEqual(['metadata->responses', 'plugins->plugin/user/vote:top']);
    const missing = missingIndexes(needs, { hotResponses: ['plugin/thread'], hotRemoteResponses: [''] });
    expect(missing.hotResponses).toEqual(['+plugin/log']);
    expect(missing.hotRemoteResponses).toEqual(['plugin/comment']);
    expect(fixIndexConfig(missing, { hotResponses: ['plugin/thread'] })).toEqual({
      hotResponses: ['plugin/thread', '+plugin/log'],
      hotRemoteResponses: ['plugin/comment'],
    });
    expect(indexList(missing)).toBe('* `hotResponses`: `+plugin/log`\n* `hotRemoteResponses`: `plugin/comment`');
  });

  it('finds missing indexes', () => {
    const needs = indexNeeds({
      query: 'science',
      search: 'cats',
      sort: ['tags->plugin/progress:num'],
      filterAfter: ['plugins->plugin/score:num/10', 'plugins->plugin/test->name/m'],
    });
    const missing = missingIndexes(needs, {
      fulltext: false,
      hotTags: ['plugin/progress:num'],
      hotPlugins: ['plugins->plugin/score:num'],
    });
    expect(missing).toEqual({ flags: ['fulltext'], hotTags: [], hotPlugins: ['plugin/test->name'], hotResponses: [], hotRemoteResponses: [], unindexed: [] });
    expect(hasIndexes(missing)).toBe(true);
    expect(hasIndexes(missingIndexes(needs, {
      hotTags: ['plugin/progress:num'],
      hotPlugins: ['plugin/score:num', 'plugin/test->name'],
    }))).toBe(false);
  });

  it('ignores a disabled config', () => {
    const needs = indexNeeds({ search: 'cats', sort: ['tags->plugin/progress:num'] });
    expect(missingIndexes(needs, {
      disabled: true,
      fulltext: false,
      hotTags: ['plugin/progress:num'],
    })).toEqual({ flags: [], hotTags: ['plugin/progress:num'], hotPlugins: [], hotResponses: [], hotRemoteResponses: [], unindexed: [] });
  });

  it('skips blank hot indices', () => {
    const needs = indexNeeds({ filterAfter: ['plugins->plugin/score:num/10'] });
    expect(missingIndexes(needs, {
      hotTags: [null as any],
      hotPlugins: [null as any, '', 'plugin/score:num'],
    })).toEqual({ flags: [], hotTags: [], hotPlugins: [], hotResponses: [], hotRemoteResponses: [], unindexed: [] });
  });

  it('fixes the config', () => {
    const config = { fulltext: false, hotTags: ['plugin/a', ''], hotPlugins: ['plugin/b'] };
    const missing = { flags: ['fulltext' as const], hotTags: ['plugin/c:num'], hotPlugins: [], hotResponses: [], hotRemoteResponses: [], unindexed: ['title'] };
    expect(fixIndexConfig(missing, config)).toEqual({
      fulltext: true,
      hotTags: ['plugin/a', 'plugin/c:num'],
    });
    expect(indexList(missing)).toBe('* `fulltext`\n* `hotTags`: `plugin/c:num`');
  });
});
