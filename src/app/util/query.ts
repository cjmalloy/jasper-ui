import { isArray, uniq, without } from 'lodash-es';
import { Filter, RefFilter, RefPageArgs, RefSort } from '../model/ref';
import { FilterConfig, SortConfig, TagQueryArgs, TagSort } from '../model/tag';
import { braces, fixClientQuery, hasPrefix } from './tag';

// Suffixes for which defaultDesc should return true if sort ends with any of them
const DEFAULT_DESC_SUFFIXES = [':num', ':top', ':score', ':decay'];
const DEFAULT_DESC_EXACT = ['created', 'published', 'modified', 'metadata->modified', 'rank'];

export const defaultDesc = (sort: string) =>
  DEFAULT_DESC_EXACT.includes(sort) ||
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

export function negatable(filter: string) {
  if (!filter) return false;
  if (filter === 'obsolete') return true;
  return filter.startsWith('query/') || filter.startsWith('user/') || filter.startsWith('!') || hasPrefix(filter, 'plugin');
}

export function toggle(filter: UrlFilter): UrlFilter {
  if (filter.startsWith('query/')) {
    const query = filter.substring('query/'.length);
    if (query.startsWith('!(')) {
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
  }
  throw 'Can\'t convert filter';
}

export function convertSort(sort: SortConfig): SortItem {
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
  const query = queryFilter && tagOrSimpleQuery ? `${braces(tagOrSimpleQuery)}:${queryFilter}` : tagOrSimpleQuery || queryFilter;
  if (sort?.length) {
    sort = Array.isArray(sort) ? [...sort] : [sort];
    for (let i = 0; i < sort.length; i++) {
      const s = sort[i];
      if (defaultDesc(s)) {
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

export function getFilters(filters: UrlFilter[] | UrlFilter) {
  if (!filters) return [];
  return (isArray(filters) ? filters : [filters])
    .filter(f => f.startsWith('query/'))
    .map(f => getFilter(f as `query/${string}`));
}

export function getFilter(filter: `query/${string}`) {
  const query = filter.substring('query/'.length);
  if (!query.startsWith('!(')) return query;
  return negate(query.substring(2, query.length - 1));
}

export function negate(query: string): string {
  if (query.includes('(') || query.includes(':') && query.includes('|')) {
    // TODO: Parse query to negate
    console.error('Query parsing not implemented. Bailing on negate.');
    return query;
  }
  if (query.includes(':')) {
    return braces(query.split(':').map(negate).join('|'));
  }
  if (query.includes('|')) {
    return query.split('|').map(negate).join(':');
  }
  // Single tag
  if (query.startsWith('!')) return query.substring(1);
  return '!' + query;
}

export function getFiltersQuery(filters: UrlFilter[] | UrlFilter){
  return getFilters(filters).map(braces).join(':');
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
      result.modifiedBefore = f.substring('modified/before/'.length);
    } else if (f.startsWith('modified/after/')) {
      result.modifiedAfter = f.substring('modified/after/'.length);
    } else if (f.startsWith('published/before/')) {
      result.publishedBefore = f.substring('published/before/'.length);
    } else if (f.startsWith('published/after/')) {
      result.publishedAfter = f.substring('published/after/'.length);
    } else if (f.startsWith('created/before/')) {
      result.createdBefore = f.substring('created/before/'.length);
    } else if (f.startsWith('created/after/')) {
      result.createdAfter = f.substring('created/after/'.length);
    } else if (f.startsWith('response/before/')) {
      result.responseBefore = f.substring('response/before/'.length);
    } else if (f.startsWith('response/after/')) {
      result.responseAfter = f.substring('response/after/'.length);
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
  let result = query;
  for (const f of filter) {
    if (f.startsWith('query/')) {
      if (result) result += ':';
      result += braces(getFilter(f as `query/${string}`));
    }
  }
  return result;
}
