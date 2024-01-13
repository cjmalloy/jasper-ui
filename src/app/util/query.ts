import { isArray, uniq, without } from 'lodash-es';
import { Filter, RefFilter, RefPageArgs, RefSort } from '../model/ref';
import { TagQueryArgs } from '../model/tag';
import { braces, fixClientQuery, hasPrefix } from './tag';

export const defaultDesc = ['created', 'published', 'modified', 'metadataModified', 'rank', 'tagCount', 'commentCount', 'sourceCount', 'responseCount', 'voteCount', 'voteScore', 'voteScoreDecay'];

export type UrlFilter = Filter |
  `modified/before/${string}` |
  `modified/after/${string}` |
  `published/before/${string}` |
  `published/after/${string}` |
  `created/before/${string}` |
  `created/after/${string}` |
  `response/before/${string}` |
  `response/after/${string}` |
  `sources/${string}` |
  `responses/${string}` |
  `query/${string}` |
  `scheme/${string}` |
  `plugin/${string}` |
  `!plugin/${string}`;

export function toggle(filter: UrlFilter): UrlFilter {
  if (!filter.startsWith('query/')) return filter;
  const query = filter.substring('query/'.length);
  if (query.startsWith('!(')) {
    return 'query/' + query.substring(2, query.length - 1) as UrlFilter;
  } else {
    return 'query/!(' + query + ')' as UrlFilter;
  }
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
  filters = uniq(filters);
  let queryFilter = getFiltersQuery(filters);
  const query = queryFilter && tagOrSimpleQuery ? `(${tagOrSimpleQuery}):${queryFilter}` : tagOrSimpleQuery || queryFilter;
  if (sort?.length) {
    sort = Array.isArray(sort) ? [...sort] : [sort];
    for (let i = 0; i < sort.length; i++) {
      const s = sort[i];
      if (defaultDesc.includes(s)) {
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

export function getFilters(filters: UrlFilter[]) {
  return (filters || [])
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
  return getFilters(isArray(filters) ? filters : [filters]).join(':');
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
    if (f.startsWith('sources/')) {
      result.sources = f.substring('sources/'.length)
    } else if (f.startsWith('responses/')) {
      result.responses = f.substring('responses/'.length)
    } else if (f.startsWith('scheme/')) {
      result.scheme = f.substring('scheme/'.length)
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
