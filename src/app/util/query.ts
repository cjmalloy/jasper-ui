import { isArray, uniq, without } from 'lodash-es';
import { DateTime, Duration } from 'luxon';
import { Filter, RefFilter, RefPageArgs, RefSort } from '../model/ref';
import { FilterConfig, TagQueryArgs, TagSort, ValueFilter } from '../model/tag';
import { andQueries, fixClientQuery, hasPrefix, isGroup, isNegatedGroup } from './tag';

const DEFAULT_DESC_SUFFIXES = [':num', ':top', ':score', ':decay'];
const DEFAULT_DESC_PREFIXES = ['metadata->'];
const DEFAULT_DESC_EXACT = ['created', 'published', 'modified', 'rank'];
const DATE_SORT_FIELDS = ['created', 'modified', 'published'];
export const defaultDesc = (sort: string) =>
  DEFAULT_DESC_EXACT.includes(sort) ||
  DEFAULT_DESC_PREFIXES.some(prefix => sort.startsWith(prefix)) ||
  DEFAULT_DESC_SUFFIXES.some(suffix => sort.endsWith(suffix));

export type FilterItem = { filter: UrlFilter, label: string, title?: string, time?: boolean };
export type FilterGroup = { filters: FilterItem[], label: string };
export type UrlFilter = Filter |
  `!obsolete` |
  `modified/before/${string}` |
  `modified/after/${string}` |
  `published/before/${string}` |
  `published/after/${string}` |
  `created/before/${string}` |
  `created/after/${string}` |
  `response/before/${string}` |
  `response/after/${string}` |
  `before/${ValueFilter}` |
  `after/${ValueFilter}` |
  `sources/${string}` |
  `noSources/${string}` |
  `responses/${string}` |
  `noResponses/${string}` |
  `query/${string}` |
  `noDescendents/${string}` |
  `scheme/${string}` |
  `user/${string}` |
  `plugin/${string}` |
  `+plugin/${string}` |
  `_plugin/${string}` |
  `!plugin/${string}` |
  `!+plugin/${string}` |
  `!_plugin/${string}`;

export type SortItem = { value: RefSort | TagSort, label: string, title?: string };

export function isValueFilter(filter: string) {
  return filter.startsWith('before/') || filter.startsWith('after/');
}

/**
 * Split a `before/` or `after/` value filter into the prefix up to and including the
 * `/` before the value, the sort column and the value.
 * Tag values are always after the last `/`. Plugin fields cannot contain `/`, so plugin
 * values start after the first `/` following the first field.
 */
export function splitValueFilter(filter: string): { prefix: string, column: string, value: string } | undefined {
  const dir = filter.startsWith('before/') ? 'before/' : filter.startsWith('after/') ? 'after/' : '';
  if (!dir) return undefined;
  const f = filter.substring(dir.length);
  let i = -1;
  if (f.startsWith('tags->')) {
    i = f.lastIndexOf('/');
    if (i <= 'tags->'.length) return undefined;
  } else if (f.startsWith('plugins->')) {
    const field = f.indexOf('->', 'plugins->'.length);
    if (field < 0) return undefined;
    i = f.indexOf('/', field);
  }
  if (i < 0) return undefined;
  return { prefix: dir + f.substring(0, i + 1), column: f.substring(0, i), value: f.substring(i + 1) };
}

/**
 * The tag or plugin a value filter sort column reads.
 */
export function valueFilterTag(column: string) {
  if (column.startsWith('tags->')) return column.substring('tags->'.length).replace(/:(num|dur)$/, '');
  if (column.startsWith('plugins->')) return column.substring('plugins->'.length).split('->')[0];
  return '';
}

export function negatable(filter: string) {
  if (!filter) return false;
  if (filter === 'obsolete') return true;
  return filter.startsWith('query/') || filter.startsWith('user/') || filter.startsWith('!') || hasPrefix(filter, 'plugin');
}

export function toggle(filter: UrlFilter): UrlFilter {
  if (filter.startsWith('query/')) {
    const query = filter.substring('query/'.length);
    if (isNegatedGroup(query)) {
      return 'query/' + query.substring(2, query.length - 1) as UrlFilter;
    } else {
      return 'query/!(' + query + ')' as UrlFilter;
    }
  }
  if (filter.startsWith('user/')) {
    const plugin = filter.substring('user/'.length);
    if (plugin.startsWith('!')) {
      return 'user/' + plugin.substring(1) as UrlFilter;
    } else {
      return 'user/!' + plugin as UrlFilter;
    }
  }
  if (filter.startsWith('!')) return filter.substring(1) as any;
  return '!' + filter as any;
}

