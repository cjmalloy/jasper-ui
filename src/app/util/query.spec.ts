/// <reference types="vitest/globals" />
import { DateTime } from 'luxon';
import {
  columnLabel,
  columnTags,
  convertFilter,
  dateTimeLocal,
  filterColumnTag,
  defaultDesc,
  filterLabel,
  filterTags,
  fixSorts,
  getArgs,
  getFilter,
  getFilters,
  getFiltersQuery,
  getTagFilter,
  negatable,
  negate,
  parseValueFilter,
  switchFilter,
  toggle,
  UrlFilter,
  validFilterColumn,
  validSortColumn,
  valueFilterConfig,
  withStableDateSort,
} from './query';

describe('Query Utils', () => {
  describe('defaultDesc', () => {
    it('should return true for exact matches', () => {
      expect(defaultDesc('created')).toBe(true);
      expect(defaultDesc('published')).toBe(true);
      expect(defaultDesc('modified')).toBe(true);
      expect(defaultDesc('rank')).toBe(true);
    });

    it('should return true for suffix matches', () => {
      expect(defaultDesc('vote:num')).toBe(true);
      expect(defaultDesc('vote:top')).toBe(true);
      expect(defaultDesc('vote:score')).toBe(true);
      expect(defaultDesc('vote:decay')).toBe(true);
    });

    it('should return true for prefix matches', () => {
      expect(defaultDesc('metadata->key')).toBe(true);
    });

    it('should return false for non-matching sorts', () => {
      expect(defaultDesc('title')).toBe(false);
      expect(defaultDesc('url')).toBe(false);
      expect(defaultDesc('random')).toBe(false);
    });
  });

  describe('negatable', () => {
    it('should return true for obsolete', () => {
      expect(negatable('obsolete')).toBe(true);
    });

    it('should return true for query filters', () => {
      expect(negatable('query/science')).toBe(true);
    });

    it('should return true for user filters', () => {
      expect(negatable('user/test')).toBe(true);
    });

    it('should return true for filters starting with !', () => {
      expect(negatable('!something')).toBe(true);
    });

    it('should return true for plugin filters', () => {
      expect(negatable('plugin/test')).toBe(true);
      expect(negatable('+plugin/test')).toBe(true);
      expect(negatable('_plugin/test')).toBe(true);
    });

    it('should return false for empty filter', () => {
      expect(negatable('')).toBe(false);
    });

    it('should return false for non-negatable filters', () => {
      expect(negatable('sources/test')).toBe(false);
      expect(negatable('responses/test')).toBe(false);
    });
  });

  describe('toggle', () => {
    it('should toggle query filter', () => {
      expect(toggle('query/science')).toBe('query/!(science)');
      expect(toggle('query/!(science)')).toBe('query/science');
    });

    it('should not unwrap partial negated groups', () => {
      expect(toggle('query/!(a|b):c')).toBe('query/!(!(a|b):c)');
      expect(toggle('query/!(!(a|b):c)')).toBe('query/!(a|b):c');
    });

    it('should toggle user filter', () => {
      expect(toggle('user/test')).toBe('user/!test');
      expect(toggle('user/!test')).toBe('user/test');
    });

    it('should toggle other filters with !', () => {
      expect(toggle('obsolete')).toBe('!obsolete');
      expect(toggle('!obsolete')).toBe('obsolete');
    });
  });

  describe('negate', () => {
    it('should negate single tag', () => {
      expect(negate('science')).toBe('!science');
    });

    it('should remove negation from negated tag', () => {
      expect(negate('!science')).toBe('science');
    });

    it('should wrap AND query in negated group', () => {
      expect(negate('a:b')).toBe('!(a:b)');
    });

    it('should wrap OR query in negated group', () => {
      expect(negate('a|b')).toBe('!(a|b)');
    });

    it('should wrap mixed query in negated group', () => {
      expect(negate('a:b|c')).toBe('!(a:b|c)');
    });

    it('should wrap queries with groups in a nested negated group', () => {
      expect(negate('(a|b):c')).toBe('!((a|b):c)');
      expect(negate('(a|b):(c|d)')).toBe('!((a|b):(c|d))');
      expect(negate('!(a|b):c')).toBe('!(!(a|b):c)');
      expect(negate('!(a:b):c')).toBe('!(!(a:b):c)');
      expect(negate('(a|b):c|d')).toBe('!((a|b):c|d)');
    });

    it('should unwrap negated group', () => {
      expect(negate('!(a:b)')).toBe('a:b');
      expect(negate('!(a|b)')).toBe('a|b');
    });

    it('should not double wrap a group covering the whole query', () => {
      expect(negate('(a|b)')).toBe('!(a|b)');
    });

    it('should be its own inverse', () => {
      for (const q of ['science', '!science', 'a:b', 'a|b', 'a:b|c', '(a|b):c', '(a|b):(c|d)']) {
        expect(negate(negate(q))).toBe(q);
      }
    });
  });

  describe('getFilter', () => {
    it('should return query without prefix', () => {
      expect(getFilter('query/science')).toBe('science');
    });

    it('should negate query if wrapped in !()', () => {
      expect(getFilter('query/!(science)')).toBe('!science');
    });

    it('should return negated group for complex negated filter', () => {
      expect(getFilter('query/!(a:b)')).toBe('!(a:b)');
      expect(getFilter('query/!(a|b)')).toBe('!(a|b)');
      expect(getFilter(toggle('query/a|b') as `query/${string}`)).toBe('!(a|b)');
    });

    it('should not unwrap partial negated groups', () => {
      expect(getFilter('query/!(a|b):c')).toBe('!(a|b):c');
      expect(getFilter('query/!(a|b):!(c|d)')).toBe('!(a|b):!(c|d)');
    });

    it('should keep nested negated groups when negating filters with groups', () => {
      expect(getFilter('query/!((a|b):c)')).toBe('!((a|b):c)');
      expect(getFilter(toggle('query/!(a|b):c') as `query/${string}`)).toBe('!(!(a|b):c)');
    });
  });

  describe('getFilters', () => {
    it('should extract query filters from array', () => {
      const filters: UrlFilter[] = ['query/science', 'sources/url', 'query/math'];
      expect(getFilters(filters)).toEqual(['science', 'math']);
    });

    it('should return empty array for empty input', () => {
      expect(getFilters([])).toEqual([]);
    });

    it('should handle single filter', () => {
      expect(getFilters('query/test' as UrlFilter)).toEqual(['test']);
    });
  });

  describe('getFiltersQuery', () => {
    it('should join query filters with :', () => {
      const filters: UrlFilter[] = ['query/science', 'query/math'];
      expect(getFiltersQuery(filters)).toBe('science:math');
    });

    it('should return empty string for no query filters', () => {
      expect(getFiltersQuery([])).toBe('');
    });

    it('should wrap OR queries in braces', () => {
      const filters: UrlFilter[] = ['query/a|b', 'query/c'];
      expect(getFiltersQuery(filters)).toBe('(a|b):c');
    });

    it('should not nest negated groups in braces', () => {
      const filters: UrlFilter[] = ['query/!(a|b)', 'query/c'];
      expect(getFiltersQuery(filters)).toBe('!(a|b):c');
    });

    it('should combine nested negated groups', () => {
      const filters: UrlFilter[] = ['query/!((a|b):c)', 'query/d|e'];
      expect(getFiltersQuery(filters)).toBe('!((a|b):c):(d|e)');
    });
  });

  describe('getArgs', () => {
    it('should return basic args with query', () => {
      const args = getArgs('science');
      expect(args.query).toBe('science');
    });

    it('should combine tag and filter query', () => {
      const args = getArgs('science', undefined, ['query/math' as UrlFilter]);
      expect(args.query).toBe('science:math');
    });

    it('should handle sort with DESC suffix', () => {
      const args = getArgs('science', 'created');
      expect(args.sort).toContain('created,DESC');
    });

    it('should handle array of sorts', () => {
      const args = getArgs('science', ['created', 'rank']);
      expect(args.sort).toContain('created,DESC');
      expect(args.sort).toContain('rank,DESC');
    });

    it('should add DESC for metadata-> prefix sorts', () => {
      const args = getArgs('science', 'metadata->responses');
      expect(args.sort).toContain('metadata->responses,DESC');
    });

    it('should preserve explicit direction for metadata-> sorts', () => {
      const args = getArgs('science', 'metadata->responses,ASC');
      expect(args.sort).toContain('metadata->responses,ASC');
    });

    it('should include pagination', () => {
      const args = getArgs('science', undefined, undefined, undefined, 2, 25);
      expect(args.page).toBe(2);
      expect(args.size).toBe(25);
    });

    it('should include search', () => {
      const args = getArgs('science', undefined, undefined, 'keyword');
      expect(args.search).toBe('keyword');
    });

    it('should extract date filters', () => {
      const filters: UrlFilter[] = [
        'modified/before/2024-01-02' as UrlFilter,
        'modified/after/2023-01-02' as UrlFilter
      ];
      const args = getArgs('science', undefined, filters);
      expect(args.filter).toEqual([
        expect.stringMatching(/^modified\/before\/2024-01-0.*Z$/),
        expect.stringMatching(/^modified\/after\/2023-01-0.*Z$/),
      ]);
    });

    it('should filter response dates on the new response date', () => {
      const args = getArgs('science', undefined, ['response/after/2024-01-01T00:00:00Z']);
      expect(args.filter).toEqual(['metadata->newResponse/after/2024-01-01T00:00:00.000Z']);
    });

    it('should extract tag value filters', () => {
      const args = getArgs('science', undefined, [
        'tags->plugin/duration:dur/before/PT1H',
        'tags->plugin/duration:dur/after/pt5m',
        'tags->plugin/progress:num/after/9',
      ]);
      expect(args.filter).toEqual([
        'tags->plugin/duration:dur/before/pt1h',
        'tags->plugin/duration:dur/after/pt5m',
        'tags->plugin/progress:num/after/9',
      ]);
    });

    it('should extract plugin value filters', () => {
      const args = getArgs('science', undefined, [
        'plugins->_plugin/cache->contentLength:num/after/1000',
        'plugins->plugin/test->title/before/B',
      ]);
      expect(args.filter).toEqual(['plugins->_plugin/cache->contentLength:num/after/1000', 'plugins->plugin/test->title/before/B']);
    });

    it('should extract response count filters', () => {
      const args = getArgs('science', undefined, [
        'metadata->remotePlugins->plugin/user/read/after/10',
        'metadata->remotePlugins->plugin/user/read/before/100',
      ]);
      expect(args.filter).toEqual(['metadata->remotePlugins->plugin/user/read/after/10', 'metadata->remotePlugins->plugin/user/read/before/100']);
    });

    it('should extract equals filters', () => {
      const args = getArgs('science', undefined, [
        'plugins->plugin/debug->select/equals/2',
        'tags->plugin/status/equals/Open',
      ]);
      expect(args.filter).toEqual(['plugins->plugin/debug->select/equals/2', 'tags->plugin/status/equals/open']);
    });

    it('should convert shorthand value filters', () => {
      const args = getArgs('science', undefined, [
        'tags->plugin/duration:dur/before/1h30m',
        'plugins->_plugin/cache->contentLength:num/after/10mb',
        'plugins->plugin/test->title/before/5b',
      ]);
      expect(args.filter).toEqual([
        'tags->plugin/duration:dur/before/pt1h30m',
        'plugins->_plugin/cache->contentLength:num/after/' + 10 * 1024 * 1024,
        'plugins->plugin/test->title/before/5b',
      ]);
    });

    it('should skip value filters without a value', () => {
      const args = getArgs('science', undefined, ['tags->plugin/duration:dur/before/' as UrlFilter]);
      expect(args.filter).toBeUndefined();
    });

    describe('relative date filters', () => {
      beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-09T23:36:00Z'));
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('should resolve ISO durations in published-before Ext defaults', () => {
        const args = getArgs('science', undefined, ['published/before/p1d']);

        expect(args.filter).toEqual(['published/before/2026-07-08T23:36:00.000Z']);
      });

      it('should resolve now in published-before Ext defaults', () => {
        const args = getArgs('science', undefined, ['published/before/NoW']);

        expect(args.filter).toEqual(['published/before/2026-07-09T23:36:00.000Z']);
      });

      it('should resolve relative dates in tag list filters', () => {
        expect(getTagFilter(['modified/after/P7D', 'modified/before/now'])).toEqual({
          filter: ['modified/after/2026-07-02T23:36:00.000Z', 'modified/before/2026-07-09T23:36:00.000Z'],
        });
      });

      it('should reject incomplete ISO durations', () => {
        const args = getArgs('science', undefined, ['published/before/P']);

        expect(args.filter).toBeUndefined();
      });
    });

    it('should extract source filters', () => {
      const filters: UrlFilter[] = ['sources/http://example.com' as UrlFilter];
      const args = getArgs('science', undefined, filters);
      expect(args.sources).toBe('http://example.com');
    });

    it('should extract response filters', () => {
      const filters: UrlFilter[] = ['responses/http://example.com' as UrlFilter];
      const args = getArgs('science', undefined, filters);
      expect(args.responses).toBe('http://example.com');
    });

    it('should handle scheme filter', () => {
      const filters: UrlFilter[] = ['scheme/https' as UrlFilter];
      const args = getArgs('science', undefined, filters);
      expect(args.scheme).toBe('https');
    });

    it('should handle obsolete filter', () => {
      const filters: UrlFilter[] = ['!obsolete'];
      const args = getArgs('science', undefined, filters);
      expect(args.obsolete).toBe(null);
    });

    it('should remove duplicate filters', () => {
      const filters: UrlFilter[] = ['query/science', 'query/science'];
      const args = getArgs(undefined, undefined, filters);
      expect(args.query).toBe('science');
    });

    it('should handle user response filters', () => {
      const filters: UrlFilter[] = ['user/plugin/vote/up' as UrlFilter];
      const args = getArgs('science', undefined, filters);
      expect(args.userResponse).toContain('plugin/vote/up');
    });

    it('should handle negated user response filters', () => {
      const filters: UrlFilter[] = ['user/!plugin/vote/up' as UrlFilter];
      const args = getArgs('science', undefined, filters);
      expect(args.noUserResponse).toContain('plugin/vote/up');
    });

    it('should handle plugin response filters', () => {
      const filters: UrlFilter[] = ['plugin/vote' as UrlFilter];
      const args = getArgs('science', undefined, filters);
      expect(args.filter).toEqual(['metadata->plugins->plugin/vote/after/0']);
    });

    it('should handle negated plugin response filters', () => {
      const filters: UrlFilter[] = ['!plugin/vote' as UrlFilter];
      const args = getArgs('science', undefined, filters);
      expect(args.filter).toEqual(['metadata->plugins->plugin/vote/equals/0']);
    });
  });

  describe('parseValueFilter', () => {
    it('should split tag value filters on the last direction', () => {
      expect(parseValueFilter('tags->plugin/before/x:dur/before/pt1h')).toEqual({
        column: 'tags->plugin/before/x:dur',
        dir: 'before',
        value: 'pt1h',
      });
    });

    it('should split plugin value filters on the last direction', () => {
      expect(parseValueFilter('plugins->plugin/name/after/x/before/kiwi')).toEqual({
        column: 'plugins->plugin/name/after/x',
        dir: 'before',
        value: 'kiwi',
      });
      expect(parseValueFilter('plugins->plugin/score:num/after/10')).toEqual({
        column: 'plugins->plugin/score:num',
        dir: 'after',
        value: '10',
      });
    });

    it('should parse equals filters', () => {
      expect(parseValueFilter('plugins->plugin/debug->select/equals/2')).toEqual({
        column: 'plugins->plugin/debug->select',
        dir: 'equals',
        value: '2',
      });
    });

    it('should reject invalid value filters', () => {
      expect(parseValueFilter('modified/before/now')).toBeUndefined();
      expect(parseValueFilter('tags->plugin/duration:dur/pt1h')).toBeUndefined();
      expect(parseValueFilter('plugins->plugin/score:num/10')).toBeUndefined();
    });
  });

  describe('switchFilter', () => {
    it('should keep the value when switching direction on the same sort column', () => {
      expect(switchFilter(
        'plugins->_plugin/cache->contentLength:num/after/5000',
        'plugins->_plugin/cache->contentLength:num/before/1000000',
      )).toBe('plugins->_plugin/cache->contentLength:num/before/5000');
    });

    it('should use the default value when switching to a different sort column', () => {
      expect(switchFilter('tags->plugin/duration:dur/after/pt5m', 'plugins->plugin/score:num/after/1000'))
        .toBe('plugins->plugin/score:num/after/1000');
    });

    it('should keep the date when switching between date filters', () => {
      expect(switchFilter('modified/before/2024-01-02', 'published/after/2026-01-01'))
        .toBe('published/after/2024-01-02');
    });

    it('should not keep values for other filters', () => {
      expect(switchFilter('query/science', 'tags->plugin/duration:dur/before/pt5m'))
        .toBe('tags->plugin/duration:dur/before/pt5m');
    });
  });

  describe('convertFilter', () => {
    it('should put the direction between the sort column and value', () => {
      expect(convertFilter({ sort: 'tags->plugin/duration:dur', before: 'pt5m', label: 'short' }).filter)
        .toBe('tags->plugin/duration:dur/before/pt5m');
      expect(convertFilter({ sort: 'plugins->_plugin/cache->contentLength:num', after: '1000' }).filter)
        .toBe('plugins->_plugin/cache->contentLength:num/after/1000');
    });

    it('should put equals between the sort column and value', () => {
      expect(convertFilter({ field: 'plugins->plugin/debug->select', equals: '1' }).filter)
        .toBe('plugins->plugin/debug->select/equals/1');
      expect(convertFilter({ field: 'tags->plugin/status', equals: 'open', label: 'open' }))
        .toEqual({ filter: 'tags->plugin/status/equals/open', label: 'open', title: undefined });
    });

    it('should use before when it is empty', () => {
      expect(convertFilter({ sort: 'tags->plugin/duration:dur', before: '' }).filter)
        .toBe('tags->plugin/duration:dur/before/');
    });
  });

  describe('valueFilterConfig', () => {
    it('should use field for equals filters and sort for before and after', () => {
      expect(valueFilterConfig(parseValueFilter('plugins->plugin/test->status/equals/open')!, 'g'))
        .toEqual({ group: 'g', field: 'plugins->plugin/test->status', equals: 'open' });
      expect(valueFilterConfig(parseValueFilter('plugins->plugin/score:num/before/10')!, 'g'))
        .toEqual({ group: 'g', sort: 'plugins->plugin/score:num', before: '10' });
    });
  });

  describe('filterColumnTag', () => {
    it('should read the tag of a sort or field filter', () => {
      expect(filterColumnTag({ field: 'plugins->_plugin/secret->status', equals: 'x' })).toBe('_plugin/secret');
      expect(filterColumnTag({ sort: 'tags->plugin/duration:dur', before: 'pt5m' })).toBe('plugin/duration');
      expect(filterColumnTag({ query: 'science' })).toBeUndefined();
    });
  });

  describe('switchFilter', () => {
    it('should keep the value when switching between equals and a bound on the same column', () => {
      expect(switchFilter('plugins->plugin/test->n:num/equals/3', 'plugins->plugin/test->n:num/after/0'))
        .toBe('plugins->plugin/test->n:num/after/3');
    });
  });

  describe('withStableDateSort', () => {
    it('adds modified and origin tie-breakers to date sorts', () => {
      expect(withStableDateSort({ sort: ['published,DESC'] }).sort).toEqual([
        'published,DESC',
        'modified,ASC',
        'origin,ASC',
      ]);
    });

    it('does not duplicate an existing modified tie-breaker', () => {
      expect(withStableDateSort({ sort: ['modified,DESC'] }).sort).toEqual([
        'modified,DESC',
        'origin,ASC',
      ]);
    });

    it('leaves non-date sorts unchanged', () => {
      const args = { sort: ['title,ASC' as const] };
      expect(withStableDateSort(args)).toBe(args);
    });
  });

  describe('dateTimeLocal', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-07-09T23:36:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('parses now case-insensitively', () => {
      expect(dateTimeLocal('NoW')).toBe(DateTime.fromISO('2026-07-09T23:36:00Z').toFormat("yyyy-MM-dd'T'T"));
    });

    it('subtracts ISO durations case-insensitively', () => {
      expect(dateTimeLocal('p1d')).toBe(DateTime.fromISO('2026-07-08T23:36:00Z').toFormat("yyyy-MM-dd'T'T"));
    });

    it('parses standard ISO timestamps', () => {
      expect(dateTimeLocal('2025-01-02T03:04:00Z')).toBe(DateTime.fromISO('2025-01-02T03:04:00Z').toFormat("yyyy-MM-dd'T'T"));
    });

    it('returns an empty value for malformed input', () => {
      expect(dateTimeLocal('P-invalid')).toBe('');
      expect(dateTimeLocal('not-a-date')).toBe('');
    });
  });
  describe('validSortColumn', () => {
    it('should only allow tags:len, not tag:len, on Refs', () => {
      expect(validSortColumn('ref', 'tags:len')).toBe(true);
      expect(validSortColumn('ref', 'tag:len')).toBe(false);
      expect(validSortColumn('ref', 'tag')).toBe(false);
      expect(validSortColumn('ref', 'name')).toBe(false);
      expect(validSortColumn('ref', 'config->x')).toBe(false);
    });

    it('should allow Ref columns on Refs', () => {
      for (const c of ['published', 'created', 'modified', 'title', 'url', 'scheme', 'origin', 'origin:len', 'sources:len', 'alternateUrls:len',
        'metadata->responses', 'plugins->plugin/user/vote:decay', 'tags->plugin/duration:dur']) {
        expect(validSortColumn('ref', c)).toBe(true);
      }
      expect(validSortColumn('ref', 'metadata->')).toBe(false);
      expect(validSortColumn('ref', '')).toBe(false);
      expect(validSortColumn('ref', undefined)).toBe(false);
    });

    it('should allow tag:len but not Ref columns on Exts, Users, Plugins and Templates', () => {
      for (const type of ['ext', 'user', 'plugin', 'template'] as const) {
        for (const c of ['modified', 'tag', 'tag:len', 'name', 'origin', 'origin:len']) {
          expect(validSortColumn(type, c)).toBe(true);
        }
        for (const c of ['published', 'created', 'title', 'tags:len', 'sources:len', 'metadata->responses', 'plugins->plugin/x', 'tags->plugin/x']) {
          expect(validSortColumn(type, c)).toBe(false);
        }
      }
    });

    it('should allow the JSON columns of each entity', () => {
      expect(validSortColumn('ext', 'config->pinned:len')).toBe(true);
      expect(validSortColumn('ext', 'external->ids')).toBe(false);
      expect(validSortColumn('user', 'external->ids:len')).toBe(true);
      expect(validSortColumn('user', 'config->x')).toBe(false);
      for (const type of ['plugin', 'template'] as const) {
        expect(validSortColumn(type, 'config->version:num')).toBe(true);
        expect(validSortColumn(type, 'defaults->x')).toBe(true);
        expect(validSortColumn(type, 'schema->x')).toBe(true);
        expect(validSortColumn(type, 'external->x')).toBe(false);
      }
    });
  });

  describe('validFilterColumn', () => {
    it('should not filter Refs on plain text columns that can only be sorted', () => {
      for (const c of ['title', 'url', 'scheme', 'origin', 'comment', 'rank']) {
        expect(validSortColumn('ref', c)).toBe(true);
        expect(validFilterColumn('ref', c)).toBe(false);
      }
    });

    it('should not sort or filter Refs on obsolete', () => {
      expect(validSortColumn('ref', 'obsolete')).toBe(false);
      expect(validFilterColumn('ref', 'obsolete')).toBe(false);
    });

    it('should only allow tag value columns with no suffix, :num or :dur', () => {
      for (const c of ['tags->plugin/progress', 'tags->plugin/progress:num', 'tags->plugin/duration:dur', 'tags->+user/x']) {
        expect(validFilterColumn('ref', c)).toBe(true);
      }
      for (const c of ['tags->plugin/progress:len', 'tags->Plugin', 'tags->plugin//x', 'tags->plugin/x->y']) {
        expect(validSortColumn('ref', c)).toBe(false);
      }
    });

    it('should only allow the generated metadata columns', () => {
      for (const c of ['metadata->newResponse', 'metadata->responses', 'metadata->responses:len', 'metadata->plugins->plugin/comment',
        'metadata->remotePlugins->plugin/user/read', 'metadata->plugins->plugin/thread:num']) {
        expect(validFilterColumn('ref', c)).toBe(true);
      }
      for (const c of ['metadata->x', 'metadata->plugins->plugin/comment->x', 'metadata->plugins->other']) {
        expect(validFilterColumn('ref', c)).toBe(false);
      }
    });

    it('should only allow plugin columns', () => {
      for (const c of ['plugins->plugin/test->ids:len', 'plugins->_plugin/cache->contentLength:num', 'plugins->plugin/user/vote:decay', 'plugins->plugin/debug->multicheckbox->a']) {
        expect(validFilterColumn('ref', c)).toBe(true);
      }
      for (const c of ['plugins->other', 'plugins->plugin/x:dur', 'plugins->plugin/user/vote:hot']) {
        expect(validFilterColumn('ref', c)).toBe(false);
      }
    });

    it('should filter other entities on their sort columns except plain text', () => {
      expect(validFilterColumn('ext', 'tag:len')).toBe(true);
      expect(validFilterColumn('ext', 'config->pinned:len')).toBe(true);
      expect(validFilterColumn('ext', 'tag')).toBe(false);
      expect(validFilterColumn('ext', 'name')).toBe(false);
      expect(validFilterColumn('user', 'external->ids:len')).toBe(true);
      expect(validFilterColumn('user', 'config->x')).toBe(false);
      expect(validFilterColumn('plugin', 'config->version:num')).toBe(true);
      expect(validFilterColumn('template', 'config->x:dur')).toBe(false);
    });
  });

  describe('fixSorts', () => {
    it('should map tag:len to tags:len on Refs', () => {
      expect(fixSorts('ref', ['tag:len'])).toEqual(['tags:len']);
      expect(fixSorts('ref', ['tag:len,DESC', 'published'])).toEqual(['tags:len,DESC', 'published']);
      expect(fixSorts('ref', ['tags:len', 'tag:len,DESC'])).toEqual(['tags:len']);
    });

    it('should drop columns Refs cannot be sorted by', () => {
      expect(fixSorts('ref', ['tag', 'name,DESC', 'config->x', 'modified'])).toEqual(['modified']);
    });

    it('should keep tag:len and drop Ref only columns on other entities', () => {
      expect(fixSorts('ext', ['tag:len', 'tag'])).toEqual(['tag:len', 'tag']);
      expect(fixSorts('user', ['published', 'tags:len', 'sources:len,DESC', 'metadata->responses', 'plugins->x', 'tags->x', 'name'])).toEqual(['name']);
    });

    it('should handle empty sorts', () => {
      expect(fixSorts('ref', undefined)).toEqual([]);
      expect(fixSorts('ref', ['' as any])).toEqual([]);
    });
  });

  describe('getArgs Ref columns', () => {
    it('should map a tag:len sort to tags:len', () => {
      expect(getArgs('science', 'tag:len' as any).sort).toEqual(['tags:len']);
      expect(getArgs('science', ['tag:len,DESC' as any, 'published']).sort).toEqual(['tags:len,DESC', 'published,DESC']);
    });

    it('should never send tag:len or non-Ref columns', () => {
      const args = getArgs('science', ['tag' as any, 'name' as any], ['tag:len/after/1' as UrlFilter, 'name:len/after/1' as UrlFilter]);
      expect(args.sort).toEqual([]);
      expect(args.filter).toEqual(['tags:len/after/1']);
      expect(JSON.stringify(args)).not.toContain('tag:len');
      expect(JSON.stringify(args)).not.toContain('name');
    });

    it('should drop saved obsolete sorts and filters on columns Refs cannot filter by', () => {
      expect(getArgs('science', ['obsolete' as any, 'title']).sort).toEqual(['title']);
      const args = getArgs('science', undefined, [
        'config->pinned:len/after/2', 'external->ids:len/after/1', 'title/equals/kiwi', 'tags->plugin/progress:len/after/1', 'metadata->x/after/1',
      ] as UrlFilter[]);
      expect(args.filter).toBeUndefined();
      expect(Object.keys(args).filter(k => k.includes('/'))).toEqual([]);
    });

    it('should send Ref length filters', () => {
      expect(getArgs('science', undefined, ['tags:len/before/3' as UrlFilter, 'sources:len/equals/0' as UrlFilter]).filter)
        .toEqual(['tags:len/before/3', 'sources:len/equals/0']);
    });
  });

  describe('URL only labels', () => {
    const names: Record<string, string> = {
      'plugin/duration': '⏱️ Duration',
      'plugin/comment': '💬️ Comment',
      'plugin/user/vote': '👍️ Vote',
      'science': '🔬️ Science',
    };
    const name = (tag: string) => names[tag];

    it('finds the tags a column reads', () => {
      expect(columnTags('tags->plugin/duration:dur')).toEqual(['plugin/duration']);
      expect(columnTags('plugins->plugin/user/vote:top')).toEqual(['plugin/user/vote']);
      expect(columnTags('plugins->plugin/x->a->b:num')).toEqual(['plugin/x']);
      expect(columnTags('metadata->plugins->plugin/comment')).toEqual(['plugin/comment']);
      expect(columnTags('metadata->remotePlugins->plugin/comment')).toEqual(['plugin/comment']);
      expect(columnTags('tags:len')).toEqual([]);
      expect(columnTags('metadata->responses')).toEqual([]);
    });

    it('finds the tags a filter reads', () => {
      expect(filterTags('tags->plugin/duration:dur/before/pt5m')).toEqual(['plugin/duration']);
      expect(filterTags('query/(science|math):!funny@other:@origin:*')).toEqual(['science', 'math', 'funny@other']);
      expect(filterTags('user/!plugin/user/hide')).toEqual(['plugin/user/hide']);
      expect(filterTags('!plugin/comment')).toEqual(['plugin/comment']);
      expect(filterTags('query/a/before/b')).toEqual(['a/before/b']);
      expect(filterTags('modified/before/2020-01-01')).toEqual([]);
      expect(filterTags('scheme/https:')).toEqual([]);
    });

    it('labels a column from the tag it reads', () => {
      expect(columnLabel('tags->plugin/duration:dur', name)).toBe('⏱️ Duration');
      expect(columnLabel('tags->unknown', name)).toBe('#unknown');
      expect(columnLabel('plugins->plugin/user/vote:top', name)).toBe('👍️ Vote top');
      expect(columnLabel('plugins->plugin/duration->seconds:num', name)).toBe('⏱️ Duration seconds');
      expect(columnLabel('plugins->plugin/duration->parts:len', name)).toBe('⏱️ Duration parts count');
      expect(columnLabel('metadata->plugins->plugin/comment', name)).toBe('💬️ Comment responses');
      expect(columnLabel('metadata->remotePlugins->plugin/comment', name)).toBe('💬️ Comment remote responses');
      expect(columnLabel('tags:len', name, [{ value: 'tags:len', label: '🏷️ tags' }])).toBe('🏷️ tags');
      expect(columnLabel('alternateUrls:len', name)).toBe('alternateUrls:len');
    });

    it('labels a filter', () => {
      expect(filterLabel('tags->plugin/duration:dur/before/pt5m', name)).toBe('⏱️ Duration <');
      expect(filterLabel('plugins->plugin/user/vote:top/after/3', name)).toBe('👍️ Vote top >');
      expect(filterLabel('plugins->plugin/duration->unit/equals/s', name)).toBe('⏱️ Duration unit =');
      expect(filterLabel('tags:len/after/3', name, [{ value: 'tags:len', label: '🏷️ tags' }])).toBe('🏷️ tags >');
      expect(filterLabel('query/(science|math):!funny:@origin', name)).toBe('(🔬️ Science|math):!funny:@origin');
      expect(filterLabel('query/a/before/b', name)).toBe('a/before/b');
      expect(filterLabel('!plugin/comment', name)).toBe('!💬️ Comment');
      expect(filterLabel('user/plugin/user/vote', name)).toBe('👍️ Vote');
      expect(filterLabel('modified/before/2020-01-01', name)).toBeUndefined();
      expect(filterLabel('scheme/https:', name)).toBeUndefined();
    });
  });
});
