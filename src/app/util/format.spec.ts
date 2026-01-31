import {
  URI_REGEX,
  TAG_REGEX,
  ORIGIN_REGEX,
  ORIGIN_NOT_BLANK_REGEX,
  QUALIFIED_TAG_REGEX,
  PLUGIN_REGEX,
  USER_REGEX,
  urlSummary,
  interestingTag,
  interestingTags,
  formatAuthor,
  getTitle,
  getNiceTitle,
  getRe,
  readableBytes,
  hasComment,
  tagLink,
  isTextPost,
  templates,
  userAuthors,
  authors,
} from './format';
import { Ref } from '../model/ref';

describe('Format Utils', () => {
  describe('URI_REGEX', () => {
    it('should match valid URIs', () => {
      expect(URI_REGEX.test('http://example.com')).toBe(true);
      expect(URI_REGEX.test('https://example.com/path')).toBe(true);
      expect(URI_REGEX.test('comment:uuid')).toBe(true);
      expect(URI_REGEX.test('tag:/science')).toBe(true);
      expect(URI_REGEX.test('cache:file.txt')).toBe(true);
    });

    it('should not match invalid URIs', () => {
      expect(URI_REGEX.test('not a uri')).toBe(false);
      expect(URI_REGEX.test('')).toBe(false);
    });
  });

  describe('TAG_REGEX', () => {
    it('should match valid tags', () => {
      expect(TAG_REGEX.test('science')).toBe(true);
      expect(TAG_REGEX.test('people/murray')).toBe(true);
      expect(TAG_REGEX.test('+protected')).toBe(true);
      expect(TAG_REGEX.test('_private')).toBe(true);
      expect(TAG_REGEX.test('plugin.test')).toBe(true);
    });

    it('should not match invalid tags', () => {
      expect(TAG_REGEX.test('UPPERCASE')).toBe(false);
      expect(TAG_REGEX.test('with space')).toBe(false);
      expect(TAG_REGEX.test('')).toBe(false);
      expect(TAG_REGEX.test('tag@origin')).toBe(false);
    });
  });

  describe('ORIGIN_REGEX', () => {
    it('should match valid origins', () => {
      expect(ORIGIN_REGEX.test('@origin')).toBe(true);
      expect(ORIGIN_REGEX.test('@origin.sub')).toBe(true);
      expect(ORIGIN_REGEX.test('')).toBe(true); // Empty is valid
    });

    it('should not match invalid origins', () => {
      expect(ORIGIN_REGEX.test('origin')).toBe(false); // Missing @
      expect(ORIGIN_REGEX.test('@')).toBe(false); // Just @ alone
    });
  });

  describe('ORIGIN_NOT_BLANK_REGEX', () => {
    it('should match non-blank origins', () => {
      expect(ORIGIN_NOT_BLANK_REGEX.test('@origin')).toBe(true);
      expect(ORIGIN_NOT_BLANK_REGEX.test('@origin.sub')).toBe(true);
    });

    it('should not match blank origin', () => {
      expect(ORIGIN_NOT_BLANK_REGEX.test('')).toBe(false);
      expect(ORIGIN_NOT_BLANK_REGEX.test('@')).toBe(false);
    });
  });

  describe('QUALIFIED_TAG_REGEX', () => {
    it('should match tags with origins', () => {
      expect(QUALIFIED_TAG_REGEX.test('science@origin')).toBe(true);
      expect(QUALIFIED_TAG_REGEX.test('+user@origin')).toBe(true);
      expect(QUALIFIED_TAG_REGEX.test('_private@origin.sub')).toBe(true);
    });

    it('should match tags without origins', () => {
      expect(QUALIFIED_TAG_REGEX.test('science')).toBe(true);
      expect(QUALIFIED_TAG_REGEX.test('+protected')).toBe(true);
    });
  });

  describe('PLUGIN_REGEX', () => {
    it('should match plugin tags', () => {
      expect(PLUGIN_REGEX.test('plugin/test')).toBe(true);
      expect(PLUGIN_REGEX.test('+plugin/test')).toBe(true);
      expect(PLUGIN_REGEX.test('_plugin/test')).toBe(true);
      expect(PLUGIN_REGEX.test('plugin/nested/tag')).toBe(true);
    });

    it('should not match non-plugin tags', () => {
      expect(PLUGIN_REGEX.test('science')).toBe(false);
      expect(PLUGIN_REGEX.test('plugin')).toBe(false); // Missing /tag part
    });
  });

  describe('USER_REGEX', () => {
    it('should match user tags', () => {
      expect(USER_REGEX.test('+user')).toBe(true);
      expect(USER_REGEX.test('_user')).toBe(true);
      expect(USER_REGEX.test('+user/name')).toBe(true);
      expect(USER_REGEX.test('_user/nested/name')).toBe(true);
    });

    it('should not match non-user tags', () => {
      expect(USER_REGEX.test('science')).toBe(false);
      expect(USER_REGEX.test('user')).toBe(false); // Missing prefix
    });
  });

  describe('urlSummary', () => {
    it('should return host for http URLs', () => {
      expect(urlSummary('http://example.com/path')).toBe('example.com');
      expect(urlSummary('https://www.test.org')).toBe('www.test.org');
    });

    it('should return protocol for other schemes', () => {
      expect(urlSummary('ftp://server/file')).toBe('ftp');
      expect(urlSummary('mailto:test@example.com')).toBe('mailto');
    });

    it('should return lightning for lnbc prefix', () => {
      expect(urlSummary('lnbc123')).toBe('lightning');
    });

    it('should return bitcoin for bc1 prefix', () => {
      expect(urlSummary('bc1qtest')).toBe('bitcoin');
    });

    it('should return ethereum for 0x prefix', () => {
      expect(urlSummary('0x123abc')).toBe('ethereum');
    });

    it('should return unknown for unrecognized URLs', () => {
      expect(urlSummary('random string')).toBe('unknown');
    });
  });

  describe('interestingTag', () => {
    it('should return false for public', () => {
      expect(interestingTag('public')).toBe(false);
    });

    it('should return false for locked', () => {
      expect(interestingTag('locked')).toBe(false);
    });

    it('should return false for internal', () => {
      expect(interestingTag('internal')).toBe(false);
    });

    it('should return false for _moderated', () => {
      expect(interestingTag('_moderated')).toBe(false);
    });

    it('should return false for plugin tags', () => {
      expect(interestingTag('plugin/test')).toBe(false);
    });

    it('should return false for user tags', () => {
      expect(interestingTag('user/name')).toBe(false);
      expect(interestingTag('+user')).toBe(false);
      expect(interestingTag('_user')).toBe(false);
    });

    it('should return true for interesting tags', () => {
      expect(interestingTag('science')).toBe(true);
      expect(interestingTag('funny')).toBe(true);
      expect(interestingTag('custom/tag')).toBe(true);
    });
  });

  describe('interestingTags', () => {
    it('should filter out uninteresting tags', () => {
      const tags = ['public', 'science', 'plugin/test', 'funny'];
      expect(interestingTags(tags)).toEqual(['science', 'funny']);
    });

    it('should handle undefined', () => {
      expect(interestingTags(undefined)).toEqual([]);
    });

    it('should return empty for all uninteresting tags', () => {
      const tags = ['public', 'locked', 'internal'];
      expect(interestingTags(tags)).toEqual([]);
    });
  });

  describe('formatAuthor', () => {
    it('should replace +user@ with @', () => {
      expect(formatAuthor('+user@origin')).toBe('@origin');
    });

    it('should remove + prefix', () => {
      expect(formatAuthor('+test')).toBe('test');
    });

    it('should remove user/ path', () => {
      expect(formatAuthor('user/name')).toBe('name');
    });

    it('should handle combined formats', () => {
      expect(formatAuthor('+user/name@origin')).toBe('name@origin');
    });
  });

  describe('getTitle', () => {
    it('should return title if present', () => {
      const ref: Ref = { url: 'http://test.com', title: 'Test Title', origin: '' };
      expect(getTitle(ref)).toBe('Test Title');
    });

    it('should return trimmed comment if no title', () => {
      const ref: Ref = { url: 'http://test.com', comment: 'Test comment', origin: '' };
      expect(getTitle(ref)).toBe('Test comment');
    });

    it('should return tag URL formatted', () => {
      const ref: Ref = { url: 'tag:/science', origin: '' };
      expect(getTitle(ref)).toBe('#science');
    });

    it('should return URL as fallback', () => {
      const ref: Ref = { url: 'http://example.com', origin: '' };
      expect(getTitle(ref)).toBe('http://example.com');
    });

    it('should return empty string for undefined', () => {
      expect(getTitle(undefined)).toBe('');
    });
  });

  describe('getNiceTitle', () => {
    it('should return empty for cache: URLs without title', () => {
      const ref: Ref = { url: 'cache:file.txt', origin: '' };
      expect(getNiceTitle(ref)).toBe('');
    });

    it('should return empty for comment: URLs without title', () => {
      const ref: Ref = { url: 'comment:uuid', origin: '' };
      expect(getNiceTitle(ref)).toBe('');
    });

    it('should return empty for internal: URLs without title', () => {
      const ref: Ref = { url: 'internal:test', origin: '' };
      expect(getNiceTitle(ref)).toBe('');
    });

    it('should return title if present', () => {
      const ref: Ref = { url: 'cache:file.txt', title: 'Title', origin: '' };
      expect(getNiceTitle(ref)).toBe('Title');
    });
  });

  describe('getRe', () => {
    it('should add Re: prefix', () => {
      expect(getRe('Original Title')).toMatch(/^Re: Original Title$/);
    });

    it('should not double prefix', () => {
      const reTitle = getRe('Test');
      expect(getRe(reTitle)).toBe(reTitle);
    });

    it('should handle empty string', () => {
      expect(getRe('')).toBe('');
    });

    it('should handle undefined', () => {
      expect(getRe(undefined)).toBe('');
    });
  });

  describe('readableBytes', () => {
    it('should format bytes', () => {
      expect(readableBytes(500)).toBe('500 B');
    });

    it('should format kilobytes', () => {
      expect(readableBytes(1024)).toBe('1 kB');
    });

    it('should format megabytes', () => {
      expect(readableBytes(1024 * 1024)).toBe('1 MB');
    });

    it('should format gigabytes', () => {
      expect(readableBytes(1024 * 1024 * 1024)).toBe('1 GB');
    });

    it('should handle zero', () => {
      expect(readableBytes(0)).toBe('0 B');
    });

    it('should show decimal places', () => {
      expect(readableBytes(1536)).toBe('1.5 kB');
    });
  });

  describe('hasComment', () => {
    it('should return false for undefined', () => {
      expect(hasComment(undefined)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(hasComment('')).toBe(false);
    });

    it('should return false for short comments', () => {
      expect(hasComment('Short')).toBe(false);
    });
  });

  describe('tagLink', () => {
    it('should return tag alone when no origin difference', () => {
      expect(tagLink('science', '', '')).toBe('science');
    });

    it('should append @ for local origin', () => {
      expect(tagLink('science', undefined, '@local')).toBe('science@');
    });

    it('should append origin when different', () => {
      expect(tagLink('science', '@remote', '@local')).toBe('science@remote');
    });

    it('should return just tag when origins match', () => {
      expect(tagLink('science', '@same', '@same')).toBe('science');
    });
  });

  describe('isTextPost', () => {
    it('should return true for comment: URL without internal tag', () => {
      const ref: Ref = { url: 'comment:uuid', origin: '', tags: [] };
      expect(isTextPost(ref)).toBe(true);
    });

    it('should return false for comment: URL with internal tag', () => {
      const ref: Ref = { url: 'comment:uuid', origin: '', tags: ['internal'] };
      expect(isTextPost(ref)).toBe(false);
    });

    it('should return false for non-comment URLs', () => {
      const ref: Ref = { url: 'http://example.com', origin: '', tags: [] };
      expect(isTextPost(ref)).toBe(false);
    });
  });

  describe('templates', () => {
    it('should filter tags by template prefix', () => {
      const tags = ['plugin/test', 'plugin/other', 'science'];
      expect(templates(tags, 'plugin')).toEqual(['plugin/test', 'plugin/other']);
    });

    it('should handle undefined tags', () => {
      expect(templates(undefined, 'plugin')).toEqual([]);
    });
  });

  describe('userAuthors', () => {
    it('should extract user tags with origin', () => {
      const ref: Ref = { url: 'test', origin: '@origin', tags: ['+user/name', '_user/other'] };
      expect(userAuthors(ref)).toEqual(['+user/name@origin', '_user/other@origin']);
    });

    it('should exclude public user tags', () => {
      const ref: Ref = { url: 'test', origin: '', tags: ['user/public', '+user/protected'] };
      expect(userAuthors(ref)).toEqual(['+user/protected']);
    });
  });

  describe('authors', () => {
    it('should extract +user authors', () => {
      const ref: Ref = { url: 'test', origin: '@origin', tags: ['+user/name'] };
      expect(authors(ref)).toContain('+user/name@origin');
    });

    it('should extract _user authors', () => {
      const ref: Ref = { url: 'test', origin: '@origin', tags: ['_user/name'] };
      expect(authors(ref)).toContain('_user/name@origin');
    });

    it('should return unique authors', () => {
      const ref: Ref = { url: 'test', origin: '@origin', tags: ['+user/name', '+user/name'] };
      const result = authors(ref);
      expect(result.filter(a => a === '+user/name@origin').length).toBe(1);
    });
  });
});
