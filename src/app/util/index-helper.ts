import { uniq } from 'lodash-es';
import { RefPageArgs } from '../model/ref';

/**
 * Config of the `_config/index` template. Missing flags default to true.
 */
export interface IndexConfig {
  /**
   * The server ignores a disabled `_config/index` and uses the defaults.
   */
  disabled?: boolean;
  tags?: boolean;
  sources?: boolean;
  alts?: boolean;
  responses?: boolean;
  internalResponses?: boolean;
  fulltext?: boolean;
  published?: boolean;
  modified?: boolean;
  created?: boolean;
  title?: boolean;
  newResponse?: boolean;
  newReaction?: boolean;
  ignored?: boolean;
  cascade?: boolean;
  regen?: boolean;
  hotTags?: string[];
  hotPlugins?: string[];
  hotResponses?: string[];
  hotRemoteResponses?: string[];
}

export type IndexFlag = 'tags' | 'sources' | 'alts' | 'responses' | 'internalResponses' | 'fulltext' | 'published' | 'modified' | 'created' | 'title' | 'newResponse' | 'newReaction';

/**
 * Indices used by a Ref query.
 */
export interface IndexNeeds {
  /**
   * Index flags in `_config/index` that must be enabled.
   */
  flags: IndexFlag[];
  /**
   * Tag value columns, without the `tags->` prefix.
   */
  hotTags: string[];
  /**
   * Plugin columns, without the `plugins->` prefix.
   */
  hotPlugins: string[];
  /**
   * Plugins counted in `metadata->plugins`, the responses from the same origin.
   */
  hotResponses: string[];
  /**
   * Plugins counted in `metadata->remotePlugins`, the responses from all origins.
   */
  hotRemoteResponses: string[];
  /**
   * Sort and filter columns that no `_config/index` setting can index.
   */
  unindexed: string[];
}

/**
 * Date columns with an index flag.
 */
const DATE_COLUMNS = ['published', 'modified', 'created'];

/**
 * Array length columns, indexed by the flag of their array index.
 */
const LENGTH_COLUMNS = new Map<string, IndexFlag>([
  ['tags:len', 'tags'],
  ['metadata->expandedTags', 'tags'],
  ['sources:len', 'sources'],
  ['alternateUrls:len', 'alts'],
  ['metadata->responses', 'responses'],
  ['metadata->internalResponses', 'internalResponses'],
]);

/**
 * The server ignores a `:num` or `:len` suffix on metadata columns.
 */
function lengthColumn(c: string) {
  return c.startsWith('metadata->') ? c.replace(/:(num|len)$/, '') : c;
}

/**
 * Sorts that are covered by the primary key, or rank search results.
 */
const INDEXABLE_SORTS = ['rank', 'url'];

/**
 * Sort or filter column without the `,ASC` direction or `/{value}` filter value.
 */
function column(value: string, prefix: string) {
  return value.substring(prefix.length);
}

function valueColumn(filter: string, prefix: string) {
  return column(filter.substring(0, filter.lastIndexOf('/')), prefix);
}

function sortColumn(sort: string) {
  return sort.replace(/,(ASC|DESC)$/i, '');
}

/**
 * Plugin tag pattern used by the server.
 */
const PLUGIN_REGEX = '[_+]?plugin(?:/[a-z0-9]+(?:[./][a-z0-9]+)*)?';
/**
 * Plugin column pattern the server accepts for hot plugins.
 */
const PLUGIN_COLUMN_REGEX = new RegExp('^' + PLUGIN_REGEX + '(?:->(?:[A-Za-z0-9_$-]+(?:\\[[0-9]{1,9}\\])?|\\[[0-9]{1,9}\\]))*(?::num|:len)?$');

/**
 * Plugin of a response count sort, or undefined if the sort is a deeper path.
 */
function responsePlugin(c: string, prefix: string) {
  const plugin = column(c, prefix).replace(/:num$/, '');
  return new RegExp('^' + PLUGIN_REGEX + '$').test(plugin) ? plugin : undefined;
}

/**
 * Whether the query selects any tags, not only origins.
 */
function queryHasTags(query?: string) {
  if (!query) return false;
  return /[a-z0-9]/.test(query.replace(/@[a-z0-9.]*/g, '').replace(/\*/g, ''));
}

/**
 * Work out which `_config/index` indices a Ref page query uses.
 */
