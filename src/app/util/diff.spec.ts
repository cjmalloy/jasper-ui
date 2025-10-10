import { DateTime } from 'luxon';
import { Ref } from '../model/ref';
import { formatMergeConflict, formatRefForDiff, tryMergeRefComment } from './diff';

describe('Diff Utils', () => {
  describe('formatRefForDiff', () => {
    it('should format a ref excluding modified and created fields', () => {
      const ref: Ref = {
        url: 'https://example.com',
        origin: '@local',
        title: 'Test',
        comment: 'Test comment',
        tags: ['test'],
        modifiedString: '2025-01-01T00:00:00Z',
        modified: DateTime.fromISO('2025-01-01T00:00:00Z'),
        created: DateTime.fromISO('2025-01-01T00:00:00Z'),
      };

      const formatted = formatRefForDiff(ref);
      const parsed = JSON.parse(formatted);

      expect(parsed.url).toBe('https://example.com');
      expect(parsed.title).toBe('Test');
      expect(parsed.comment).toBe('Test comment');
      expect(parsed.modified).toBeUndefined();
      expect(parsed.created).toBeUndefined();
    });

    it('should order fields consistently', () => {
      const ref: Ref = {
        url: 'https://example.com',
        origin: '@local',
        comment: 'Comment',
        title: 'Title',
        tags: ['b', 'a'],
        modifiedString: '2025-01-01T00:00:00Z',
      };

      const formatted = formatRefForDiff(ref);
      const keys = Object.keys(JSON.parse(formatted));

      expect(keys[0]).toBe('url');
      expect(keys[1]).toBe('origin');
      expect(keys[2]).toBe('title');
      expect(keys[3]).toBe('comment');
      expect(keys[4]).toBe('tags');
    });

    it('should sort plugin keys alphabetically', () => {
      const ref: Ref = {
        url: 'https://example.com',
        origin: '@local',
        modifiedString: '2025-01-01T00:00:00Z',
        plugins: {
          'zebra': { value: 1 },
          'alpha': { value: 2 },
          'beta': { value: 3 },
        },
      };

      const formatted = formatRefForDiff(ref);
      const parsed = JSON.parse(formatted);
      const pluginKeys = Object.keys(parsed.plugins);

      expect(pluginKeys).toEqual(['alpha', 'beta', 'zebra']);
    });
  });

  describe('tryMergeRefComment', () => {
    it('should accept theirs if ours is unchanged', () => {
      const base: Ref = {
        url: 'https://example.com',
        origin: '@local',
        comment: 'Original',
        modifiedString: '2025-01-01T00:00:00Z',
      };
      const theirs: Ref = {
        url: 'https://example.com',
        origin: '@local',
        comment: 'Their change',
        modifiedString: '2025-01-01T00:00:01Z',
      };
      const ours = { comment: 'Original' };

      const result = tryMergeRefComment(base, theirs, ours);
      expect(result).toBe('Their change');
    });

    it('should accept ours if theirs is unchanged', () => {
      const base: Ref = {
        url: 'https://example.com',
        origin: '@local',
        comment: 'Original',
        modifiedString: '2025-01-01T00:00:00Z',
      };
      const theirs: Ref = {
        url: 'https://example.com',
        origin: '@local',
        comment: 'Original',
        modifiedString: '2025-01-01T00:00:01Z',
      };
      const ours = { comment: 'Our change' };

      const result = tryMergeRefComment(base, theirs, ours);
      expect(result).toBe('Our change');
    });

    it('should accept if both made the same change', () => {
      const base: Ref = {
        url: 'https://example.com',
        origin: '@local',
        comment: 'Original',
        modifiedString: '2025-01-01T00:00:00Z',
      };
      const theirs: Ref = {
        url: 'https://example.com',
        origin: '@local',
        comment: 'Same change',
        modifiedString: '2025-01-01T00:00:01Z',
      };
      const ours = { comment: 'Same change' };

      const result = tryMergeRefComment(base, theirs, ours);
      expect(result).toBe('Same change');
    });

    it('should return null on conflict', () => {
      const base: Ref = {
        url: 'https://example.com',
        origin: '@local',
        comment: 'Original',
        modifiedString: '2025-01-01T00:00:00Z',
      };
      const theirs: Ref = {
        url: 'https://example.com',
        origin: '@local',
        comment: 'Their change',
        modifiedString: '2025-01-01T00:00:01Z',
      };
      const ours = { comment: 'Our change' };

      const result = tryMergeRefComment(base, theirs, ours);
      expect(result).toBeNull();
    });

    it('should handle null base ref', () => {
      const theirs: Ref = {
        url: 'https://example.com',
        origin: '@local',
        comment: 'Their change',
        modifiedString: '2025-01-01T00:00:01Z',
      };
      const ours = { comment: 'Our change' };

      const result = tryMergeRefComment(null, theirs, ours);
      expect(result).toBeNull();
    });

    it('should handle empty comments', () => {
      const base: Ref = {
        url: 'https://example.com',
        origin: '@local',
        modifiedString: '2025-01-01T00:00:00Z',
      };
      const theirs: Ref = {
        url: 'https://example.com',
        origin: '@local',
        modifiedString: '2025-01-01T00:00:01Z',
      };
      const ours = { comment: 'New comment' };

      const result = tryMergeRefComment(base, theirs, ours);
      expect(result).toBe('New comment');
    });
  });

  describe('formatMergeConflict', () => {
    it('should format a merge conflict message', () => {
      const base: Ref = {
        url: 'https://example.com',
        origin: '@local',
        comment: 'Original',
        modifiedString: '2025-01-01T00:00:00Z',
      };
      const theirs: Ref = {
        url: 'https://example.com',
        origin: '@local',
        comment: 'Their change',
        modifiedString: '2025-01-01T00:00:01Z',
      };
      const ours = { comment: 'Our change' };

      const result = formatMergeConflict(base, theirs, ours);
      
      expect(result).toContain('Merge conflict:');
      expect(result).toContain('<<<<<<< BASE');
      expect(result).toContain('Original');
      expect(result).toContain('||||||| THEIRS (server)');
      expect(result).toContain('Their change');
      expect(result).toContain('======= OURS (local)');
      expect(result).toContain('Our change');
      expect(result).toContain('>>>>>>>');
    });

    it('should handle null base', () => {
      const theirs: Ref = {
        url: 'https://example.com',
        origin: '@local',
        comment: 'Their change',
        modifiedString: '2025-01-01T00:00:01Z',
      };
      const ours = { comment: 'Our change' };

      const result = formatMergeConflict(null, theirs, ours);
      
      expect(result).toContain('Merge conflict:');
      expect(result).toContain('<<<<<<< BASE');
      expect(result).toContain('||||||| THEIRS (server)');
      expect(result).toContain('Their change');
      expect(result).toContain('======= OURS (local)');
      expect(result).toContain('Our change');
    });
  });
});
