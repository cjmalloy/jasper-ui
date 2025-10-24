import * as he from 'he';
import { filter, sortBy, uniq } from 'lodash-es';
import { Ref } from '../model/ref';
import { Config, ModType } from '../model/tag';
import { reverseOrigin } from '../mods/mailbox';
import { config } from '../service/config.service';
import { hasPrefix, hasTag } from './tag';

export const URI_REGEX = /^[^\s:\/?#]+:(\/\/([^\/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?$/;
export const TAG_REGEX = /^[_+]?[a-z0-9]+([./][a-z0-9]+)*$/;
export const TAG_SUFFIX_REGEX = /^[+_]|([_+]?[a-z0-9]+([./][a-z0-9]+)*)?$/;
export const TAGS_REGEX = /^[,\s]*-?[_+]?[a-z0-9]+([.\/][a-z0-9]+)*([,\s]+-?[_+]?[a-z0-9]+([.\/][a-z0-9]+)*)*[,\s]*$/;
export const USER_REGEX = /^[_+]user(\/[a-z0-9]+([./][a-z0-9]+)*)?$/;
export const QUALIFIED_USER_REGEX = /^[_+]user(\/[a-z0-9]+([./][a-z0-9]+)*)?(@[a-z0-9]+(\.[a-z0-9]+)*)?$/;
export const PLUGIN_REGEX = /^[_+]?plugin\/[a-z0-9]+([./][a-z0-9]+)*$/;
export const ORIGIN_NOT_BLANK_REGEX = /^@[a-z0-9]+(\.[a-z0-9]+)*$/;
export const ORIGIN_REGEX = /^(@[a-z0-9]+(\.[a-z0-9]+)*)?$/;
export const QUALIFIED_TAG_REGEX = /^[_+]?[a-z0-9]+([./][a-z0-9]+)*(@[a-z0-9]+(\.[a-z0-9]+)*)?$/;
export const QUALIFIED_TAGS_REGEX = /^[,\s]*[_+]?[a-z0-9]+([./][a-z0-9]+)*(@[a-z0-9]+(\.[a-z0-9]+)*)?([,\s]+[_+]?[a-z0-9]+([./][a-z0-9]+)*(@[a-z0-9]+(\.[a-z0-9]+)*)?)*[,\s]*$/;
export const SELECTOR_REGEX = /^!?([_+]?[a-z0-9]+([./][a-z0-9]+)*|([_+]?[a-z0-9]+([./][a-z0-9]+)*)?(@[a-z0-9]+(\.[a-z0-9]+)*|@\*|@|\*))$/;
export const QUERY_REGEX = /^(!?([_+]?[a-z0-9]+([./][a-z0-9]+)*|([_+]?[a-z0-9]+([./][a-z0-9]+)*)?(@[a-z0-9]+(\.[a-z0-9]+)*|@\*|@|\*))|\(!?([_+]?[a-z0-9]+([./][a-z0-9]+)*|([_+]?[a-z0-9]+([./][a-z0-9]+)*)?(@[a-z0-9]+(\.[a-z0-9])*|@\*|@|\*))([ |]!?([_+]?[a-z0-9]+([./][a-z0-9]+)*|([_+]?[a-z0-9]+([./][a-z0-9]+)*)?(@[a-z0-9]+(\.[a-z0-9])*|@\*|@|\*)))*\))([ |:&](!?([_+]?[a-z0-9]+([./][a-z0-9]+)*|([_+]?[a-z0-9]+([./][a-z0-9]+)*)?(@[a-z0-9]+(\.[a-z0-9])*|@\*|@|\*))|\(!?([_+]?[a-z0-9]+([./][a-z0-9]+)*|([_+]?[a-z0-9]+([./][a-z0-9]+)*)?(@[a-z0-9]+(\.[a-z0-9])*|@\*|@|\*))([ |]!?([_+]?[a-z0-9]+([./][a-z0-9]+)*|([_+]?[a-z0-9]+([./][a-z0-9]+)*)?(@[a-z0-9]+(\.[a-z0-9])*|@\*|@|\*)))*\)))*$/;

export function templates(tags?: string[], template?: string) {
  return filter(tags, t => hasPrefix(t, template));
}

export function authors(ref: Ref, prefixes = ['+user', '_user', 'plugin/from', 'plugin/alias']) {
  const authors = [];
  for (const p of prefixes) {
    if (p === '+user') {
      authors.push(...templates(ref.tags || [], '+user').map(t => t + (ref.origin || '')));
    } else if (p === '_user') {
      authors.push(...templates(ref.tags || [], '_user').map(t => t + (ref.origin || '')));
    } else if (p === '+plugin') {
      authors.push(...templates(ref.tags || [], '+plugin').map(t => t + (ref.origin || '')));
    } else if (p === 'plugin/from') {
      authors.push(...templates(ref.tags || [], 'plugin/from').map(t => reverseOrigin(t.substring('plugin/from/'.length), ref.origin || '')));
    } else if (p === 'plugin/alias') {
      authors.push(...templates(ref.tags || [], 'plugin/alias').map(t => t.substring('plugin/alias/'.length) + (ref.origin || '')));
    }
  }
  return uniq(authors);
}

export function userAuthors(ref: Ref) {
  return uniq(templates(ref.tags || [], 'user').map(t => t + (ref.origin || '')));
}

export function clickableLink(url: string) {
  for (const v of config().allowedSchemes) {
    if (url.startsWith(v)) return true;
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
  return filter(tags, interestingTag);
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

export const DEFAULT_TYPE = 'feature';
export function configGroups(def: Record<string, Config>): Record<ModType, [string, Config][]> {
  let result = Object.entries(def).reduce((result, item) => {
    const mod = modId(item[1]);
    const type: [string, Config][] = result[item[1].config?.type || DEFAULT_TYPE] ||= [];
    if (!type.find(i => mod === modId(i[1]))) {
      type.push([item[0].replace(/[.]/g, '-'), item[1]]);
    }
    return result;
  }, {} as Record<ModType, [string, Config][]>)
  for (const k of Object.keys(result) as ModType[]) {
    result[k] = sortBy(result[k], [e => e[1]!.tag.match(/^[+_]/) ? e[1]!.tag.substring(1) : e[1]!.tag]);
  }
  return result;
}

export function formSafeNames(map: any) {
  return Object.fromEntries(Object.entries(map).map(e => [e[0].replace(/[.]/g, '-'), e[1]]));
}

export function modId(c?: Config) {
  return c?.config?.mod || c?.name || c?.tag || '';
}

export function getTitle(ref: Ref | undefined): string {
  if (!ref) return '';
  const title = (ref.title || '').trim();
  const comment = (ref.comment || '').trim();
  if (title) return title;
  if (comment) return trimCommentForTitle(comment);
  if (ref.url?.startsWith('tag:/')) return '#' + ref.url.substring('tag:/'.length);
  return ref.url;
}

export function getNiceTitle(ref: Ref | undefined): string {
  if (!ref) return '';
  const title = (ref.title || '').trim();
  const comment = (ref.comment || '').trim();
  if (title) return title;
  if (comment) return trimCommentForTitle(comment);
  if (ref.url.startsWith('cache:')) return '';
  if (ref.url.startsWith('comment:')) return '';
  if (ref.url.startsWith('internal:')) return '';
  if (ref.url.startsWith('tag:/')) return '#' + ref.url.substring('tag:/'.length);
  return ref.url;
}

export function getPageTitle(ref: Ref | undefined, top?: Ref): string {
  if (!ref) return '';
  const title = (ref.title || '').trim();
  const comment = (ref.comment || '').trim();
  if (title) return title;
  if (top?.title) return $localize`Re: ` + getTitle(top);
  if (comment) return trimCommentForTitle(comment);
  if (top?.comment) return $localize`Re: ` + getTitle(top);
  if (ref.url.startsWith('tag:/')) return '#' + ref.url.substring('tag:/'.length);
  return ref.url;
}

function trimCommentForTitle(comment: string): string {
  if (!comment) return '';
  comment = he.decode(comment.replace( /<[^>]+>/g, ''));
  if (!comment.includes('\n')) return trimTextForTitle(comment)
  const lines = comment.split('\n').map(t => t.trim()).filter(t => t.length);
  const newText = lines.filter(l => !l.startsWith('>'));
  if (newText.length) return trimTextForTitle(newText[0]);
  return trimTextForTitle(lines[0]);
}

function trimTextForTitle(comment: string) {
  if (!comment) return '';
  comment = comment.replace(/!\[+?]\(([^)]|\\\))*\)/, $localize` Image `);
  comment = comment.replace(/\[([^\]]+)]\(([^)]|\\\))*\)/, ' $1 ');
  if (comment.length <= 140) return comment;
  return comment.substring(0, 140) + '...';
}

export function hasComment(comment?: string) {
  if (!comment) return false;
  comment = he.decode(comment.replace( /<[^>]+>/g, ''));
  return trimCommentForTitle(comment) !== comment;
}

export function getRe(title?: string) {
  if (!title) return '';
  if (title.startsWith($localize`Re: `)) return title;
  return $localize`Re: ` + title;
}

export function tagLink(tag: string, origin?: string, local?: string) {
  if (local === origin || !local && !origin) return tag;
  if (local && !origin) return tag + '@';
  return tag + (origin || '');
}

export function readableBytes(size: number): string  {
  const i = !size ? 0 : Math.floor(Math.log(size) / Math.log(1024));
  // @ts-ignore
  return (size / Math.pow(1024, i)).toFixed(2) * 1 + ' ' + ['B', 'kB', 'MB', 'GB', 'TB'][i];
}
