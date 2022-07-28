import { RefFilter, RefQueryArgs } from '../service/api/ref.service';

export function filterListToObj(filter?: string[] | string | {}): RefFilter | undefined {
  if (!filter) return undefined;
  let result: Record<string, any> = {};
  if (typeof filter === 'string' || filter instanceof String) filter = [filter];
  if (Array.isArray(filter)) {
    for (const f of filter) {
      result[f] = true;
    }
  } else {
    // is obj
    result = {...filter};
  }
  if (result.paid) {
    delete result.paid;
    result.pluginResponse = 'plugin/invoice/paid';
  }
  if (result.unpaid) {
    delete result.unpaid;
    result.noPluginResponse = 'plugin/invoice/paid';
  }
  if (result.rejected) {
    delete result.rejected;
    result.pluginResponse = 'plugin/invoice/rejected';
  }
  if (result.disputed) {
    delete result.disputed;
    result.pluginResponse = 'plugin/invoice/disputed';
  }
  return result;
}

export const defaultDesc = ['created', 'published', 'modified', 'rank', 'commentCount', 'sourceCount', 'responseCount'];

export function getArgs(
  tagOrSimpleQuery?: string,
  sort?: string | string[],
  filterOrList?: (Record<string, any> & RefFilter) | string[] | string,
  search?: string,
  pageNumber?: number,
  pageSize?: number
): RefQueryArgs {
  let filter: (Record<string, any> & RefFilter) | undefined = filterListToObj(filterOrList);
  let queryFilter = '';
  if (filter?.notInternal) {
    queryFilter += '!internal@*';
  }
  if (filter?.modlist) {
    queryFilter += (queryFilter ? ':' : '') +  '!_moderated@*';
  }
  const query = queryFilter && tagOrSimpleQuery ? `(${tagOrSimpleQuery}):${queryFilter}` : tagOrSimpleQuery || queryFilter;
  if (sort) {
    if (!Array.isArray(sort)) sort = [sort];
    for (let i = 0; i < sort.length; i++) {
      const s = sort[i];
      if (defaultDesc.includes(s)) {
        sort[i] = s + ',desc';
      }
    }
  } else {
    sort = ['created,desc'];
  }
  const args: RefQueryArgs = {
    query,
    sort,
    search,
    page: pageNumber,
    size: pageSize,
  };
  if (filter?.url) {
    args.url = filter.url;
  }
  if (filter?.sources) {
    args.sources = filter.sources;
  }
  if (filter?.responses) {
    args.responses = filter.responses;
  }
  if (filter?.uncited) {
    args.uncited = true;
  }
  if (filter?.unsourced) {
    args.unsourced = true;
  }
  if (filter?.pluginResponse) {
    args.pluginResponse = filter.pluginResponse;
  }
  if (filter?.noPluginResponse) {
    args.noPluginResponse = filter.noPluginResponse;
  }
  return args;
}
