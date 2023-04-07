import { filter, uniq, without } from 'lodash-es';
import { Filter, RefPageArgs, RefQueryArgs, RefSort } from '../model/ref';
import { TagQueryArgs } from '../model/tag';

export const defaultDesc = ['created', 'published', 'modified', 'rank', 'tagCount', 'commentCount', 'sourceCount', 'responseCount', 'voteCount', 'voteScore', 'voteScoreDecay'];

export type UrlFilter = Filter |
  `modified/before/${string}` |
  `modified/after/${string}` |
  `published/before/${string}` |
  `published/after/${string}` |
  `created/before/${string}` |
  `created/after/${string}` |
  `query/${string}` |
  `scheme/${string}` |
  `plugin/${string}` |
  `-plugin/${string}`;

export function getArgs(
  tagOrSimpleQuery?: string,
  sort?: RefSort | RefSort[],
  filters?: UrlFilter[],
  search?: string,
  pageNumber?: number,
  pageSize?: number
): RefPageArgs {
  if (filters?.includes('query/internal@*')) {
    filters = without(filters, 'query/!internal@*', 'query/internal@*');
  }
  if (filters?.includes('query/!internal@*') && filters?.includes('query/plugin/comment@*')) {
    filters = without(filters, 'query/!internal@*', 'query/plugin/comment@*');
    filters.push('query/(!internal@*|plugin/comment@*)');
  }
  filters = uniq(filters);
  let queryFilter = filter(filters, f => f.startsWith('query/')).map(f => f.substring('query/'.length)).join(':');
  const query = queryFilter && tagOrSimpleQuery ? `(${tagOrSimpleQuery}):${queryFilter}` : tagOrSimpleQuery || queryFilter;
  if (sort) {
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
    query: query.replace(/\s/g, ''),
    sort,
    search,
    page: pageNumber,
    size: pageSize,
    ...getRefFilter(filters),
  };
}

function getRefFilter(filter?: UrlFilter[]): RefQueryArgs {
  if (!filter) return {};
  let result: RefQueryArgs = {};
  for (const f of filter) {
    if (f.startsWith('query/')) continue;
    if (f.startsWith('scheme/')) {
      result.scheme = f.substring('scheme/'.length)
    } else if (f.startsWith('plugin/')) {
      result.pluginResponse ||= [];
      result.pluginResponse.push(f);
    } else if (f.startsWith('-plugin/')) {
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
