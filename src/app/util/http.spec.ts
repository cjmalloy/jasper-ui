import { getTitleFromFilename } from './http';

describe('HTTP Utils', () => {
  describe('getTitleFromFilename', () => {
    it('should extract title from simple filename', () => {
      const title = getTitleFromFilename('https://example.com/document.pdf');
      expect(title).toBe('document');
    });

    it('should extract title from filename with hyphens', () => {
      const title = getTitleFromFilename('https://example.com/my-document-file.pdf');
      expect(title).toBe('my document file');
    });

    it('should extract title from filename with underscores', () => {
      const title = getTitleFromFilename('https://example.com/my_document_file.pdf');
      expect(title).toBe('my document file');
    });

    it('should extract title from filename with mixed separators', () => {
      const title = getTitleFromFilename('https://example.com/my-document_file+name.pdf');
      expect(title).toBe('my document file name');
    });

    it('should decode URL-encoded filename', () => {
      const title = getTitleFromFilename('https://example.com/my%20document.pdf');
      expect(title).toBe('my document');
    });

    it('should handle nested paths', () => {
      const title = getTitleFromFilename('https://example.com/path/to/document.pdf');
      expect(title).toBe('document');
    });

    it('should handle multiple dots in filename', () => {
      const title = getTitleFromFilename('https://example.com/my.document.file.pdf');
      expect(title).toBe('my.document.file');
    });

    it('should handle URL with query parameters', () => {
      const title = getTitleFromFilename('https://example.com/document.pdf?download=true');
      expect(title).toBe('document');
    });

    it('should handle URL with hash', () => {
      const title = getTitleFromFilename('https://example.com/document.pdf#section1');
      expect(title).toBe('document');
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

    it('should collapse multiple spaces', () => {
      const title = getTitleFromFilename('https://example.com/my---document___file.pdf');
      expect(title).toBe('my document file');
    });

    it('should handle complex URL-encoded characters', () => {
      const title = getTitleFromFilename('https://example.com/R%C3%A9sum%C3%A9.pdf');
      expect(title).toBe('Résumé');
    });
  });
});
