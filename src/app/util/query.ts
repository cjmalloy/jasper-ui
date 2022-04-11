import { RefQueryArgs } from '../service/api/ref.service';

export function getArgs(tagOrSimpleQuery: string, sort?: string | string[], filter?: string[], search?: string): RefQueryArgs {
  let queryFilter = '';
  if (filter && !filter.includes('internal') && !filter.includes('paid') && !filter.includes('rejected') && !filter.includes('disputed')) {
    queryFilter += ':!internal@*';
  }
  if (filter?.includes('modlist')) {
    queryFilter += ':!_moderated@*';
  }
  tagOrSimpleQuery ??= '@*';
  const query = queryFilter ? `(${tagOrSimpleQuery})${queryFilter}` : tagOrSimpleQuery;
  if (sort) {
    if (!Array.isArray(sort)) sort = [sort];
    for (let i = 0; i < sort.length; i++) {
      const s = sort[i];
      if (s === 'created' || s === 'published' || s === 'modified' || s === 'rank') {
        sort[i] = s + ',desc';
      }
    }
  } else {
    sort = ['created,desc'];
  }
  const args: RefQueryArgs = { query, sort, search };
  if (filter?.includes('uncited')) {
    args.uncited = true;
  }
  if (filter?.includes('unsourced')) {
    args.unsourced = true;
  }
  if (filter?.includes('paid')) {
    args.pluginResponse = 'plugin/invoice/paid';
  }
  if (filter?.includes('rejected')) {
    args.pluginResponse = 'plugin/invoice/rejected';
  }
  if (filter?.includes('disputed')) {
    args.pluginResponse = 'plugin/invoice/disputed';
  }
  return args;
}
