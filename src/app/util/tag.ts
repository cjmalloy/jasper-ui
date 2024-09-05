import { filter, find, flatMap, without } from 'lodash-es';
import { Ref } from '../model/ref';
import { User } from '../model/user';

export function qualifyTags(tags: string[] | undefined, origin: string | undefined): string[] | undefined {
  if (!tags) return undefined;
  if (!origin) return tags;
  return tags.map(t => t + origin);
}

export function decompose(tag: string): [string, string] {
  const index = tag.indexOf('@');
  if (index === -1) return [tag, ''];
  return [tag.substring(0, index), tag.substring(index)];
}

export function captures(selector: string, target: string): boolean {
  const [sTag, sOrigin] = decompose(selector);
  const [tTag, tOrigin] = decompose(target);
  if (sTag && !hasPrefix(target, selector)) return false;
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

export function hasTag(tag: string | undefined, ref: Ref | undefined): boolean {
  if (!tag) return false;
  if (tag.startsWith('-')) return !hasTag(tag.substring(1), ref);
  if (!ref?.tags) return false;
  const not = tag.startsWith('!');
  if (not) tag = tag.substring(1);
  return !!find(ref.tags, t => expandedTagsInclude(t, tag)) !== not;
}

export function hasAnyResponse(plugin: string | undefined, ref: Ref | undefined): boolean {
  if (!plugin) return false;
  return !!ref?.metadata?.plugins?.[plugin];
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
  return filter(targets, target => includesTag(target, expand));
}

export function includesTag(target: string, tags?: string[])  {
  if (!target) return false;
  return !!find(tags, t => expandedTagsInclude(t, target));
}

export function expandedTagsInclude(tag?: string, target?: string) {
  if (!tag || !target) return false;
  return tag === target || tag.startsWith(target + '/');
}

export function isOwner(user: User, ref: Ref) {
  if (user.origin !== ref.origin) return false;
  return hasTag(user.tag, ref);
}

export function isOwnerTag(tag: string, ref?: Ref) {
  if (ref?.origin !== tagOrigin(tag)) return false;
  return hasTag(localTag(tag), ref);
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
  return localTag(tag) + origin;
}

export function subOrigin(local?: string, origin?: string) {
  if (!local) local = "";
  if (!origin) origin = "";
  if (!local) return origin;
  if (!origin) return local;
  if (origin.startsWith("@")) origin = origin.substring(1);
  return local + '.' + origin;
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

export function removePrefix(tag: string, count = 1) {
  return tag.split('/').slice(count).join('/');
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

export function removeTag(tag: string | undefined, tags: string[]): string[] {
  while (tag) {
    tags = without(tags, tag);
    tag = parentTag(tag);
  }
  return tags;
}

export function top(ref?: Ref) {
  return ref?.sources?.[1] || ref?.sources?.[0] || ref?.url || '';
}
