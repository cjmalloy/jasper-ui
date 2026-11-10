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
  `metadata->${string}` |
  `sources/${string}` |
  `responses/${string}` |
  `query/${string}` |
  `scheme/${string}` |
  `user/${string}` |
  `plugin/${string}` |
  `+plugin/${string}` |
  `_plugin/${string}` |
  `!plugin/${string}` |
  `!+plugin/${string}` |
  `!_plugin/${string}`;

export type SortItem = { value: RefSort | TagSort, label: string, title?: string };

export type SortEntity = 'ref' | 'ext' | 'user' | 'plugin' | 'template';

const SORT_ENTITIES: SortEntity[] = ['ref', 'ext', 'user', 'plugin', 'template'];

const TAG_REGEX = '[_+]?[a-z0-9]+(?:[./][a-z0-9]+)*';
const PLUGIN_REGEX = '[_+]?plugin(?:/[a-z0-9]+(?:[./][a-z0-9]+)*)?';
const FIELD_REGEX = '(?:[A-Za-z0-9_$-]+(?:\\[[0-9]{1,9}\\])?|\\[[0-9]{1,9}\\])';

/**
 * Ref columns the server can filter on, which are also its computed sort columns.
 * Same as `SortSpec.Filter.REF_COLUMN_REGEX` in the server.
 * Refs have many tags, so the number of tags is `tags:len`.
 */
const REF_FILTER_COLUMN = new RegExp('^(?:modified|published|created|origin:len|(?:tags|sources|alternateUrls):len'
  + '|metadata->(?:newResponse|newReaction)'
  + '|metadata->(?:expandedTags|responses|internalResponses)(?::len)?'
  + '|metadata->(?:plugins|remotePlugins)->' + PLUGIN_REGEX + '(?::num)?'
  + '|plugins->plugin/user/vote:(?:top|score|decay)'
  + '|plugins->' + PLUGIN_REGEX + '(?:->' + FIELD_REGEX + ')*(?::num|:len)?'
  + '|tags->' + TAG_REGEX + '(?::num|:dur)?)$');

/**
 * JSON fields each entity other than Refs can be sorted and filtered by with `{field}->{path}`.
 */
const TAG_FIELDS: Record<Exclude<SortEntity, 'ref'>, string> = {
  ext: 'config',
  user: 'external',
  plugin: 'config|defaults|schema',
  template: 'config|defaults|schema',
};

/**
 * Filter columns of Exts, Users, Plugins and Templates.
 * Same as `SortSpec.Filter.TAG_COLUMN_REGEX` in the server, limited to the JSON fields of the entity.
 * These entities have a single tag, so `tag:len` is its nesting level.
 */
function tagFilterColumn(entity: Exclude<SortEntity, 'ref'>) {
  return new RegExp('^(?:modified|origin:len|tag:len|(?:' + TAG_FIELDS[entity] + ')(?:->' + FIELD_REGEX + ')+(?::num|:len)?)$');
}

/**
 * A JSON key in a sort path. Sorts use each `->` segment as a literal key, so keys are less restricted than in filters.
 * Keys cannot contain `:`, which starts a `:num` or `:len` suffix, or `,`, which separates the sort direction.
 */
const SORT_FIELD_REGEX = '(?:(?!->)[^:,])+';

/**
 * JSON sort columns of each entity, which accept more keys than filter columns.
 * Same as `SortSpec.jsonbColumn` in the server.
 */
function jsonSortColumn(entity: SortEntity) {
  const root = entity === 'ref' ? 'plugins->' + PLUGIN_REGEX + '(?:->' + SORT_FIELD_REGEX + ')*' : '(?:' + TAG_FIELDS[entity] + ')(?:->' + SORT_FIELD_REGEX + ')+';
  return new RegExp('^' + root + '(?::num|:len)?$');
}

/**
 * Plain columns that can be sorted but not filtered.
 */
const SORT_ONLY_COLUMNS: Record<SortEntity, string[]> = {
  ref: ['rank', 'url', 'origin', 'title', 'comment', 'scheme'],
  ext: ['tag', 'name', 'origin'],
  user: ['tag', 'name', 'origin'],
  plugin: ['tag', 'name', 'origin'],
  template: ['tag', 'name', 'origin'],
};

