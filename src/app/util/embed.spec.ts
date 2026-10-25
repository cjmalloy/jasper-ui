import { describe, expect, it } from 'vitest';
import { dataUrl, embedUrl, iframeUrl } from './embed';

describe('embedUrl', () => {
  const embed = 'https://www.youtube-nocookie.com/embed/abc123';

  it('should convert watch URLs', () => {
    expect(embedUrl('https://www.youtube.com/watch?v=abc123')).toBe(embed);
    expect(embedUrl('https://youtube.com/watch?v=abc123&si=xyz')).toBe(embed);
    expect(embedUrl('https://m.youtube.com/watch?v=abc123')).toBe(embed);
    expect(embedUrl('https://music.youtube.com/watch?v=abc123&si=xyz')).toBe(embed);
  });

  it('should convert short links and shorts', () => {
    expect(embedUrl('https://youtu.be/abc123?si=xyz')).toBe(embed);
    expect(embedUrl('https://www.youtube.com/shorts/abc123')).toBe(embed);
    expect(embedUrl('https://www.youtube.com/live/abc123')).toBe(embed);
  });

  it('should keep embed URLs', () => {
    expect(embedUrl('https://www.youtube.com/embed/abc123?feature=oembed')).toBe(embed);
    expect(embedUrl(embed)).toBe(embed);
  });

  it('should convert timestamps and playlists', () => {
    expect(embedUrl('https://www.youtube.com/watch?v=abc123&t=1m30s')).toBe(embed + '?start=90');
    expect(embedUrl('https://youtu.be/abc123?t=42')).toBe(embed + '?start=42');
    expect(embedUrl('https://www.youtube.com/watch?v=abc123&list=PL1')).toBe(embed + '?list=PL1');
    expect(embedUrl('https://music.youtube.com/playlist?list=PL1')).toBe('https://www.youtube-nocookie.com/embed/videoseries?list=PL1');
  });

  it('should leave other URLs alone', () => {
    expect(embedUrl('https://example.com/watch?v=abc123')).toBe('https://example.com/watch?v=abc123');
    expect(embedUrl('blob:https://example.com/123')).toBe('blob:https://example.com/123');
    expect(embedUrl('')).toBe('');
  });
});

describe('iframeUrl', () => {
  it('should allow web pages and data: URLs', () => {
    expect(iframeUrl('https://example.com/page')).toBe('https://example.com/page');
    expect(iframeUrl('http://example.com/')).toBe('http://example.com/');
    expect(iframeUrl('data:text/html,hi')).toBe('data:text/html,hi');
  });

  it('should block URLs that run with the app origin', () => {
    expect(iframeUrl('javascript:alert(1)')).toBe('about:blank');
    expect(iframeUrl(' JavaScript:alert(1)')).toBe('about:blank');
    expect(iframeUrl('blob:https://example.com/123')).toBe('about:blank');
    expect(iframeUrl('about:srcdoc')).toBe('about:blank');
    expect(iframeUrl('cache:123')).toBe('about:blank');
  });

  it('should not resolve an empty URL to the app', () => {
    expect(iframeUrl('')).toBe('about:blank');
    expect(iframeUrl(' ')).toBe('about:blank');
  });
});

describe('dataUrl', () => {
  it('should encode HTML', () => {
    expect(dataUrl('<p>#1 & 100%</p>')).toBe('data:text/html;charset=utf-8,%3Cp%3E%231%20%26%20100%25%3C%2Fp%3E');
  });
});
