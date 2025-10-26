import { getTitleFromFilename } from './http';

describe('HTTP Utils', () => {
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
