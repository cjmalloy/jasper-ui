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
      const base = 'Original';
      const theirs = 'Their change';
      const ours = 'Original';

      const { mergedComment } = tryMergeRefComment(base, theirs, ours);
      expect(mergedComment).toBe('Their change');
    });

    it('should accept ours if theirs is unchanged', () => {
      const base = 'Original';
      const theirs = 'Original';
      const ours = 'Our change';

      const { mergedComment } = tryMergeRefComment(base, theirs, ours);
      expect(mergedComment).toBe('Our change');
    });

    it('should accept if both made the same change', () => {
      const base = 'Original';
      const theirs = 'Same change';
      const ours = 'Same change';

      const { mergedComment } = tryMergeRefComment(base, theirs, ours);
      expect(mergedComment).toBe('Same change');
    });

    it('should return null on conflict', () => {
      const base = 'Original';
      const theirs = 'Their change';
      const ours = 'Our change';

      const { mergedComment, conflict } = tryMergeRefComment(base, theirs, ours);
      expect(mergedComment).toBeNull();
      expect(conflict).toBeTruthy();
      expect(conflict).toContain('Merge conflict');
    });

    it('should handle empty base', () => {
      const base = '';
      const theirs = 'Their change';
      const ours = 'Our change';

      const { mergedComment, conflict } = tryMergeRefComment(base, theirs, ours);
      expect(mergedComment).toBeNull();
      expect(conflict).toBeTruthy();
      expect(conflict).toContain('Merge conflict');
    });

    it('should handle empty comments', () => {
      const base = '';
      const theirs = '';
      const ours = 'New comment';

      const { mergedComment } = tryMergeRefComment(base, theirs, ours);
      expect(mergedComment).toBe('New comment');
    });

    it('should merge non-conflicting multi-line changes', () => {
      const base = 'Line 1\nLine 2\nLine 3';
      const theirs = 'Line 1 modified\nLine 2\nLine 3';
      const ours = 'Line 1\nLine 2\nLine 3 modified';

      const { mergedComment } = tryMergeRefComment(base, theirs, ours);
      expect(mergedComment).toBe('Line 1 modified\nLine 2\nLine 3 modified');
    });

    it('should detect conflicting multi-line changes', () => {
      const base = 'Line 1\nLine 2\nLine 3';
      const theirs = 'Line 1 their change\nLine 2\nLine 3';
      const ours = 'Line 1 our change\nLine 2\nLine 3';

      const { mergedComment, conflict } = tryMergeRefComment(base, theirs, ours);
      expect(mergedComment).toBeNull();
      expect(conflict).toBeTruthy();
      expect(conflict).toContain('Merge conflict');
    });

    it('should merge additions at different positions', () => {
      const base = 'Line 1\nLine 2';
      const theirs = 'Line 0\nLine 1\nLine 2';
      const ours = 'Line 1\nLine 2\nLine 3';

      const { mergedComment } = tryMergeRefComment(base, theirs, ours);
      expect(mergedComment).toBe('Line 0\nLine 1\nLine 2\nLine 3');
    });
  });

  describe('formatMergeConflict', () => {
    it('should format a merge conflict message', () => {
      const base = 'Original';
      const theirs = 'Their change';
      const ours = 'Our change';

      const { conflict } = tryMergeRefComment(base, theirs, ours);
      
      expect(conflict).toContain('Merge conflict:');
      expect(conflict).toContain('<<<<<<< OURS (local)');
      expect(conflict).toContain('Our change');
      expect(conflict).toContain('||||||| BASE');
      expect(conflict).toContain('Original');
      expect(conflict).toContain('======= THEIRS (remote)');
      expect(conflict).toContain('Their change');
      expect(conflict).toContain('>>>>>>>');
    });

    it('should handle empty base', () => {
      const base = '';
      const theirs = 'Their change';
      const ours = 'Our change';

      const { conflict } = tryMergeRefComment(base, theirs, ours);
      
      expect(conflict).toContain('Merge conflict:');
      expect(conflict).toContain('<<<<<<< OURS (local)');
      expect(conflict).toContain('||||||| BASE');
      expect(conflict).toContain('======= THEIRS (remote)');
      expect(conflict).toContain('Their change');
      expect(conflict).toContain('Our change');
    });
  });
});
