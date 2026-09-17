import { escape } from 'lodash-es';

interface Frame {
  tag: string;
  attribute?: string;
  opening: string;
  content: string;
  position: number;
}

const elements: Record<string, string> = {
  b: 'strong',
  i: 'em',
  u: 'u',
  s: 's',
  quote: 'blockquote',
};

function safeUrl(value: string, image = false) {
  const url = value.trim();
  if (/[\u0000-\u0020\u007f<>"\\]/.test(url)) return undefined;
  if (/^(https?:\/\/|cache:)/i.test(url) || (!image && /^(mailto:|\/(?!\/))/i.test(url))) return url;
  return undefined;
}

function link(url: string, content: string) {
  const safe = safeUrl(url);
  return safe ? `<a href="${escape(safe)}" rel="noopener noreferrer">${content}</a>` : content;
}

function render(frame: Frame) {
  const { tag, attribute, content, position } = frame;
  const source = ` aria-posinset="${position}"`;
  if (Object.hasOwn(elements, tag)) {
    const author = tag === 'quote' && attribute ? `<cite>${escape(attribute)}</cite>` : '';
    return `<${elements[tag]}${source}>${author}${content}</${elements[tag]}>`;
  }
  if (tag === 'url') return link(attribute || '', content);
  if (tag === 'email') return link('mailto:' + attribute, content);
  if (tag === '*') return `<li${source}>${content}</li>`;
  const ordered = attribute === '1' || attribute?.toLowerCase() === 'a';
  return ordered
    ? `<ol${source} type="${attribute}">${content}</ol>`
    : `<ul${source}>${content}</ul>`;
}

export function bbcodeToHtml(text: string): string {
  const stack: Frame[] = [{ tag: '', opening: '', content: '', position: 0 }];
  const tokens = /\[(\/?)([a-z]+|\*)(?:=([^\]\r\n]*))?]/gi;
  const closingCode = /\[\/code]/gi;
  const rawClosing = /\[\/(img|url|email)]/gi;
  const unclosed = new Set<string>();
  let offset = 0;
  const append = (value: string) => stack[stack.length - 1].content += value;
  const close = () => append(render(stack.pop()!));
  let match: RegExpExecArray | null;
  while ((match = tokens.exec(text))) {
    append(escape(text.slice(offset, match.index)).replace(/\r\n?|\n/g, '<br>'));
    offset = tokens.lastIndex;
    const [opening, slash, name, value] = match;
    const tag = name.toLowerCase();
    const attribute = value?.replace(/^(['"])(.*)\1$/, '$2');
    if (slash) {
      if (tag === 'list' && stack[stack.length - 1].tag === '*') close();
      if (stack.length > 1 && stack[stack.length - 1].tag === tag) close();
      else append(escape(opening));
    } else if (tag === 'code' || tag === 'img' || ((tag === 'url' || tag === 'email') && attribute === undefined)) {
      // Code and bare URLs are literal: never parse nested markup or HTML.
      if (unclosed.has(tag)) {
        append(escape(opening));
        continue;
      }
      const closing = tag === 'code' ? closingCode : rawClosing;
      closing.lastIndex = offset;
      let end: RegExpExecArray | null;
      do {
        end = closing.exec(text);
      } while (end && tag !== 'code' && end[1].toLowerCase() !== tag);
      if (!end) {
        unclosed.add(tag);
        append(escape(opening));
        continue;
      }
      const body = text.slice(offset, end.index);
      if (tag === 'code') {
        append(`<pre aria-posinset="${match.index}"><code>${escape(body)}</code></pre>`);
      } else if (tag === 'img') {
        const url = safeUrl(body, true);
        append(url ? `<img src="unsafe:${escape(url)}" alt="">` : escape(body));
      } else {
        append(link((tag === 'email' ? 'mailto:' : '') + body, escape(body)));
      }
      tokens.lastIndex = offset = closing.lastIndex;
    } else if (tag === '*') {
      if (stack[stack.length - 1].tag === '*') close();
      if (stack[stack.length - 1].tag === 'list') {
        stack.push({ tag, opening, content: '', position: match.index });
      } else append(escape(opening));
    } else if (Object.hasOwn(elements, tag) || ['url', 'email', 'list'].includes(tag)) {
      stack.push({ tag, attribute, opening, content: '', position: match.index });
    } else append(escape(opening));
  }
  append(escape(text.slice(offset)).replace(/\r\n?|\n/g, '<br>'));
  while (stack.length > 1) {
    const frame = stack.pop()!;
    append(escape(frame.opening) + frame.content);
  }
  return stack[0].content;
}
