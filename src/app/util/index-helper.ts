import { uniq } from 'lodash-es';
import { RefPageArgs } from '../model/ref';

/**
 * Config of the `_config/index` template. Missing flags default to true.
 */
export interface IndexConfig {
  tags?: boolean;
  sources?: boolean;
  alts?: boolean;
  responses?: boolean;
  internalResponses?: boolean;
  fulltext?: boolean;
  published?: boolean;
  modified?: boolean;
  ignored?: boolean;
  cascade?: boolean;
  regen?: boolean;
  hotTags?: string[];
  hotPlugins?: string[];
}

export type IndexFlag = 'tags' | 'sources' | 'responses' | 'internalResponses' | 'fulltext' | 'published' | 'modified';

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
}

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
 * Whether the query selects any tags, not only origins.
 */
function queryHasTags(query?: string) {
  if (!query) return false;
  return /[a-z0-9]/.test(query.replace(/@[a-z0-9.]*/g, '').replace(/\*/g, ''));
}

/**
 * Work out which `_config/index` indices a Ref page query uses.
 * Plugin sorts are skipped, since the server only uses hot plugin indexes for filters.
 */
export function indexNeeds(args?: RefPageArgs): IndexNeeds {
  const flags: IndexFlag[] = [];
  const hotTags: string[] = [];
  const hotPlugins: string[] = [];
  if (!args) return { flags, hotTags, hotPlugins };
  if (queryHasTags(args.query)) flags.push('tags');
  if (args.search) flags.push('fulltext');
  // Sources filters look up the responses of the source, and responses filters look up the sources of the response
  if (args.sources || args.noSources) flags.push('responses', 'internalResponses');
  if (args.responses || args.noResponses) flags.push('sources');
  if (args.publishedBefore || args.publishedAfter) flags.push('published');
  if (args.modifiedBefore || args.modifiedAfter) flags.push('modified');
  for (const s of args.sort || []) {
    const c = sortColumn(s);
    if (c === 'published') flags.push('published');
    if (c === 'modified') flags.push('modified');
    if (c.startsWith('tags->')) hotTags.push(column(c, 'tags->'));
  }
  for (const f of [...args.tagBefore || [], ...args.tagAfter || []]) {
    if (f.startsWith('tags->')) hotTags.push(valueColumn(f, 'tags->'));
  }
  for (const f of [...args.pluginBefore || [], ...args.pluginAfter || []]) {
    if (f.startsWith('plugins->')) hotPlugins.push(valueColumn(f, 'plugins->'));
  }
  return {
    flags: uniq(flags),
    hotTags: uniq(hotTags.filter(t => !!t)),
    hotPlugins: uniq(hotPlugins.filter(p => !!p)),
  };
}

function normalize(columns: string[] | undefined, prefix: string) {
  return (columns || []).map(c => c.startsWith(prefix) ? c.substring(prefix.length) : c);
}

/**
 * The indices a query needs that are not in the `_config/index` config.
 */
export function missingIndexes(needs: IndexNeeds, config: IndexConfig = {}): IndexNeeds {
  const hotTags = normalize(config.hotTags, 'tags->');
  const hotPlugins = normalize(config.hotPlugins, 'plugins->');
  return {
    flags: needs.flags.filter(f => config[f] === false),
    hotTags: needs.hotTags.filter(t => !hotTags.includes(t)),
    hotPlugins: needs.hotPlugins.filter(p => !hotPlugins.includes(p)),
  };
}

export function hasIndexes(needs: IndexNeeds) {
  return !!(needs.flags.length || needs.hotTags.length || needs.hotPlugins.length);
}

/**
 * Patch for the `_config/index` config that adds the missing indices.
 */
export function fixIndexConfig(missing: IndexNeeds, config: IndexConfig = {}): IndexConfig {
  const patch: IndexConfig = {};
  for (const f of missing.flags) patch[f] = true;
  if (missing.hotTags.length) patch.hotTags = uniq([...(config.hotTags || []).filter(t => !!t), ...missing.hotTags]);
  if (missing.hotPlugins.length) patch.hotPlugins = uniq([...(config.hotPlugins || []).filter(p => !!p), ...missing.hotPlugins]);
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
  ].join('\n');
}
