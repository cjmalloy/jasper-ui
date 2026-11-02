/// <reference types="vitest/globals" />
import {
  convertFilter,
  defaultDesc,
  getArgs,
  getFilter,
  getFilters,
  getFiltersQuery,
  negatable,
  negate,
  parseValueFilter,
  switchFilter,
  toggle,
  UrlFilter,
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
      const args = getArgs('science', 'metadata->field');
      expect(args.sort).toContain('metadata->field,DESC');
    });

    it('should preserve explicit direction for metadata-> sorts', () => {
      const args = getArgs('science', 'metadata->field,ASC');
      expect(args.sort).toContain('metadata->field,ASC');
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
      expect(args.modifiedBefore).toContain('2024-01-0');
      expect(args.modifiedAfter).toContain('2023-01-0');
    });

    it('should extract tag value filters', () => {
      const args = getArgs('science', undefined, [
        'tags->plugin/duration:dur/before/PT1H',
        'tags->plugin/duration:dur/after/pt5m',
        'tags->plugin/progress:num/after/9',
      ]);
      expect(args.tagBefore).toEqual(['tags->plugin/duration:dur/pt1h']);
      expect(args.tagAfter).toEqual(['tags->plugin/duration:dur/pt5m', 'tags->plugin/progress:num/9']);
      expect(args.pluginBefore).toBeUndefined();
    });

    it('should extract plugin value filters', () => {
      const args = getArgs('science', undefined, [
        'plugins->_plugin/cache->contentLength:num/after/1000',
        'plugins->plugin/test->title/before/B',
      ]);
      expect(args.pluginAfter).toEqual(['plugins->_plugin/cache->contentLength:num/1000']);
      expect(args.pluginBefore).toEqual(['plugins->plugin/test->title/B']);
      expect(args.tagBefore).toBeUndefined();
    });

    it('should skip value filters without a value', () => {
      const args = getArgs('science', undefined, ['tags->plugin/duration:dur/before/' as UrlFilter]);
      expect(args.tagBefore).toBeUndefined();
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

        expect(args.publishedBefore).toBe('2026-07-08T23:36:00.000Z');
      });

      it('should resolve now in published-before Ext defaults', () => {
        const args = getArgs('science', undefined, ['published/before/NoW']);

        expect(args.publishedBefore).toBe('2026-07-09T23:36:00.000Z');
      });

      it('should reject incomplete ISO durations', () => {
        const args = getArgs('science', undefined, ['published/before/P']);

        expect(args.publishedBefore).toBeNull();
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
      expect(args.pluginResponse).toContain('plugin/vote');
    });

    it('should handle negated plugin response filters', () => {
      const filters: UrlFilter[] = ['!plugin/vote' as UrlFilter];
      const args = getArgs('science', undefined, filters);
      expect(args.noPluginResponse).toContain('plugin/vote');
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

    it('should use before when it is empty', () => {
      expect(convertFilter({ sort: 'tags->plugin/duration:dur', before: '' }).filter)
        .toBe('tags->plugin/duration:dur/before/');
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
});
