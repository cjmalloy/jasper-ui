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
  if (sTag && sTag !== tTag) return false;
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

export function queries(query: string, target: string): boolean {
  // TODO: client side querying
  return captures(query, target);
}

export function queriesAny(queryList?: string[], target?: string[]): string | undefined {
  if (!queryList || !target) return undefined;
  if (!queryList.length || !target.length) return undefined;
  for (const s of queryList) {
    for (const t of target) {
      if (queries(s, t)) return s;
    }
  }
  return undefined;
}

export function addHierarchicalTags(tag?: string)  {
  if (!tag) return [];
  const result = [tag];
  while (tag.includes('/')) {
    result.push(tag = tag.substring(0, tag.lastIndexOf('/')));
  }
  return result;
}

export function addAllHierarchicalTags(tags?: string[])  {
  if (!tags || !tags.length) return [];
  return flatMap(tags, t => addHierarchicalTags(t))
}

export function hasTag(tag?: string, ref?: Ref)  {
  if (!tag) return false;
  if (!ref?.tags) return false;
  return !!find(ref.tags, t => expandedTagsInclude(t, tag));
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

export function includesTag(target: string, tags: string[])  {
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
  if (tag.includes('*')) return tag;
  if (tag.includes('@')) return tag;
  return localTag(tag) + origin;
}

/**
 * Join multiple tags together, ignoring visibility modifiers '+' and '_' and
 * origin markers '@' for all but the first tag.
 */
export function prefix(prefix: string, ...rest: string[]) {
  if (access(prefix) && access(rest[0])) {
    prefix = access(rest[0]) + prefix.substring(1);
  }
  return prefix + '/' + rest.join('/')
    .replace(/[+_@]/g, '')
    .replace(/\/\//g, '/');
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

export type Crumb = {text: string, tag?: string};
export function breadcrumbs(tag: string): Crumb[] {
  if (!tag) return [];
  return tag.split(/([:|()])/g).flatMap(t => {
    if (/[:|()]/.test(t)) return [{ text: t }];
    const crumbs: Crumb[] = localTag(t).split(/(\/)/g).map(t => ({ text: t }));
    for (let i = 0; i < crumbs.length; i++) {
      const previous = i > 1 ? crumbs[i-2].tag + '/' : '';
      if (crumbs[i].text !== '/') {
        crumbs[i].tag = previous + crumbs[i].text;
      }
    }
    const origin = tagOrigin(t);
    if (origin) {
      for (const t of crumbs) {
        if (t.tag) t.tag += origin;
      }
      crumbs.push({text: origin, tag: origin });
    }
    return crumbs;
  });
}

export function isQuery(query?: string) {
  if (!query) return false;
  if (query.startsWith('@')) return true;
  if (query === '*') return true;
  return /[:|!()]/g.test(query);
}

export function isPlugin(query?: string) {
  if (!query) return false;
  if (isQuery(query)) return false;
  return hasPrefix(query, 'plugin');
}

export function publicTag(tag: string) {
  return !tag.startsWith('_') && !tag.startsWith('+');
}

export function privateTag(tag: string) {
  return tag.startsWith('_');
}

export function protectedTag(tag: string) {
  return tag.startsWith('+');
}

export function access(tag: string) {
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
