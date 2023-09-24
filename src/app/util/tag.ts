import { filter, find, flatMap, without } from 'lodash-es';
import { Ref } from '../model/ref';
import { User } from '../model/user';

export function qualifyTags(tags?: string[], origin?: string): string[] | undefined {
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

export function capturesAny(selectors?: string[], target?: string[]): string | undefined {
  if (!selectors || !target) return undefined;
  if (!selectors.length || !target.length) return undefined;
  for (const s of selectors) {
    for (const t of target) {
      if (captures(s, t)) return s;
    }
  }
  return undefined;
}

export function addHierarchicalTags(tag?: string): string[]  {
  if (!tag) return [];
  const result = [tag];
  while (tag.includes('/')) {
    result.push(tag = tag.substring(0, tag.lastIndexOf('/')));
  }
  return result;
}

export function addAllHierarchicalTags(tags?: string[]): string[]   {
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

export function hasTag(tag?: string, ref?: Ref) {
  if (!tag) return false;
  if (!ref?.tags) return false;
  const not = tag.startsWith('!');
  if (not) tag = tag.substring(1);
  return !!find(ref.tags, t => expandedTagsInclude(t, tag)) !== not;
}

export function hasMedia(ref?: Ref)  {
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

export function tagIntersection(expand: string[], targets: string[]) {
  if (!expand) return [];
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

export function isOwnerTag(tag: string, ref: Ref) {
  if (ref.origin !== tagOrigin(tag)) return false;
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
  if (!origin.startsWith("@")) origin = origin.substring(1);
  return local + '.' + origin;
}

export function implicitLocal(tag: string, local: string) {
  if (!tag) return tag;
  if (!tag.includes('@')) return tag;
  if (tagOrigin(tag) !== local) return tag;
  return localTag(tag);
}

/**
 * Join multiple tags together, ignoring visibility modifiers '+' and '_' and
 * origin markers '@' for all but the first tag.
 */
export function prefix(prefix: string, ...rest: string[]) {
  if (access(prefix) && access(rest[0])) {
    prefix = access(rest[0]) + prefix.substring(1);
  } else if (access(rest[0])) {
    prefix = access(rest[0]) + prefix;
  }
  return prefix + ('/' + rest.join('/'))
    .replace(/[+_@]/g, '')
    .replace(/\/\//g, '/')
    .replace(/\/$/, '');
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
  const as = query.split(':');
  const result = [];
  let brackets = 0;
  for (const a of as) {
    const count = (a.match(/\(/g)?.length || 0) - (a.match(/\)/g)?.length || 0);
    if (!brackets) {
      result.push(a);
    } else {
      result[result.length - 1] += a;
    }
    brackets += count;
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