export function indexNeeds(args?: RefPageArgs): IndexNeeds {
  const flags: IndexFlag[] = [];
  const hotTags: string[] = [];
  const hotPlugins: string[] = [];
  const hotResponses: string[] = [];
  const hotRemoteResponses: string[] = [];
  const unindexed: string[] = [];
  if (!args) return { flags, hotTags, hotPlugins, hotResponses, hotRemoteResponses, unindexed };
  if (queryHasTags(args.query)) flags.push('tags');
  // Search also matches the URL or alternate URLs
  if (args.search) flags.push('fulltext', 'alts');
  // URL filters also match alternate URLs
  if (args.url) flags.push('alts');
  // Sources filters look up the responses of the source, and responses filters look up the sources of the response
  if (args.sources) flags.push('responses', 'internalResponses');
  if (args.responses) flags.push('sources');
  // Filters and sorts on the same column use the same index
  const needs = (c: string) => {
    if (DATE_COLUMNS.includes(c)) {
      flags.push(c as IndexFlag);
    } else if (c === 'title') {
      flags.push('title');
    } else if (LENGTH_COLUMNS.has(lengthColumn(c))) {
      flags.push(LENGTH_COLUMNS.get(lengthColumn(c))!);
    } else if (c.startsWith('tags->')) {
      hotTags.push(column(c, 'tags->'));
    } else if (c === 'metadata->newResponse' || c === 'metadata->newReaction') {
      flags.push(column(c, 'metadata->') as IndexFlag);
    } else if (c.startsWith('metadata->plugins->') && responsePlugin(c, 'metadata->plugins->')) {
      hotResponses.push(responsePlugin(c, 'metadata->plugins->')!);
    } else if (c.startsWith('metadata->remotePlugins->') && responsePlugin(c, 'metadata->remotePlugins->')) {
      hotRemoteResponses.push(responsePlugin(c, 'metadata->remotePlugins->')!);
    } else if (c.startsWith('plugins->') && !c.startsWith('plugins->plugin/user/vote:') && PLUGIN_COLUMN_REGEX.test(column(c, 'plugins->'))) {
      // Vote sorts are computed and the server skips invalid columns
      hotPlugins.push(column(c, 'plugins->'));
    } else {
      unindexed.push(c);
    }
  };
  for (const [i, s] of (args.sort || []).entries()) {
    const c = sortColumn(s);
    if (DATE_COLUMNS.includes(c) || c.startsWith('tags->')) {
      needs(c);
    } else if (i > 0 || INDEXABLE_SORTS.includes(c)) {
      // Only the first sort can use an index, the rest are tie breakers
    } else {
      needs(c);
    }
  }
  for (const f of [...args.filterBefore || [], ...args.filterAfter || [], ...args.filterEquals || []]) {
    needs(valueColumn(f, ''));
  }
  return {
    flags: uniq(flags),
    hotTags: uniq(hotTags.filter(t => !!t)),
    hotPlugins: uniq(hotPlugins.filter(p => !!p)),
    hotResponses: uniq(hotResponses.filter(p => !!p)),
    hotRemoteResponses: uniq(hotRemoteResponses),
    unindexed: uniq(unindexed),
  };
}

function normalize(columns: string[] | undefined, prefix: string) {
  return (columns || []).filter(c => !!c).map(c => c.startsWith(prefix) ? c.substring(prefix.length) : c);
}

/**
 * The indices a query needs that are not in the `_config/index` config.
 */
export function missingIndexes(needs: IndexNeeds, config: IndexConfig = {}): IndexNeeds {
  if (config.disabled) config = {};
  const hotTags = normalize(config.hotTags, 'tags->');
  const hotPlugins = normalize(config.hotPlugins, 'plugins->');
  const hotResponses = normalize(config.hotResponses, '');
  const hotRemoteResponses = normalize(config.hotRemoteResponses, '');
  return {
    flags: needs.flags.filter(f => config[f] === false),
    hotTags: needs.hotTags.filter(t => !hotTags.includes(t)),
    hotPlugins: needs.hotPlugins.filter(p => !hotPlugins.includes(p)),
    hotResponses: needs.hotResponses.filter(p => !hotResponses.includes(p)),
    hotRemoteResponses: needs.hotRemoteResponses.filter(p => !hotRemoteResponses.includes(p)),
    unindexed: needs.unindexed,
  };
}

export function hasIndexes(needs: IndexNeeds) {
  return hasFixable(needs) || !!needs.unindexed.length;
}

/**
 * Whether any of the indices can be added to `_config/index`.
 */
export function hasFixable(needs: IndexNeeds) {
  return !!(needs.flags.length || needs.hotTags.length || needs.hotPlugins.length || needs.hotResponses.length || needs.hotRemoteResponses.length);
}

/**
 * Patch for the `_config/index` config that adds the missing indices.
 */
export function fixIndexConfig(missing: IndexNeeds, config: IndexConfig = {}): IndexConfig {
  const patch: IndexConfig = {};
  for (const f of missing.flags) patch[f] = true;
  if (missing.hotTags.length) patch.hotTags = uniq([...(config.hotTags || []).filter(t => !!t), ...missing.hotTags]);
  if (missing.hotPlugins.length) patch.hotPlugins = uniq([...(config.hotPlugins || []).filter(p => !!p), ...missing.hotPlugins]);
  if (missing.hotResponses.length) patch.hotResponses = uniq([...(config.hotResponses || []).filter(p => !!p), ...missing.hotResponses]);
  if (missing.hotRemoteResponses.length) patch.hotRemoteResponses = uniq([...(config.hotRemoteResponses || []).filter(p => !!p), ...missing.hotRemoteResponses]);
  return patch;
}

/**
 * Markdown list of the missing indices, for a request to the admin.
 */
export function indexList(missing: IndexNeeds) {
  return [
    ...missing.flags.map(f => `* \`${f}\``),
    ...missing.hotTags.map(t => `* \`hotTags\`: \`${t}\``),
    ...missing.hotPlugins.map(p => `* \`hotPlugins\`: \`${p}\``),
    ...missing.hotResponses.map(p => `* \`hotResponses\`: \`${p}\``),
    ...missing.hotRemoteResponses.map(p => `* \`hotRemoteResponses\`: \`${p}\``),
  ].join('\n');
}
