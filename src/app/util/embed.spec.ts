import { describe, expect, it } from 'vitest';
import { embedUrl } from './embed';

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
