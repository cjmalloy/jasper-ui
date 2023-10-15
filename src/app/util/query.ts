import { filter, uniq, without } from 'lodash-es';
import { Filter, RefPageArgs, RefQueryArgs, RefSort } from '../model/ref';
import { TagQueryArgs } from '../model/tag';
import { fixClientQuery, hasPrefix } from './tag';

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
  `query/${string}` |
  `scheme/${string}` |
  `plugin/${string}` |
  `!plugin/${string}`;

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
  if (filters?.includes('query/!internal') && filters?.includes('query/plugin/comment')) {
    filters = without(filters, 'query/!internal', 'query/plugin/comment');
    filters.push('query/(!internal|plugin/comment)');
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

export function getFilters(filters: UrlFilter[]){
  return filter(filters, f => f.startsWith('query/'))
    .map(f => f.substring('query/'.length));
}

export function getFiltersQuery(filters: UrlFilter[]){
  return getFilters(filters).join(':');
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

function getRefFilter(filter?: UrlFilter[]): RefQueryArgs {
  if (!filter) return {};
  let result: RefQueryArgs = {};
  for (const f of filter) {
    if (f.startsWith('query/')) continue;
    if (f.startsWith('scheme/')) {
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


export function getTagQueryFilter(filter?: UrlFilter[]): string {
  if (!filter) return '';
  let result = '';
  for (const f of filter) {
    if (f.startsWith('query/')) {
      result += ':(' + f.substring('query/'.length) + ')';
    }
  }
  return result;
}