export function convertFilter(filter: FilterConfig): FilterItem {
  if (filter.sources) {
    return { filter: `sources/${filter.sources}`, label: filter.label || filter.sources, title: filter.title };
  } else if (filter.responses) {
    return { filter: `responses/${filter.responses}`, label: filter.label || filter.responses, title: filter.title };
  } else if (filter.scheme) {
    return { filter: `scheme/${filter.scheme}`, label: filter.label || filter.scheme, title: filter.title };
  } else if (filter.query) {
    return { filter: `query/${filter.query}`, label: filter.label || filter.query, title: filter.title };
  } else if (filter.user) {
    return { filter: `user/${filter.user}`, label: filter.label || filter.user, title: filter.title };
  } else if (filter.response) {
    return { filter: filter.response, label: filter.label || filter.response, title: filter.title };
  } else if (filter.before) {
    return { filter: `before/${filter.before}`, label: filter.label || filter.before, title: filter.title };
  } else if (filter.after) {
    return { filter: `after/${filter.after}`, label: filter.label || filter.after, title: filter.title };
  }
  throw 'Can\'t convert filter';
}

export function convertSort(sort: any): SortItem {
  return { value: sort.sort as any, label: sort.label, title: sort.title };
}

export function getArgs(
  tagOrSimpleQuery?: string,
  sort?: RefSort | RefSort[],
  filters?: UrlFilter[],
  search?: string,
  pageNumber?: number,
  pageSize?: number
): RefPageArgs {
  if (filters?.includes('query/internal')) {
    filters = without(filters, 'query/!internal', 'query/internal');
  }
  if (filters?.includes('query/plugin/delete')) {
    filters = without(filters, 'query/!plugin/delete');
  }
  if (filters?.includes('user/plugin/user/hide')) {
    filters = without(filters, 'user/!plugin/user/hide');
  }
  filters = uniq(filters);
  let queryFilter = getFiltersQuery(filters);
  const query = queryFilter && tagOrSimpleQuery ? andQueries([tagOrSimpleQuery, ...getFilters(filters)]) : tagOrSimpleQuery || queryFilter;
  if (sort?.length) {
    sort = Array.isArray(sort) ? [...sort] : [sort];
    for (let i = 0; i < sort.length; i++) {
      const s = sort[i];
      if (!s.includes(',') && defaultDesc(s)) {
        sort[i] = s + ',DESC' as RefSort;
      }
    }
  } else {
    sort = [];
  }
  return {
    query: fixClientQuery(query),
    sort,
    search,
    page: pageNumber,
    size: pageSize,
    ...getRefFilter(filters),
  };
}

export function withStableDateSort(args: RefPageArgs): RefPageArgs {
  const sort = args.sort ?? [];
  const [primaryField] = sort[0]?.split(',') ?? [];
  if (!DATE_SORT_FIELDS.includes(primaryField)) return args;

  const sortFields = sort.map(value => value.split(',')[0]);
  return {
    ...args,
    sort: [
      ...sort,
      ...(!sortFields.includes('modified') ? ['modified,ASC' as const] : []),
      ...(!sortFields.includes('origin') ? ['origin,ASC' as const] : []),
    ],
  };
}

export function getFilters(filters: UrlFilter[] | UrlFilter) {
  if (!filters) return [];
  return (isArray(filters) ? filters : [filters])
    .filter(f => f.startsWith('query/'))
    .map(f => getFilter(f as `query/${string}`));
}

export function getFilter(filter: `query/${string}`) {
  const query = filter.substring('query/'.length);
  if (!isNegatedGroup(query)) return query;
  return negate(query.substring(2, query.length - 1));
}

export function negate(query: string): string {
  if (isNegatedGroup(query)) return query.substring(2, query.length - 1);
  if (isGroup(query)) return '!' + query;
  if (!/[:|()]/.test(fixClientQuery(query))) {
    // Single tag
    if (query.startsWith('!')) return query.substring(1);
    return '!' + query;
  }
  return `!(${query})`;
}

export function getFiltersQuery(filters: UrlFilter[] | UrlFilter){
  return andQueries(getFilters(filters));
}

export function parseArgs(params: any): RefPageArgs {
  params.page = params.pageNumber;
  delete params.pageNumber;
  params.size = params.pageSize;
  delete params.pageSize;
  return {
    ...params,
    ...getRefFilter(params.filter as any),
  };
}

