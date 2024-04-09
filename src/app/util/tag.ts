import { filter, find, flatMap, isArray, uniq, without } from 'lodash-es';
import { Ref } from '../model/ref';
import { User } from '../model/user';

export function qualifyTags(tags: string[] | undefined, origin: string | undefined): string[] | undefined {
  if (!tags) return undefined;
  if (!origin) return tags;
  return tags.map(t => t + origin);
}

export function decompose(tag: string): [string, string] {
  if (!tag) return ['', ''];
  const index = tag.indexOf('@');
  if (index === -1) return [tag, ''];
  return [tag.substring(0, index), tag.substring(index)];
}

export function level(tag?: string) {
  return (tag?.match(/\//g)?.length || 0) + 1;
}

export function captures(selector: string, target: string): boolean {
  const [sTag, sOrigin] = decompose(selector);
  const [tTag, tOrigin] = decompose(target);
  if (sTag && !expandedTagsInclude(tTag, sTag)) return false;
  return sOrigin === '@*' || sOrigin === tOrigin;
}

export function capturesAny(selectors: string[] | undefined, target: string[] | undefined): string | undefined {
  if (!selectors || !target) return undefined;
  if (!selectors.length || !target.length) return undefined;
  for (const s of selectors) {
    for (const t of target) {
      if (captures(s, t)) return s;
    }
  }
  return undefined;
}

export function addHierarchicalTags(tag: string | undefined): string[]  {
  if (!tag) return [];
  const result = [tag];
  while (tag.includes('/')) {
    result.push(tag = tag.substring(0, tag.lastIndexOf('/')));
  }
  return result;
}

export function addAllHierarchicalTags(tags: string[] | undefined): string[]   {
  if (!tags || !tags.length) return [];
  return flatMap(tags, t => addHierarchicalTags(t))
}

export function getLargestPrefix(a?: string, b?: string) {
  for (const p of addHierarchicalTags(a)) {
    if (hasPrefix(b, p)) return p;
  }
  return '';
}

export function getStrictPrefix(a: string, b: string) {
  return getLargestPrefix(parentTag(a), parentTag(b));
}

export function hasDownwardsTag(tag: string | undefined, ref: Ref | string[] | undefined): boolean {
  if (!tag) return false;
  if (hasTag(tag, ref)) return true;
  if (privateTag(tag) && hasTag('+' + setPublic(tag), ref)) return true;
  return hasTag(setPublic(tag), ref);
}

export function hasTag(tag: string | undefined, ref: Ref | string[] | undefined): boolean {
  if (!tag) return false;
  if (tag.startsWith('-')) return !hasTag(tag.substring(1), ref);
  const tags = isArray(ref) ? ref : ref?.tags;
  if (!tags) return false;
  const not = tag.startsWith('!');
  if (not) tag = tag.substring(1);
  return !!find(tags, t => expandedTagsInclude(t, tag)) !== not;
}

export function test(query: string, ref: Ref | string[] | undefined) {
  if (!query) return false;
  const tags = isArray(ref) ? ref : ref?.tags;
  if (!tags) return false;
  if (query.includes('(') || query.includes(':') && query.includes('|')) {
    // TODO: Parse query
    console.error('Query parsing not implemented.');
    return false;
  }
  if (query.includes('|')) {
    return query.split('|').find(s => tags.find(t => expandedTagsInclude(s, t)));
  }
  if (query.includes(':')) {
    return !query.split(':').find(s => !tags.find(t => captures(s, t)));
  }
  return tags.find(t => captures(query, t));
}

export function hasAnyResponse(plugin: string | undefined, ref: Ref | undefined): boolean {
  if (!plugin) return false;
  for (const p of Object.keys(ref?.metadata?.plugins || {})) {
    if (hasPrefix(p, plugin)) return true;
  }
  return false;
}

export function hasResponse(plugin: string | undefined, ref: Ref | undefined): boolean {
  if (!plugin) return false;
  return !!ref?.metadata?.userUrls?.includes(plugin);
}

export function hasMedia(ref: Ref | undefined)  {
  if (!ref?.tags) return false;
  return hasTag('plugin/image', ref) ||
    hasTag('plugin/video', ref) ||
    hasTag('plugin/audio', ref) ||
    hasTag('plugin/embed', ref);
}

export function hasUserUrlResponse(tag?: string, ref?: Ref)  {
  if (!tag) return false;
  if (!ref?.metadata?.userUrls) return false;
  return !!find(ref.metadata.userUrls, t => expandedTagsInclude(t, tag));
}

export function tagIntersection(expand: string[] | undefined, targets: string[] | undefined) {
  if (!expand || !targets) return [];
  return filter(expand, target => targets.find(t => expandedTagsInclude(target, t)));
}

export function expandedTagsInclude(tag?: string, target?: string) {
  if (!tag || !target) return false;
  return tag === target || tag.startsWith(target + '/');
}

export function isAuthor(user: User, ref: Ref) {
  if (user.origin !== ref.origin) return false;
  return hasTag(user.tag, ref);
}

export function isOwner(user: User, ref: Ref) {
  if (user.origin !== ref.origin) return false;
  return hasDownwardsTag(user.tag, ref);
}

export function isAuthorTag(tag: string, ref?: Ref) {
  if (ref?.origin !== tagOrigin(tag)) return false;
  return hasTag(localTag(tag), ref);
}

export function isOwnerTag(tag: string, ref?: Ref) {
  if (ref?.origin !== tagOrigin(tag)) return false;
  return hasDownwardsTag(localTag(tag), ref);
}

export function localTag(tag?: string) {
  if (!tag) return '';
  if (!tag.includes('@')) return tag;
  return tag.substring(0, tag.indexOf('@'));
}

export function tagOrigin(tag?: string) {
  if (!tag) return '';
  if (!tag.includes('@')) return '';
  const origin = tag.substring(tag.indexOf('@'));
  if (origin === '@') return '';
  return origin;
}

export function defaultOrigin(tag: string, origin?: string) {
  if (!tag) return tag;
  if (!origin) return tag;
  if (tag.includes('*')) return tag;
  if (tag.includes('@')) return tag;
  return tag + origin;
}

export function isSubOrigin(local?: string, origin?: string) {
  if (!local) return true;
  if (!origin) return false;
  return origin.startsWith(local + '.');
}

export function subOrigin(local?: string, origin?: string) {
  if (!local) local = '';
  if (!origin) origin = '';
  if (origin && !origin.startsWith('@')) origin = '@' + origin;
  if (!local) return origin;
  if (!origin) return local;
  return local + '.' + origin.substring(1);
}

export function removeParentOrigin(local?: string, parent?: string) {
  if (!parent || !local) return local || ''
  if (local.startsWith(parent + '.')) return "@" + local.substring(parent.length + 1);
  return local;
}

export function implicitLocal(tag: string, local: string) {
  if (!tag) return tag;
  if (!tag.includes('@')) return tag;
  if (tagOrigin(tag) !== local) return tag;
  return localTag(tag);
}

/**
 * Join multiple tags together.
 * Ignores visibility modifiers '+' and '_' for all but the first tag in `rest` that has one.
 * Will leave existing visibility tag on `prefix` if none are in `rest`.
 * Uses the origin from the last tag in `rest`.
 */
export function prefix(prefix: string, ...rest: string[]) {
  let restAccess = access(rest.find(tag => access(tag)));
  if (restAccess) {
    prefix = restAccess + setPublic(prefix);
  }
  const origin = tagOrigin(rest[rest.length - 1]);
  return prefix + ('/' + rest.map(r => r.startsWith('@') ? r.substring(1) : localTag(setPublic(r))).join('/'))
    .replace(/\/\//g, '/')
    .replace(/\/$/, '') + origin;
}

export function hasPrefix(tag?: string, prefix?: string) {
  if (!tag) return false;
  if (!prefix) return true;
  return tag === prefix ||
    tag === '_' + prefix ||
    tag === '+' + prefix ||
    tag.startsWith(prefix + '/') ||
    tag.startsWith('_' + prefix + '/') ||
    tag.startsWith('+' + prefix + '/') ||
    tag.startsWith(prefix + '@') ||
    tag.startsWith('_' + prefix + '@') ||
    tag.startsWith('+' + prefix + '@');
}

export function directChild(child?: string, parent?: string) {
  return hasPrefix(child, parent) && level(child) - 1 === level(parent);
}

export function removePrefix(tag: string, count = 1) {
  return access(tag) + tag.split('/').slice(count).join('/');
}

export function getPrefixes(tag: string) {
  const not = tag.startsWith('!');
  if (not) tag = tag.substring(1);
  if (tag.startsWith('_') || tag.startsWith('+')) tag = tag.substring(1);
  return [tag, '+' + tag, '_' + tag].map(t => not ? '!' + t : t);
}

export function braces(query: string) {
  if (!query) return '';
  if (!query.includes('|')) return query;
  if (query.startsWith('(') && query.endsWith(')') && !query.substring(1, query.length-2).includes('(')) return query;
  return `(${query})`;
}

export function fixClientQuery(query: string) {
  return query.toLowerCase()
      .replace(/([^+|:!(])\+/g, '$1|')
      .replace(/[\s|]+/g, '|');
}

export function isQuery(query?: string) {
  if (!query) return false;
  if (query.startsWith('@')) return true;
  if (query === '*') return true;
  return /[:|!()]/g.test(query);
}

export function isSelector(selector?: string) {
  if (selector?.startsWith('!')) return isQuery(selector.substring(1))
  return isQuery(selector);
}

export function queryTags(query?: string): string[] {
  if (!query) return [];
  return query.split(/[:|()]/);
}

export function queryPrefix(query?: string): string {
  if (!query) return '';
  const parts = query.split(/[:|()]/).filter(t => !!t);
  return parts.reduce(getLargestPrefix, parts[0]);
}

export function topAnds(query?: string): string[] {
  if (!query) return [];
  const ors = query.split('|');
  ors.pop();
  let brackets = 0;
  for (const o of ors) {
    brackets += o.match(/\(/g)?.length || 0;
    brackets -= o.match(/\)/g)?.length || 0;
    if (!brackets) return []; // Top Level OR
  }
  const as = query.split(':');
  const result = [];
  brackets = 0;
  for (const a of as) {
    if (!brackets) {
      result.push(a);
    } else {
      result[result.length - 1] += a;
    }
    brackets += a.match(/\(/g)?.length || 0;
    brackets -= a.match(/\)/g)?.length || 0;
  }
  return result;
}

export function isPlugin(query?: string) {
  if (!query) return false;
  if (isQuery(query)) return false;
  return hasPrefix(query, 'plugin');
}

export function publicTag(tag: string) {
  return !tag.startsWith('_') && !tag.startsWith('+');
}

export function setPublic(tag: string) {
  if (!tag) return '';
 if (publicTag(tag)) return tag;
 return tag.substring(1);
}

export function privateTag(tag: string) {
  return tag.startsWith('_');
}

export function protectedTag(tag: string) {
  return tag.startsWith('+');
}

export function access(tag?: string) {
  if (!tag) return '';
  if (tag.startsWith('_')) return '_';
  if (tag.startsWith('+')) return '+';
  return '';
}

export function parentTag(tag: string): string | undefined {
  if (!tag.includes('/')) return undefined;
  return tag.substring(0, tag.lastIndexOf('/'));
}

export function removeTag(tag: string | string[] | undefined, tags: string[]): string[] {
  const ts = isArray(tag) ? tag : [tag];
  for (let t of ts) {
    while (t) {
      tags = without(tags, t);
      t = parentTag(t);
    }
  }
  return tags;
}

export function getVisibilityTags(tags?: string[]): string[] {
  if (!tags) return [];
  if (hasTag('public', tags)) return ['public'];
  return uniq(tags.filter(t => hasPrefix(t, 'user')).map(t => t.startsWith('+') ? t.substring(1) : t));
}

export function top(ref?: Ref) {
  if (!hasTag('plugin/comment', ref) && !hasTag('plugin/thread', ref)) return ref?.url || '';
  return ref!.sources?.[1] || ref!.sources?.[0] || ref!.url;
}

export function repost(ref?: Ref) {
  if (!hasTag('plugin/repost', ref)) return '';
  return ref!.sources?.[0] || '';
}

export function updateMetadata(parent: Ref, child: Ref) {
  parent.metadata ||= {};
  parent.metadata.plugins ||= {} as any;
  for (const plugin of ['plugin/comment', 'plugin/thread', '+plugin/log']) {
    if (hasTag(plugin, child)) {
      parent.metadata.plugins![plugin] ||= 0;
      parent.metadata.plugins![plugin]++;
    }
  }
  if (hasTag('internal', child)) {
    parent.metadata.internalResponses ||= 0;
    parent.metadata.internalResponses++;
  } else {
    parent.metadata.responses ||= 0;
    parent.metadata.responses++;
  }
}
