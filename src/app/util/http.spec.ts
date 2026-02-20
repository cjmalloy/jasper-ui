import { encodeBookmarkParams, getTitleFromFilename, parseBookmarkParams } from './http';

describe('HTTP Utils', () => {
  describe('encodeBookmarkParams (string overload)', () => {
    it('should extract sort, filter, search from a full URL', () => {
      const qs = encodeBookmarkParams('/tag/science?sort=published,DESC&filter=+plugin/delete&pageSize=20');
      expect(qs).toBe('sort=published,DESC&filter=+plugin/delete');
    });

    it('should strip unknown params', () => {
      const qs = encodeBookmarkParams('?sort=created&pageNumber=2&search=hello&cols=3');
      expect(qs).toBe('sort=created&search=hello');
    });

    it('should handle multiple filter values', () => {
      const qs = encodeBookmarkParams('?filter=+plugin/delete&filter=obsolete');
      expect(qs).toBe('filter=+plugin/delete&filter=obsolete');
    });

    it('should preserve + in filter tags', () => {
      const qs = encodeBookmarkParams('?filter=+plugin/delete');
      expect(qs).toBe('filter=+plugin/delete');
    });

    it('should return empty string when no relevant params', () => {
      expect(encodeBookmarkParams('/tag/science?pageSize=20&cols=3')).toBe('');
    });

    it('should preserve view param', () => {
      const qs = encodeBookmarkParams('/tag/science?sort=published,DESC&view=kanban&pageSize=20');
      expect(qs).toBe('sort=published,DESC&view=kanban');
    });

    it('should re-encode & in URL-valued filters', () => {
      const qs = encodeBookmarkParams('?filter=sources/https://example.com?a=1%26b=2');
      expect(qs).toBe('filter=sources/https://example.com?a=1%26b=2');
    });
  });

  describe('encodeBookmarkParams (record overload)', () => {
    it('should encode sort with readable characters', () => {
      expect(encodeBookmarkParams({ sort: 'published,DESC' })).toBe('sort=published,DESC');
    });

    it('should encode metadata-> sort correctly', () => {
      expect(encodeBookmarkParams({ sort: 'metadata->field,DESC' })).toBe('sort=metadata->field,DESC');
    });

    it('should encode + filter correctly', () => {
      expect(encodeBookmarkParams({ filter: '+plugin/delete' })).toBe('filter=+plugin/delete');
    });

    it('should encode multiple filter values', () => {
      expect(encodeBookmarkParams({ filter: ['+plugin/delete', 'obsolete'] }))
        .toBe('filter=+plugin/delete&filter=obsolete');
    });

    it('should encode URL in sources filter (only & and #)', () => {
      expect(encodeBookmarkParams({ filter: 'sources/https://example.com?a=1&b=2' }))
        .toBe('filter=sources/https://example.com?a=1%26b=2');
    });

    it('should leave search text readable', () => {
      expect(encodeBookmarkParams({ search: 'hello world' })).toBe('search=hello world');
    });

    it('should skip empty values', () => {
      expect(encodeBookmarkParams({ sort: '', filter: 'obsolete' })).toBe('filter=obsolete');
    });

    it('round-trips with parseBookmarkParams', () => {
      const original = { sort: ['metadata->field,DESC'], filter: ['+plugin/delete', 'obsolete'], search: 'hello world' };
      const encoded = encodeBookmarkParams(original);
      const decoded = parseBookmarkParams(encoded);
      expect(decoded.sort).toBe(original.sort[0]);
      expect(decoded.filter).toEqual(original.filter);
      expect(decoded.search).toBe(original.search);
    });
  });

  describe('parseBookmarkParams', () => {
    it('should not decode literal + as space', () => {
      const params = parseBookmarkParams('filter=+plugin%2Fdelete');
      expect(params.filter).toBe('+plugin/delete');
    });

    it('should decode %2B as + (not space)', () => {
      const params = parseBookmarkParams('filter=%2Bplugin%2Fdelete');
      expect(params.filter).toBe('+plugin/delete');
    });

    it('should parse -> in sort values correctly', () => {
      const params = parseBookmarkParams('sort=metadata->field,DESC');
      expect(params.sort).toBe('metadata->field,DESC');
    });

    it('should return multiple values as array', () => {
      const params = parseBookmarkParams('filter=+plugin%2Fdelete&filter=obsolete');
      expect(params.filter).toEqual(['+plugin/delete', 'obsolete']);
    });

    it('should decode percent-encoded search text', () => {
      const params = parseBookmarkParams('search=hello%20world');
      expect(params.search).toBe('hello world');
    });

    it('should handle leading ? in query string', () => {
      const params = parseBookmarkParams('?filter=obsolete&sort=created');
      expect(params.filter).toBe('obsolete');
      expect(params.sort).toBe('created');
    });

    it('should return empty object for empty string', () => {
      expect(parseBookmarkParams('')).toEqual({});
    });
  });

  describe('getTitleFromFilename', () => {
    it('should extract filename from URL', () => {
      const title = getTitleFromFilename('https://example.com/document.pdf');
      expect(title).toBe('document.pdf');
    });

    it('should keep hyphens in filename', () => {
      const title = getTitleFromFilename('https://example.com/my-document-file.pdf');
      expect(title).toBe('my-document-file.pdf');
    });

    it('should keep underscores in filename', () => {
      const title = getTitleFromFilename('https://example.com/my_document_file.pdf');
      expect(title).toBe('my_document_file.pdf');
    });

    it('should keep all separators in filename', () => {
      const title = getTitleFromFilename('https://example.com/my-document_file+name.pdf');
      expect(title).toBe('my-document_file+name.pdf');
    });

    it('should decode URL-encoded filename', () => {
      const title = getTitleFromFilename('https://example.com/my%20document.pdf');
      expect(title).toBe('my document.pdf');
    });

    it('should handle nested paths', () => {
      const title = getTitleFromFilename('https://example.com/path/to/document.pdf');
      expect(title).toBe('document.pdf');
    });

    it('should keep multiple dots in filename', () => {
      const title = getTitleFromFilename('https://example.com/my.document.file.pdf');
      expect(title).toBe('my.document.file.pdf');
    });

    it('should handle URL with query parameters', () => {
      const title = getTitleFromFilename('https://example.com/document.pdf?download=true');
      expect(title).toBe('document.pdf');
    });

    it('should handle URL with hash', () => {
      const title = getTitleFromFilename('https://example.com/document.pdf#section1');
      expect(title).toBe('document.pdf');
    });

    it('should return null for URL without path', () => {
      const title = getTitleFromFilename('https://example.com/');
      expect(title).toBeNull();
    });

    it('should return null for invalid URL', () => {
      const title = getTitleFromFilename('not a url');
      expect(title).toBeNull();
    });

    it('should handle filename without extension', () => {
      const title = getTitleFromFilename('https://example.com/document');
      expect(title).toBe('document');
    });

    it('should trim whitespace from filename', () => {
      const title = getTitleFromFilename('https://example.com/my%20%20document.pdf');
      expect(title).toBe('my  document.pdf');
    });

    it('should handle complex URL-encoded characters', () => {
      const title = getTitleFromFilename('https://example.com/R%C3%A9sum%C3%A9.pdf');
      expect(title).toBe('Résumé.pdf');
    });

    // Tests for special URL schemes that should return null
    it('should return null for comment: scheme', () => {
      const title = getTitleFromFilename('comment:12345-abcd-6789');
      expect(title).toBeNull();
    });

    it('should return null for internal: scheme', () => {
      const title = getTitleFromFilename('internal:67890-xyz');
      expect(title).toBeNull();
    });

    it('should return null for cache: scheme', () => {
      const title = getTitleFromFilename('cache:cached-content-id');
      expect(title).toBeNull();
    });

    // Tests for path-like URL schemes
    it('should handle ftp: scheme', () => {
      const title = getTitleFromFilename('ftp://example.com/document.pdf');
      expect(title).toBe('document.pdf');
    });

    it('should handle file: scheme', () => {
      const title = getTitleFromFilename('file:///path/to/document.pdf');
      expect(title).toBe('document.pdf');
    });

    it('should handle tag: scheme with path', () => {
      const title = getTitleFromFilename('tag:/some/tag');
      expect(title).toBe('tag');
    });

    it('should handle tag: scheme with single segment', () => {
      const title = getTitleFromFilename('tag:mytag');
      expect(title).toBeNull();
    });
  });
});
