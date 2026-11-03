import { isArray, uniq, without } from 'lodash-es';
import { DateTime, Duration } from 'luxon';
import { Filter, RefFilter, RefPageArgs, RefSort } from '../model/ref';
import { FilterConfig, TagQueryArgs, TagSort } from '../model/tag';
import { andQueries, fixClientQuery, hasPrefix, isGroup, isNegatedGroup } from './tag';
import { serverValue } from './value-filter';

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
  `tags->${string}` |
  `plugins->${string}` |
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

/**
 * Parse a `{sort column}/before/{value}` or `{sort column}/after/{value}` filter,
 * such as `tags->plugin/duration:dur/before/pt5m`.
 * Sort columns may contain `/` but values cannot, so the value is always the last `/` segment.
 */
export function parseValueFilter(filter: string) {
  const match = filter.match(/^((?:tags|plugins)->.+)\/(before|after)\/([^/]*)$/);
  if (!match) return undefined;
  return { column: match[1], dir: match[2] as 'before' | 'after', value: match[3] };
}

/**
 * Switch to the next filter, keeping the value of the previous filter if they compare the same thing.
 * For example, switching from `modified/before/{date}` to `published/after/{default}` keeps the date,
 * and switching between before and after on the same sort column keeps the value.
 */
export function switchFilter(previous: UrlFilter, next: UrlFilter): UrlFilter {
  const date = /^(modified|response|published|created)\/(before|after)\//;
  if (date.test(previous) && date.test(next)) {
    return next.substring(0, next.lastIndexOf('/') + 1) + previous.substring(previous.lastIndexOf('/') + 1) as UrlFilter;
  }
  const p = parseValueFilter(previous);
  const n = parseValueFilter(next);
  if (p && n && p.column === n.column) return `${n.column}/${n.dir}/${p.value}` as UrlFilter;
  return next;
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
  } else if (filter.sort) {
    const dir = filter.before !== undefined ? 'before' : 'after';
    return { filter: `${filter.sort}/${dir}/${filter[dir]}`, label: filter.label || `${filter.sort} ${dir}`, title: filter.title };
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
    } else if (f.startsWith('tags->') || f.startsWith('plugins->')) {
      const v = parseValueFilter(f);
      if (!v?.value) {
        console.warn('Invalid value filter', f);
      } else if (v.column.startsWith('tags->')) {
        // Tag values are lowercase, so PT1H works like pt1h
        const key = v.dir === 'before' ? 'tagBefore' : 'tagAfter';
        result[key] = [...result[key] || [], v.column + '/' + serverValue(v.column, v.value).toLowerCase()];
      } else {
        const key = v.dir === 'before' ? 'pluginBefore' : 'pluginAfter';
        result[key] = [...result[key] || [], v.column + '/' + serverValue(v.column, v.value)];
      }
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

/**
 * Relative dates for date filters, from now back to 100 years ago.
 */
export const DATE_PRESETS = [
  'now',
  'PT1M',
  'PT15M',
  'PT1H',
  'PT6H',
  'PT24H',
  'P3D',
  'P7D',
  'P2W',
  'P1M',
  'P3M',
  'P1Y',
  'P5Y',
  'P15Y',
  'P50Y',
  'P100Y',
];

/**
 * Date filters with a value relative to now, like `now` or `P1D`.
 */
export function relativeDate(value: string) {
  return value.toLowerCase() === 'now' || Duration.fromISO(value.toUpperCase()).isValid;
}

export function relativeDateLabel(value: string) {
  if (value.toLowerCase() === 'now') return value.toLowerCase();
  const duration = Duration.fromISO(value.toUpperCase());
  return duration.isValid ? $localize`${duration.toHuman()}:DURATION: ago` : value;
}

/**
 * Index of the nearest {@link DATE_PRESETS} for a relative date.
 */
export function relativeDatePreset(value: string) {
  if (value.toLowerCase() === 'now') return 0;
  const index = DATE_PRESETS.indexOf(value.toUpperCase());
  if (index >= 0) return index;
  if (!relativeDate(value)) return 0;
  const duration = Duration.fromISO(value.toUpperCase()).as('milliseconds');
  return DATE_PRESETS.reduce((closest, preset, index) => {
    const milliseconds = preset === 'now' ? 0 : Duration.fromISO(preset).as('milliseconds');
    const closestMilliseconds = closest === 0 ? 0 : Duration.fromISO(DATE_PRESETS[closest]).as('milliseconds');
    return Math.abs(milliseconds - duration) < Math.abs(closestMilliseconds - duration) ? index : closest;
  }, 0);
}

/**
 * Value for a datetime-local input from a date filter value, like `now`, `P1D` or an ISO timestamp.
 */
export function dateTimeLocal(value: string) {
  let dt: DateTime;
  if (value.toLowerCase() === 'now') {
    dt = DateTime.now();
  } else if (value.toUpperCase().startsWith('P')) {
    const duration = Duration.fromISO(value.toUpperCase());
    if (!duration.isValid) return '';
    dt = DateTime.now().minus(duration);
  } else {
    dt = DateTime.fromISO(value);
  }
  return dt.isValid ? dt.toFormat("yyyy-MM-dd'T'T") : '';
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
      result.modifiedBefore = fixDateTime(f.substring('modified/before/'.length));
    } else if (f.startsWith('modified/after/')) {
      result.modifiedAfter = fixDateTime(f.substring('modified/after/'.length));
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
