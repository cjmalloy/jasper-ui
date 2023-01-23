import { Filter, RefFilter, RefPageArgs, RefSort } from '../model/ref';

export const defaultDesc = ['created', 'published', 'modified', 'rank', 'tagCount', 'commentCount', 'sourceCount', 'responseCount'];

export type UrlFilter = Filter |
  'internal' |
  'notInternal' |
  'modlist' |
  'comments' |
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
  let queryFilter = '';
  if (filters?.includes('internal')) {
    queryFilter += 'internal@*';
  } else if (filters?.includes('notInternal')) {
    if (filters?.includes('comments')) {
      queryFilter += '(!internal@*|plugin/comment@*)';
    } else {
      queryFilter += '!internal@*';
    }
  }
  if (filters?.includes('modlist')) {
    queryFilter += (queryFilter ? ':' : '') +  '!_moderated@*';
  }
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
    query,
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
  for (const i of filter) {
    if (['internal', 'notInternal', 'modlist'].includes(i)) continue;
    const f = i as Filter;
    if (f.startsWith('plugin/')) {
      result.pluginResponse = f;
    } else if (f.startsWith('-plugin/')) {
      result.noPluginResponse = f.substring(1);
    } else {
      result[f] = true;
    }
  }
  return result;
}