/**
 * Column of a `{column}` or `{column},{ASC|DESC}` sort.
 */
export function sortColumn(sort: string) {
  return sort.replace(/,(ASC|DESC)$/i, '');
}

/**
 * Whether the server accepts the filter column for this entity.
 */
export function validFilterColumn(entity: SortEntity, column?: string) {
  if (!column) return false;
  return (entity === 'ref' ? REF_FILTER_COLUMN : tagFilterColumn(entity)).test(column);
}

/**
 * Whether the server accepts the sort column for this entity.
 */
export function validSortColumn(entity: SortEntity, column?: string) {
  if (!column) return false;
  return SORT_ONLY_COLUMNS[entity].includes(column) || validFilterColumn(entity, column) || jsonSortColumn(entity).test(column);
}

/**
 * Fix up sorts from a URL or saved query for an entity.
 * On Refs `tag:len` is mapped to `tags:len`. Other columns the server would reject are dropped.
 */
export function fixSorts<T extends string>(entity: SortEntity, sorts?: T[]): T[] {
  if (!sorts) return [];
  const result: T[] = [];
  for (let s of sorts) {
    if (!s) continue;
    if (entity === 'ref' && sortColumn(s) === 'tag:len') s = 'tags:len' + s.substring('tag:len'.length) as T;
    const column = sortColumn(s);
    if (!validSortColumn(entity, column)) continue;
    if (result.some(r => sortColumn(r) === column)) continue;
    result.push(s);
  }
  return result;
}

/**
 * Parse a `{column}/before|after|equals/{value}` filter on any column the server can filter by, other than dates,
 * such as `tags->plugin/duration:dur/before/pt5m`, `tags:len/after/3` or `config->pinned:len/after/2`.
 * Columns may contain `/` but values cannot, so the value is always the last `/` segment.
 */
export function parseValueFilter(filter: string) {
  const match = filter.match(/^(.+)\/(before|after|equals)\/([^/]*)$/);
  if (!match || DATE_FILTER_COLUMNS[match[1]]) return undefined;
  if (!/^(?:tags|plugins|metadata)->/.test(match[1]) && !SORT_ENTITIES.some(entity => validFilterColumn(entity, match[1]))) return undefined;
  return { column: match[1], dir: match[2] as 'before' | 'after' | 'equals', value: match[3] };
}

/**
 * Filter config for a value filter that isn't in any mod.
 */
export function valueFilterConfig(v: NonNullable<ReturnType<typeof parseValueFilter>>, group: string): FilterConfig {
  const column = v.column as FilterConfig['sort'];
  if (v.dir === 'equals') return { group, field: column, equals: v.value };
  return { group, sort: column, [v.dir]: v.value };
}

/**
 * The tag a sort or field filter reads, used to check read access.
 */
export function filterColumnTag(config: FilterConfig) {
  return (config.field || config.sort)?.replace(/^(tags|plugins)->/, '').split(/->|:/)[0];
}

/**
 * Looks up the display name of a tag, such as the Ext, template or plugin name.
 */
export type TagName = (tag: string) => string | undefined;

/**
 * The tags a sort or filter column reads, such as `plugin/duration` in `tags->plugin/duration:dur`.
 */
export function columnTags(column: string): string[] {
  const match = column.match(new RegExp('^(?:tags|plugins|metadata->(?:plugins|remotePlugins))->(' + TAG_REGEX + ')'));
  return match ? [match[1]] : [];
}

/**
 * The tags in a query, without operators, negation or origin wildcards.
 */
export function queryTags(query: string): string[] {
  return query.split(/[:|()]/g)
    .map(t => t.startsWith('!') ? t.substring(1) : t)
    .filter(t => !!t && !t.startsWith('@') && !t.includes('*'));
}

/**
 * The tags a URL filter reads, to look up their display names.
 */
export function filterTags(filter: string): string[] {
  if (filter.startsWith('query/')) return queryTags(filter.substring('query/'.length));
  if (filter.startsWith('user/')) return queryTags(filter.substring('user/'.length));
  if (filter.startsWith('!') || hasPrefix(filter, 'plugin')) return queryTags(filter);
  const v = parseValueFilter(filter);
  return v ? columnTags(v.column) : [];
}

