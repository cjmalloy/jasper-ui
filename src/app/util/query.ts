import { RefFilter, RefQueryArgs } from '../service/api/ref.service';

export function filterListToObj(filter?: string[]) {
  if (!filter) return undefined;
  const result: Record<string, any> = {};
  for (const f of filter) {
    result[f] = true;
  }
  if (result.paid) {
    delete result.paid;
    result.pluginResponse = 'plugin/invoice/paid';
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

export function getArgs(
  tagOrSimpleQuery?: string,
  sort?: string | string[],
  filter?: (Record<string, any> & RefFilter) | string[],
  search?: string,
  pageNumber?: number,
  pageSize?: number
): RefQueryArgs {
  if (Array.isArray(filter)) {
    filter = filterListToObj(filter);
  }
  let queryFilter = '';
  if (filter && !filter.internal && !filter.pluginResponse && !filter.noPluginResponse) {
    queryFilter += ':!internal@*';
  }
  if (filter?.modlist) {
    queryFilter += ':!_moderated@*';
  }
  if (sort) {
    if (!Array.isArray(sort)) sort = [sort];
    for (let i = 0; i < sort.length; i++) {
      const s = sort[i];
      if (s === 'created' || s === 'published' || s === 'modified' || s === 'rank' || s === 'sourceCount' || s === 'responseCount') {
        sort[i] = s + ',desc';
      }
    }
  } else {
    sort = ['created,desc'];
  }
  const args: RefQueryArgs = {
    query: queryFilter && tagOrSimpleQuery ? `(${tagOrSimpleQuery})${queryFilter}` : tagOrSimpleQuery,
    sort,
    search,
    page: pageNumber,
    size: pageSize,
  };
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
