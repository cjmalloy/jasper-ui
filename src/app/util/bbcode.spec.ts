/// <reference types="vitest/globals" />
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ConfigService } from '../service/config.service';
import { bbcodeToHtml } from './bbcode';

describe('bbcodeToHtml', () => {
  let config: ConfigService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    config = TestBed.inject(ConfigService);
  });

  function render(text: string) {
    const element = document.createElement('div');
    element.innerHTML = bbcodeToHtml(text);
    return element;
  }

  it('renders nested, case-insensitive formatting and preserves line breaks', () => {
    const element = render('[B]bold [i]italic[/I] [b]nested[/b][/B]\n[u]underlined[/u]\r\n[s]removed[/s]');
    expect(element.querySelector('strong em')?.textContent).toBe('italic');
    expect(element.querySelector('strong strong')?.textContent).toBe('nested');
    expect(element.querySelector('u')?.textContent).toBe('underlined');
    expect(element.querySelector('s')?.textContent).toBe('removed');
    expect(element.querySelectorAll('br')).toHaveLength(2);
  });

  it('renders quotes and nested ordered and unordered lists', () => {
    const element = render('[quote="Alice"][list=1][*]first[*][list][*]nested[/list][/list][/quote]');
    expect(element.querySelector('blockquote cite')?.textContent).toBe('Alice');
    expect(element.querySelectorAll('ol > li')).toHaveLength(2);
    expect(element.querySelector('ol > li > ul > li')?.textContent).toBe('nested');
  });

  it('keeps code literal and preserves whitespace', () => {
    const code = '[b]literal[/b]\n  <script>alert(1)</script>\n**markdown**';
    const element = render(`[code]${code}[/code]`);
    expect(element.querySelector('pre code')?.textContent).toBe(code);
    expect(element.querySelector('strong, script')).toBeNull();
  });

  it('does not interpret Markdown or raw HTML', () => {
    const text = '**not bold**\n# not a heading\n<script>alert(1)</script>';
    const element = render(text);
    expect(element.querySelector('strong, h1, script')).toBeNull();
    expect(element.textContent).toContain('<script>alert(1)</script>');
  });

  it('renders links, email addresses, and images', () => {
    const element = render('[url=https://example.com/?a=1&b=2][b]link[/b][/url]'
      + '[url]/ref/wiki:Test[/url][email]test@example.com[/email]'
      + '[email=test@example.com]Email[/email][img]cache:photo.png[/img]');
    expect(element.querySelector('a')?.getAttribute('href')).toBe('https://example.com/?a=1&b=2');
    expect(element.querySelector('a strong')?.textContent).toBe('link');
    expect(element.querySelectorAll('a')[1].getAttribute('href')).toBe('/ref/wiki:Test');
    expect(element.querySelectorAll('a')[2].getAttribute('href')).toBe('mailto:test@example.com');
    expect(element.querySelectorAll('a')[3].getAttribute('href')).toBe('mailto:test@example.com');
    expect(element.querySelector('img')?.getAttribute('src')).toBe('unsafe:cache:photo.png');
  });

  it.each([
    'tag:/some-tag', 'cache:photo.png', 'ftp://example.com/file',
    'tel:+123456789', 'magnet:?xt=urn:btih:example', 'HTTPS://example.com/',
  ])('renders supported link URLs: %s', url => {
    const element = render(`[url]${url}[/url][url=${url}]link[/url]`);
    expect(Array.from(element.querySelectorAll('a'), link => link.getAttribute('href'))).toEqual([url, url]);
  });

  it('uses configured schemes rather than a fixed external link allowlist', () => {
    config.allowedSchemes = ['isbn:'];
    expect(render('[url]isbn:9781234567890[/url]').querySelector('a')?.getAttribute('href')).toBe('isbn:9781234567890');
    expect(render('[url]https://example.com/[/url][url]isbn-extra:test[/url]').querySelector('a')).toBeNull();
    expect(render('[img]isbn:9781234567890[/img]').querySelector('img')).toBeNull();
    expect(render('[url]tag:/some-tag[/url]').querySelector('a')?.getAttribute('href')).toBe('tag:/some-tag');
  });

  it.each(['javascript:', 'data:', 'vbscript:'])('rejects dangerous schemes even when configured: %s', scheme => {
    config.allowedSchemes = [scheme];
    expect(render(`[url]${scheme.toUpperCase()}test[/url]`).querySelector('a')).toBeNull();
  });

  it.each([
    'javascript:alert(1)', 'data:text/html,test', 'vbscript:alert(1)',
    'java\tscript:alert(1)', '&#106;avascript:alert(1)',
    'https://example.com/"onmouseover="alert(1)', '//example.com', '/\\example.com',
  ])('rejects unsafe URLs: %s', url => {
    const element = render(`[url=${url}]link[/url][img]${url}[/img]`);
    expect(element.querySelector('a, img, script')).toBeNull();
    expect(element.textContent).toContain('link');
  });

  it('escapes attributes and preserves unknown or unmatched tags', () => {
    const element = render('[quote="<img src=x onerror=alert(1)>"]text[/quote]'
      + '[unknown]x[/unknown][constructor]x[/constructor][b]unclosed[/i]');
    expect(element.querySelector('img')).toBeNull();
    expect(element.querySelector('cite')?.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(element.textContent).toContain('[unknown]x[/unknown][constructor]x[/constructor][b]unclosed[/i]');
  });

  it('handles empty and repeated unclosed literal tags', () => {
    expect(bbcodeToHtml('')).toBe('');
    const text = '[code][img][url]'.repeat(1000);
    expect(bbcodeToHtml(text)).toBe(text);
  });
});
