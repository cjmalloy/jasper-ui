import { escapePath } from './json-patch';

describe('JSON Patch Utils', () => {
  describe('escapePath', () => {
    it('should escape tilde characters', () => {
      expect(escapePath('path~with~tildes')).toBe('path~0with~0tildes');
    });

    it('should escape forward slashes', () => {
      expect(escapePath('path/with/slashes')).toBe('path~1with~1slashes');
    });

    it('should escape both tilde and forward slashes', () => {
      expect(escapePath('path~with/both~characters/')).toBe('path~0with~1both~0characters~1');
    });

    it('should handle empty string', () => {
      expect(escapePath('')).toBe('');
    });

    it('should not modify paths without special characters', () => {
      expect(escapePath('simple-path')).toBe('simple-path');
    });

    it('should handle path with only tilde', () => {
      expect(escapePath('~')).toBe('~0');
    });

    it('should handle path with only slash', () => {
      expect(escapePath('/')).toBe('~1');
    });

    it('should escape tildes before slashes (order matters)', () => {
      // First tildes are escaped to ~0, then slashes to ~1
      // So ~ becomes ~0, and / becomes ~1
      expect(escapePath('~/')).toBe('~0~1');
    });
  });
});
