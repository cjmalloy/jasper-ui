/// <reference types="vitest/globals" />
import { defaultDesc, getArgs, getFilter, getFilters, getFiltersQuery, negate, negatable, toggle, UrlFilter } from './query';

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

    it('should convert AND to OR with negated tags', () => {
      expect(negate('a:b')).toBe('(!a|!b)');
    });

    it('should convert OR to AND with negated tags', () => {
      expect(negate('a|b')).toBe('!a:!b');
    });
  });

  describe('getFilter', () => {
    it('should return query without prefix', () => {
      expect(getFilter('query/science')).toBe('science');
    });

    it('should negate query if wrapped in !()', () => {
      expect(getFilter('query/!(science)')).toBe('!science');
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
        'modified/before/2024-01-01' as UrlFilter,
        'modified/after/2023-01-01' as UrlFilter
      ];
      const args = getArgs('science', undefined, filters);
      expect(args.modifiedBefore).toBe('2024-01-01');
      expect(args.modifiedAfter).toBe('2023-01-01');
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
});
