import { filter, uniq, without } from 'lodash-es';
import { Filter, RefFilter, RefPageArgs, RefSort } from '../model/ref';

export const defaultDesc = ['created', 'published', 'modified', 'rank', 'tagCount', 'commentCount', 'sourceCount', 'responseCount', 'voteCount', 'voteScore', 'voteScoreDecay'];

export type UrlFilter = Filter |
  `query/${string}` |
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

function getRefFilter(filter?: UrlFilter[]): RefFilter | undefined {
  if (!filter) return undefined;
  let result: any = {};
  for (const f of filter) {
    if (f.startsWith('query/')) continue;
    if (f.startsWith('plugin/')) {
      result.pluginResponse ||= [];
      result.pluginResponse.push(f);
    } else if (f.startsWith('-plugin/')) {
      result.noPluginResponse ||= [];
      result.noPluginResponse.push(f.substring(1));
    } else {
      result[f as Filter] = true;
    }
  }
  return result;
}
