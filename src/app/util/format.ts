import { filter, sortBy } from 'lodash-es';
import { Plugin, PluginType } from '../model/plugin';
import { Ref } from '../model/ref';
import { Template, TemplateType } from '../model/template';
import { config } from '../service/config.service';
import { hasPrefix, hasTag } from './tag';

export const URI_REGEX = /^([^:/?#]+):(\/\/([^\/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?$/;
export const TAG_REGEX = /^[_+]?[a-z0-9]+([./][a-z0-9]+)*$/;
export const TAGS_REGEX = /^-?[_+]?[a-z0-9]+([./][a-z0-9]+)*(\s+-?[_+]?[a-z0-9]+([./][a-z0-9]+)*)*$/;
export const USER_REGEX = /^[_+]user\/[a-z0-9]+([./][a-z0-9]+)*$/;
export const QUALIFIED_USER_REGEX = /^[_+]user\/[a-z0-9]+([./][a-z0-9]+)*(@[a-z0-9]+(\.[a-z0-9]+)*)?$/;
export const PLUGIN_REGEX = /^[_+]?plugin\/[a-z0-9]+([./][a-z0-9]+)*$/;
export const ORIGIN_NOT_BLANK_REGEX = /^@[a-z0-9]+(\.[a-z0-9]+)*$/;
export const ORIGIN_REGEX = /^(@[a-z0-9]+(\.[a-z0-9]+)*)?$/;
export const ORIGIN_WILDCARD_REGEX = /^(@[a-z0-9]+(\.[a-z0-9]+)*|@\*)?$/;
export const QUALIFIED_TAG_REGEX = /^[_+]?[a-z0-9]+([./][a-z0-9]+)*(@[a-z0-9]+(\.[a-z0-9]+)*)?$/;
export const SELECTOR_REGEX = /^!?([_+]?[a-z0-9]+([./][a-z0-9]+)*|([_+]?[a-z0-9]+([./][a-z0-9]+)*)?(@[a-z0-9]+(\.[a-z0-9]+)*|@\*))$/;
export const QUERY_REGEX = /^(!?([_+]?[a-z0-9]+([./][a-z0-9]+)*|([_+]?[a-z0-9]+([./][a-z0-9]+)*)?(@[a-z0-9]+(\.[a-z0-9]+)*|@\*))|\(!?([_+]?[a-z0-9]+([./][a-z0-9]+)*|([_+]?[a-z0-9]+([./][a-z0-9]+)*)?(@[a-z0-9]+(\.[a-z0-9])*|@\*))([ |]!?([_+]?[a-z0-9]+([./][a-z0-9]+)*|([_+]?[a-z0-9]+([./][a-z0-9]+)*)?(@[a-z0-9]+(\.[a-z0-9])*|@\*)))*\))([ |:&](!?([_+]?[a-z0-9]+([./][a-z0-9]+)*|([_+]?[a-z0-9]+([./][a-z0-9]+)*)?(@[a-z0-9]+(\.[a-z0-9])*|@\*))|\(!?([_+]?[a-z0-9]+([./][a-z0-9]+)*|([_+]?[a-z0-9]+([./][a-z0-9]+)*)?(@[a-z0-9]+(\.[a-z0-9])*|@\*))([ |]!?([_+]?[a-z0-9]+([./][a-z0-9]+)*|([_+]?[a-z0-9]+([./][a-z0-9]+)*)?(@[a-z0-9]+(\.[a-z0-9])*|@\*)))*\)))*$/;

export function templates(tags?: string[], template?: string) {
  return filter(tags, t => hasPrefix(t, template));
}

export function authors(ref: Ref) {
  return templates(ref.tags || [], 'user').map(t => t + (ref.origin || ''));
}

export function clickableLink(ref: Ref) {
  for (const v of config().allowedSchemes) {
    if (ref.url.startsWith(v)) return true;
  }
  return false;
}

export function urlSummary(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.host;
    }
    return parsed.protocol.substring(0, parsed.protocol.length - 1);
  } catch (e) {}
  if (url.startsWith('lnbc')) return 'lightning';
  if (url.startsWith('bc1')) return 'bitcoin';
  if (url.startsWith('0x')) return 'ethereum';
  return 'unknown';
}

export function interestingTags(tags?: string[]): string[] {
  return filter(filter(tags, interestingTag), value => !prefixTag(value, tags!));
}

export function prefixTag(tag: string, tags: string[]) {
  if (tag.startsWith('_') || tag.startsWith('+')) return false;
  for (const t of tags) {
    if (t === tag) continue;
    if (t.startsWith(tag + '/')) return true;
  }
  return false;
}

export function interestingTag(tag: string) {
  if (tag === 'public') return false;
  if (tag === 'locked') return false;
  if (tag === 'internal') return false;
  if (tag === '_moderated') return false;
  if (hasPrefix(tag, 'plugin')) return false;
  if (hasPrefix(tag, 'user')) return false;
  if (tag === '+user') return false;
  if (tag === '_user') return false;
  return true;
}

export function formatAuthor(tag: string) {
  return tag
    .replace('+user@', '@')
    .replace('+', '')
    .replace('user/', '');
}

export function isTextPost(ref: Ref) {
  return ref.url.startsWith('comment:') && !hasTag('internal', ref);
}

export function configGroups(def: Record<PluginType|TemplateType, Plugin|Template>): Record<PluginType|TemplateType, [string, Plugin|Template][]> {
  let result = Object.entries(def).reduce((result, item) => {
    const type = result[item[1].config?.type || 'feature'] ||= [] as [string, Plugin|Template][];
    type.push(item);
    return result;
  }, {} as Record<PluginType|TemplateType, [string, Plugin|Template][]>)
  for (const k of Object.keys(result) as PluginType|TemplateType[]) {
    // @ts-ignore
    result[k] = sortBy(result[k], [e => e[1]!.tag.match(/^[+_]/) ? e[1]!.tag.substring(1) : e[1]!.tag]);
  }
  return result;
}