function getRefFilter(filter?: UrlFilter[]): RefFilter {
  if (!filter) return {};
  let result: RefFilter = {};
  for (const f of filter) {
    if (f.startsWith('query/')) continue;
    if (f.startsWith('noDescendents/')) {
      if (result.noDescendents) console.warn('Multiple noDescendents filters (last wins)');
      result.noDescendents = f.substring('noDescendents/'.length)
    } else if (f.startsWith('sources/')) {
      if (result.sources) console.warn('Multiple sources filters (last wins)');
      result.sources = f.substring('sources/'.length)
    } else if (f.startsWith('noSources/')) {
      if (result.noSources) console.warn('Multiple noSources filters (last wins)');
      result.noSources = f.substring('noSources/'.length)
    } else if (f.startsWith('responses/')) {
      if (result.responses) console.warn('Multiple response filters (last wins)');
      result.responses = f.substring('responses/'.length)
    } else if (f.startsWith('noResponses/')) {
      if (result.noResponses) console.warn('Multiple noResponses filters (last wins)');
      result.noResponses = f.substring('noResponses/'.length)
    } else if (f.startsWith('scheme/')) {
      result.scheme = f.substring('scheme/'.length)
    } else if (f.startsWith('user/')) {
      const p = f.substring('user/'.length);
      if (hasPrefix(p, 'plugin')) {
        result.userResponse ||= [];
        result.userResponse.push(p);
      } else if (p.startsWith('!') && hasPrefix(p.substring(1), 'plugin')) {
        result.noUserResponse ||= [];
        result.noUserResponse.push(p.substring(1));
      }
    } else if (hasPrefix(f, 'plugin')) {
      result.pluginResponse ||= [];
      result.pluginResponse.push(f);
    } else if (f.startsWith('!') && hasPrefix(f.substring(1), 'plugin')) {
      result.noPluginResponse ||= [];
      result.noPluginResponse.push(f.substring(1));
    } else if (f.startsWith('modified/before/')) {
      result.modifiedBefore = fixDateTime(f.substring('modified/before/'.length));
    } else if (f.startsWith('modified/after/')) {
      result.modifiedAfter = fixDateTime(f.substring('modified/after/'.length));
    } else if (f.startsWith('published/before/')) {
      result.publishedBefore = fixDateTime(f.substring('published/before/'.length));
    } else if (f.startsWith('published/after/')) {
      result.publishedAfter = fixDateTime(f.substring('published/after/'.length));
    } else if (f.startsWith('created/before/')) {
      result.createdBefore = fixDateTime(f.substring('created/before/'.length));
    } else if (f.startsWith('created/after/')) {
      result.createdAfter = fixDateTime(f.substring('created/after/'.length));
    } else if (f.startsWith('response/before/')) {
      result.responseBefore = fixDateTime(f.substring('response/before/'.length));
    } else if (f.startsWith('response/after/')) {
      result.responseAfter = fixDateTime(f.substring('response/after/'.length));
    } else if (isValueFilter(f)) {
      const v = splitValueFilter(f);
      if (!v?.value) {
        console.warn('Invalid value filter', f);
        continue;
      }
      const before = f.startsWith('before/');
      const tags = v.column.startsWith('tags->');
      const value = tags ? v.value.toLowerCase() : v.value;
      const key = tags
        ? (before ? 'tagBefore' : 'tagAfter')
        : (before ? 'pluginBefore' : 'pluginAfter');
      result[key] ||= [];
      result[key].push(v.column + '/' + value);
    } else if (f === '!obsolete') {
      result['obsolete'] = null as any;
    } else if (f.startsWith('!')) {
      result[f.substring(1) as Filter] = false;
    } else {
      result[f as Filter] = true;
    }
  }
  return result;
}

export function fixDateTime(t: string) {
  const relative = t.toUpperCase();
  if (relative === 'NOW') return DateTime.now().toUTC().toISO()!;
  if (relative.startsWith('P') && /\d/.test(relative)) {
    const duration = Duration.fromISO(relative);
    if (duration.isValid) return DateTime.now().minus(duration).toUTC().toISO()!;
  }
  return DateTime.fromISO(t).toUTC().toISO()!;
}

export function getTagFilter(filter?: UrlFilter[]): TagQueryArgs {
  if (!filter) return {};
  let result: TagQueryArgs = {};
  for (const f of filter) {
    if (f.startsWith('modified/before/')) {
      result.modifiedBefore = f.substring('modified/before/'.length);
    } else if (f.startsWith('modified/after/')) {
      result.modifiedAfter = f.substring('modified/after/'.length);
    } else if (f == 'plugin/delete') {
      result.deleted = true;
    }
  }
  return result;
}

export function getTagQueryFilter(query: string, filter?: UrlFilter[]): string {
  if (!filter) return query;
  return andQueries([query, ...getFilters(filter)]);
}