function baseColumnLabel(column: string): string | undefined {
  switch (column) {
    case 'created': return $localize`created`;
    case 'modified': return $localize`modified`;
    case 'published': return $localize`published`;
    case 'url': return $localize`url`;
    case 'origin': return $localize`origin`;
    case 'title': return $localize`title`;
    case 'comment': return $localize`comment`;
    case 'scheme': return $localize`scheme`;
    case 'tag': return $localize`tag`;
    case 'name': return $localize`name`;
    case 'tags:len': return $localize`tag count`;
  }
  return undefined;
}

/**
 * Readable label for a sort or filter column that may not be in any mod.
 * Uses the label of a known sort for the same column, or names the tag the column reads.
 */
export function columnLabel(column: string, name: TagName = () => undefined, known: SortItem[] = []): string {
  const label = known.find(s => s.value === column)?.label;
  if (label) return label;
  const tagLabel = (tag: string) => name(tag) || '#' + tag;
  const tag = columnTags(column)[0];
  if (!tag) return baseColumnLabel(column) || column;
  if (column.startsWith('tags->')) return tagLabel(tag);
  if (column.startsWith('metadata->plugins->')) return $localize`${tagLabel(tag)} responses`;
  if (column.startsWith('metadata->remotePlugins->')) return $localize`${tagLabel(tag)} remote responses`;
  const [path, suffix] = column.substring('plugins->'.length + tag.length).split(':');
  const fields = path.split('->').filter(f => !!f);
  const fieldsLabel = [tagLabel(tag), ...fields].join(' ');
  if (suffix === 'len') return $localize`${fieldsLabel} count`;
  if (suffix && suffix !== 'num') return fieldsLabel + ' ' + suffix;
  return fieldsLabel;
}

/**
 * Readable label for a URL filter that is not in any mod, or undefined if it has no generated label.
 */
export function filterLabel(filter: string, name: TagName = () => undefined, known: SortItem[] = []): string | undefined {
  const tagsLabel = (query: string) => query.replace(/[^:|()!]+/g, t => t.startsWith('@') || t.includes('*') ? t : name(t) || t);
  if (filter.startsWith('query/')) return tagsLabel(filter.substring('query/'.length));
  if (filter.startsWith('user/')) return tagsLabel(filter.substring('user/'.length));
  if (filter.startsWith('!') || hasPrefix(filter, 'plugin')) return tagsLabel(filter);
  const v = parseValueFilter(filter);
  if (!v) return undefined;
  return columnLabel(v.column, name, known) + ' ' + { before: '<', after: '>', equals: '=' }[v.dir];
}

/**
 * Switch to the next filter, keeping the value of the previous filter if they compare the same thing.
 * For example, switching from `modified/before/{date}` to `published/after/{default}` keeps the date,
 * and switching between before, after and equals on the same column keeps the value.
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
  } else if (filter.field) {
    return { filter: `${filter.field}/equals/${filter.equals ?? ''}`, label: filter.label || `${filter.field} =`, title: filter.title };
  } else if (filter.sort) {
    const dir = filter.before !== undefined ? 'before' : 'after';
    return { filter: `${filter.sort}/${dir}/${filter[dir] ?? ''}`, label: filter.label || `${filter.sort} ${dir}`, title: filter.title };
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
    sort = fixSorts('ref', Array.isArray(sort) ? sort : [sort]);
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
  const { filter, ...rest } = params;
  return {
    ...rest,
    ...getRefFilter(filter),
  };
}

function getRefFilter(filter?: UrlFilter[]): RefFilter {
  if (!filter) return {};
  let result: RefFilter = {};
  const add = (column: string, dir: 'before' | 'after' | 'equals', value: string) =>
    result.filter = [...result.filter || [], column + '/' + dir + '/' + value];
  for (const f of filter) {
    if (f.startsWith('query/')) continue;
    const date = dateFilter(f);
    const v = columnFilter(f);
    const valid = validColumnFilter('ref', f);
    if (date) {
      if (date.value) add(date.column, date.dir, date.value);
      else console.warn('Invalid date filter', f);
    } else if (f.startsWith('sources/')) {
      if (result.sources) console.warn('Multiple sources filters (last wins)');
      result.sources = f.substring('sources/'.length)
    } else if (f.startsWith('responses/')) {
      if (result.responses) console.warn('Multiple response filters (last wins)');
      result.responses = f.substring('responses/'.length)
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
      // Count of responses from the same origin
      add('metadata->plugins->' + f, 'after', '0');
    } else if (f.startsWith('!') && hasPrefix(f.substring(1), 'plugin')) {
      add('metadata->plugins->' + f.substring(1), 'equals', '0');
    } else if (v) {
      if (!valid) {
        console.warn('Invalid value filter', f);
      } else {
        // Tag values are lowercase, so PT1H works like pt1h
        const value = serverValue(valid.column, valid.value);
        add(valid.column, valid.dir, valid.column.startsWith('tags->') ? value.toLowerCase() : value);
      }
    } else if (/[/:]|->/.test(f)) {
      console.warn('Invalid filter', f);
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
 * Sort columns of the date filters. The response date is the date of the latest response.
 */
