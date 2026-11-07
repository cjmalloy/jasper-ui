/// <reference types="vitest/globals" />
import { fixIndexConfig, hasFixable, hasIndexes, indexList, indexNeeds, missingIndexes } from './index-helper';

describe('Index Helper', () => {
  it('needs nothing without args', () => {
    expect(hasIndexes(indexNeeds())).toBe(false);
    expect(hasIndexes(indexNeeds({ query: '@*' }))).toBe(false);
    expect(hasIndexes(indexNeeds({ sort: ['url'] }))).toBe(false);
    expect(indexNeeds({ sort: ['created,DESC'] }).flags).toEqual(['created']);
  });

  it('flags sorts that cannot be indexed', () => {
    expect(indexNeeds({ sort: ['comment'] }).unindexed).toEqual(['comment']);
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

  it('needs the title index for title sorts', () => {
    expect(indexNeeds({ sort: ['title'] })).toEqual({ flags: ['title'], hotTags: [], hotPlugins: [], hotResponses: [], hotRemoteResponses: [], unindexed: [] });
    expect(indexNeeds({ sort: ['title,DESC'] }).flags).toEqual(['title']);
    expect(indexNeeds({ sort: ['published', 'title'] }).flags).toEqual(['published']);
    expect(missingIndexes(indexNeeds({ sort: ['title'] }), { title: false }).flags).toEqual(['title']);
    expect(missingIndexes(indexNeeds({ sort: ['title'] }), {}).flags).toEqual([]);
  });

  it('needs the origin index for origin queries, nesting and origin sorts', () => {
    expect(indexNeeds({ query: '@origin' })).toEqual({ flags: ['origin'], hotTags: [], hotPlugins: [], hotResponses: [], hotRemoteResponses: [], unindexed: [] });
    expect(indexNeeds({ query: '@origin.*' }).flags).toEqual(['origin']);
    expect(indexNeeds({ query: '@*' }).flags).toEqual([]);
    expect(indexNeeds({ query: 'science@*' }).flags).toEqual(['tags']);
    expect(indexNeeds({ query: '*' }).flags).toEqual(['origin']);
    expect(indexNeeds({ query: '@' }).flags).toEqual(['origin']);
    expect(indexNeeds({ query: 'science@' }).flags).toEqual(['tags', 'origin']);
    expect(indexNeeds({ query: 'science:!@' }).flags).toEqual(['tags', 'origin']);
    expect(indexNeeds({ query: '(science|math):*' }).flags).toEqual(['tags', 'origin']);
    expect(missingIndexes(indexNeeds({ query: '*' }), { origin: false }).flags).toEqual(['origin']);
    expect(missingIndexes(indexNeeds({ query: 'science@' }), { origin: false }).flags).toEqual(['origin']);
    expect(indexNeeds({ nesting: 0 }).flags).toEqual(['origin']);
    expect(indexNeeds({ sort: ['origin,DESC'] }).flags).toEqual(['origin']);
    expect(indexNeeds({ sort: ['origin:len'] }).flags).toEqual(['origin']);
    expect(indexNeeds({ sort: ['published', 'origin'] }).flags).toEqual(['published']);
    expect(missingIndexes(indexNeeds({ sort: ['origin'] }), { origin: false }).flags).toEqual(['origin']);
  });

  it('needs the tags index for tag queries', () => {
    expect(indexNeeds({ query: 'science@origin' }).flags).toEqual(['tags', 'origin']);
    expect(indexNeeds({ query: '+user/bob' }).flags).toEqual(['tags']);
  });

  it('needs flags for search, sources, responses and dates', () => {
    expect(indexNeeds({
      search: 'cats',
      sources: 'https://a.com',
      responses: 'https://b.com',
      filter: ['created/before/2020-01-01T00:00:00.000Z', 'published/after/2020-01-01T00:00:00.000Z', 'metadata->newReaction/after/2020-01-01T00:00:00.000Z'],
      sort: ['modified,DESC'],
    }).flags).toEqual(['fulltext', 'alts', 'responses', 'internalResponses', 'sources', 'modified', 'created', 'published', 'newReaction']);
  });

  it('needs array index flags for length sorts and filters', () => {
    expect(indexNeeds({ sort: ['tags:len,DESC'] })).toEqual({ flags: ['tags'], hotTags: [], hotPlugins: [], hotResponses: [], hotRemoteResponses: [], unindexed: [] });
    expect(indexNeeds({ sort: ['metadata->expandedTags'] }).flags).toEqual(['tags']);
    expect(indexNeeds({ sort: ['sources:len'] }).flags).toEqual(['sources']);
    expect(indexNeeds({ sort: ['alternateUrls:len,ASC'] }).flags).toEqual(['alts']);
    expect(indexNeeds({ sort: ['metadata->responses,DESC'] }).flags).toEqual(['responses']);
    expect(indexNeeds({ sort: ['metadata->internalResponses'] }).flags).toEqual(['internalResponses']);
    expect(indexNeeds({ sort: ['metadata->responses:len'] }).flags).toEqual(['responses']);
    expect(indexNeeds({ filter: ['sources:len/before/2', 'metadata->responses/after/3'] }).flags).toEqual(['sources', 'responses']);
    expect(indexNeeds({ sort: ['published', 'sources:len'] }).flags).toEqual(['published']);
    expect(missingIndexes(indexNeeds({ sort: ['metadata->responses'] }), { responses: false }).flags).toEqual(['responses']);
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
      filter: ['tags->plugin/progress:num/before/50', 'tags->plugin/title/after/m'],
    }).hotTags).toEqual(['plugin/progress:num', 'plugin/duration:dur', 'plugin/title']);
  });

  it('needs hot plugins for plugin sorts and filters', () => {
    expect(indexNeeds({
      sort: ['plugins->plugin/test->size:num,DESC', 'plugins->plugin/test->name'],
      filter: ['plugins->plugin/score:num/before/10', 'plugins->_plugin/cache->contentLength:num/after/1000'],
    }).hotPlugins).toEqual(['plugin/test->size:num', 'plugin/score:num', '_plugin/cache->contentLength:num']);
    expect(indexNeeds({ sort: ['plugins->plugin/ninja.triangle->ids[0]:num'] }).hotPlugins).toEqual(['plugin/ninja.triangle->ids[0]:num']);
    const invalid = indexNeeds({ sort: ['plugins->plugin/test->a.b,DESC'] });
    expect(invalid.hotPlugins).toEqual([]);
    expect(invalid.unindexed).toEqual(['plugins->plugin/test->a.b']);
  });

  it('needs hot responses for plugin response count sorts and filters', () => {
    const needs = indexNeeds({
      sort: ['metadata->remotePlugins->plugin/comment,DESC'],
      filter: ['metadata->plugins->plugin/thread/after/0', 'metadata->plugins->+plugin/log/equals/0'],
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
    expect(indexNeeds({ filter: ['metadata->remotePlugins->plugin/user/read/after/10'] }).hotRemoteResponses).toEqual(['plugin/user/read']);
    expect(indexNeeds({ filter: ['comment/after/a', 'plugins->plugin/user/vote:top/after/5'] }).unindexed).toEqual(['comment', 'plugins->plugin/user/vote:top']);
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
      filter: ['plugins->plugin/score:num/after/10', 'plugins->plugin/test->name/after/m'],
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
    const needs = indexNeeds({ filter: ['plugins->plugin/score:num/after/10'] });
    expect(missingIndexes(needs, {
      hotTags: [null as any],
      hotPlugins: [null as any, '', 'plugin/score:num'],
    })).toEqual({ flags: [], hotTags: [], hotPlugins: [], hotResponses: [], hotRemoteResponses: [], unindexed: [] });
  });

  it('fixes the config', () => {
    const config = { fulltext: false, hotTags: ['plugin/a', ''], hotPlugins: ['plugin/b'] };
    const missing = { flags: ['fulltext' as const], hotTags: ['plugin/c:num'], hotPlugins: [], hotResponses: [], hotRemoteResponses: [], unindexed: ['comment'] };
    expect(fixIndexConfig(missing, config)).toEqual({
      fulltext: true,
      hotTags: ['plugin/a', 'plugin/c:num'],
    });
    expect(indexList(missing)).toBe('* `fulltext`\n* `hotTags`: `plugin/c:num`');
  });
});
