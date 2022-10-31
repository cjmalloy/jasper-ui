import * as _ from 'lodash-es';
import { marked } from 'marked';
import { getMailbox } from '../plugin/mailbox';
import { QUALIFIED_USER_REGEX, TAG_REGEX } from './format';

export function getMailboxes(markdown: string) {
  return extractPattern(markdown, /[_+]user\/[a-z]+([./][a-z]+)*(@[a-z]+(\.[a-z]+)*)?/g, undefined, QUALIFIED_USER_REGEX)
    .map(u => getMailbox(u));
}

export function getTags(markdown: string) {
  return extractPattern(markdown, /#[a-z]+([./][a-z]+)*/g, /#([a-z]+([./][a-z]+)*)/, TAG_REGEX);
}

export function extractPattern(markdown: string, pattern: RegExp, extractor?: RegExp, validator?: RegExp) {
  const result: string[] = [];
  const matches = markdown.match(pattern);
  for (const s of matches || []) {
    const url = (extractor ? s.match(extractor)?.[1] : s)?.trim();
    if (url && (!validator || validator.test(url))) {
      result.push(url);
    }
  }
  return result;
}

export function getIfNew<T>(list: T[], old?: T[]): T[] | null {
  old ??= [];
  const diff = _.uniq(_.difference(list, old));
  if (!diff.length) return null;
  return [...old, ...diff];
}

export function getLinks(markdown: string, withText?: RegExp) {
  const result: string[] = [];
  marked.walkTokens(marked.lexer(markdown), t => {
    if (t.type !== 'link') return;
    if (!t.href) return;
    if (withText && !withText.test(t.text)) return;
    result.push(t.href);
  });
  return result;
}