const DATE_FILTER_COLUMNS: Record<string, string> = {
  modified: 'modified',
  published: 'published',
  created: 'created',
  response: 'metadata->newResponse',
};

/**
 * Server filter for a `{date}/before|after/{value}` filter, like `modified/after/P1D`.
 */
function dateFilter(f: string) {
  const match = f.match(/^(modified|published|created|response)\/(before|after)\/(.*)$/);
  if (!match) return undefined;
  return {
    dir: match[2] as 'before' | 'after',
    column: DATE_FILTER_COLUMNS[match[1]],
    value: fixDateTime(match[3]),
  };
}

/**
 * Any `{column}/before|after|equals/{value}` filter.
 */
function columnFilter(f: string) {
  const match = f.match(/^(.+)\/(before|after|equals)\/([^/]*)$/);
  if (!match) return undefined;
  return {
    column: match[1],
    dir: match[2] as 'before' | 'after' | 'equals',
    value: match[3],
  };
}

/**
 * A `{column}/before|after|equals/{value}` filter the server accepts for this entity, or undefined.
 * On Refs `tag:len` is mapped to `tags:len`. Values cannot be empty or contain `,` or `->`.
 */
export function validColumnFilter(entity: SortEntity, f: string) {
  const v = columnFilter(f);
  if (!v || !v.value || /,|->/.test(v.value)) return undefined;
  if (entity === 'ref' && v.column === 'tag:len') v.column = 'tags:len';
  return validFilterColumn(entity, v.column) ? v : undefined;
}

/**
 * Add a date range on a date sort column to Ref page args, keeping their other filters.
 * Missing dates are skipped.
 */
export function dateRange(args: RefPageArgs, column: 'modified' | 'published' | 'created', after?: string | DateTime, before?: string | DateTime): RefPageArgs {
  const value = (dir: 'before' | 'after', date: string | DateTime) => column + '/' + dir + '/' + (DateTime.isDateTime(date) ? date.toUTC().toISO() : date);
  const filter = [...args.filter || []];
  if (after) filter.push(value('after', after));
  if (before) filter.push(value('before', before));
  return filter.length ? { ...args, filter } : { ...args };
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

export function getTagFilter(filter?: UrlFilter[], entity: Exclude<SortEntity, 'ref'> = 'ext'): TagQueryArgs {
  if (!filter) return {};
  let result: TagQueryArgs = {};
  for (const f of filter) {
    const date = f.startsWith('modified/') && dateFilter(f);
    const column = validColumnFilter(entity, f);
    if (date) {
      if (date.value) result.filter = [...result.filter || [], date.column + '/' + date.dir + '/' + date.value];
      else console.warn('Invalid date filter', f);
    } else if (f == 'plugin/delete') {
      result.deleted = true;
    } else if (column) {
      result.filter = [...result.filter || [], column.column + '/' + column.dir + '/' + column.value];
    }
  }
  return result;
}

export function getTagQueryFilter(query: string, filter?: UrlFilter[]): string {
  if (!filter) return query;
  return andQueries([query, ...getFilters(filter)]);
}
