import * as he from 'he';
import { difference, uniq } from 'lodash-es';
import { marked } from 'marked';
import { getMailbox } from '../mods/mailbox';
import { wikiUriFormat } from '../mods/org/wiki';
import { QUALIFIED_USER_REGEX, TAG_REGEX } from './format';

export function getMailboxes(markdown: string, origin = '') {
  return extractPattern(markdown, /[_+]user\/[a-z0-9]+([./][a-z0-9]+)*(@[a-z0-9]+(\.[a-z0-9]+)*)?/g, undefined, QUALIFIED_USER_REGEX)
    .map(u => getMailbox(u, origin));
}

export function getTags(markdown: string) {
  return extractPattern(markdown, /#[_+]?[a-z0-9]+([./][a-z0-9]+)*/g, /#([a-z0-9]+([./][a-z0-9]+)*)/, TAG_REGEX);
}

export function extractPattern(markdown: string, pattern: RegExp, extractor?: RegExp, validator?: RegExp) {
  const result: string[] = [];
  if (!markdown) return result;
  const matches = markdown.match(pattern);
  for (const s of matches || []) {
    const url = (extractor ? s.match(extractor)?.[1] : s)?.trim();
    if (url && (!validator || validator.test(url))) {
      result.push(url);
    }
  }
  return result;
}

export function getIfNew<T>(list: T[], old?: T[]): T[] {
  old ??= [];
  const diff = difference(uniq(list), uniq(old));
  if (!diff.length) return [];
  return list;
}

export function getLinks(markdown: string, withText?: RegExp) {
  const result: string[] = [];
  marked.walkTokens(marked.lexer(markdown), t => {
    if (t.type === 'link') {
      if (!t.href) return;
      if (withText && !withText.test(t.text)) return;
      if (t.href.startsWith('mailto:')) t.href = he.decode(t.href);
      result.push(t.href);
      // @ts-ignore
    }
    if (withText) return;
    const customType = t as any;
    if (customType.text) {
      if (customType.type === 'wiki' || customType.type === 'wiki-embed') {
        result.push(wikiUriFormat(customType.text));
      } else if (customType.type === 'embed') {
        result.push(customType.text);
      }
    }
  });
  return result;
}
