/// <reference types="vitest/globals" />
import { DateTime } from 'luxon';
import { Ref } from '../model/ref';
import { formatRefForDiff, merge3 } from './diff';

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

      const { mergedComment } = merge3(ours, base, theirs);
      expect(mergedComment).toBe('Their change');
    });

    it('should accept ours if theirs is unchanged', () => {
      const base = 'Original';
      const theirs = 'Original';
      const ours = 'Our change';

      const { mergedComment } = merge3(ours, base, theirs);
      expect(mergedComment).toBe('Our change');
    });

    it('should accept if both made the same change', () => {
      const base = 'Original';
      const theirs = 'Same change';
      const ours = 'Same change';

      const { mergedComment } = merge3(ours, base, theirs);
      expect(mergedComment).toBe('Same change');
    });

    it('should return undefined mergedComment on conflict', () => {
      const base = 'Original';
      const theirs = 'Their change';
      const ours = 'Our change';

      const { mergedComment, conflict } = merge3(ours, base, theirs);
      expect(mergedComment).toBeUndefined();
      expect(conflict).toBeTruthy();
      expect(conflict).toEqual(expect.any(Array));
    });

    it('should handle empty base', () => {
      const base = '';
      const theirs = 'Their change';
      const ours = 'Our change';

      const { mergedComment, conflict } = merge3(ours, base, theirs);
      expect(mergedComment).toBeUndefined();
      expect(conflict).toBeTruthy();
      expect(conflict).toEqual(expect.any(Array));
    });

    it('should handle empty comments', () => {
      const base = '';
      const theirs = '';
      const ours = 'New comment';

      const { mergedComment } = merge3(ours, base, theirs);
      expect(mergedComment).toBe('New comment');
    });

    it('should merge non-conflicting multi-line changes', () => {
      const base = 'Line 1\nLine 2\nLine 3';
      const theirs = 'Line 1 modified\nLine 2\nLine 3';
      const ours = 'Line 1\nLine 2\nLine 3 modified';

      const { mergedComment } = merge3(ours, base, theirs);
      expect(mergedComment).toBe('Line 1 modified\nLine 2\nLine 3 modified');
    });

    it('should detect conflicting multi-line changes', () => {
      const base = 'Line 1\nLine 2\nLine 3';
      const theirs = 'Line 1 their change\nLine 2\nLine 3';
      const ours = 'Line 1 our change\nLine 2\nLine 3';

      const { mergedComment, conflict } = merge3(ours, base, theirs);
      expect(mergedComment).toBeUndefined();
      expect(conflict).toBeTruthy();
      expect(conflict).toEqual(expect.any(Array));
    });

    it('should merge additions at different positions', () => {
      const base = 'Line 1\nLine 2';
      const theirs = 'Line 0\nLine 1\nLine 2';
      const ours = 'Line 1\nLine 2\nLine 3';

      const { mergedComment } = merge3(ours, base, theirs);
      expect(mergedComment).toBe('Line 0\nLine 1\nLine 2\nLine 3');
    });

    it('should merge with space delimiter', () => {
      const base = 'r o';
      const theirs = 'r r o';
      const ours = 'r o o';

      const { mergedComment } = merge3(ours, base, theirs, ' ');
      expect(mergedComment).toBe('r r o o');
    });

    it('should merge with space delimiter when changes at different positions', () => {
      const base = 'r o';
      const theirs = 'r r o';
      const ours = 'r o r';

      const { mergedComment, conflict } = merge3(ours, base, theirs, ' ');
      expect(mergedComment).toBe('r r o r');
      expect(conflict).toBeUndefined();
    });

    it('should handle ninja triangle merges with space delimiter for non-conflicting additions', () => {
      // Simulating a simplified ninja triangle row: r = red, o = empty
      // Both users add at different ends
      const base = 'r o';
      const theirs = 'r r o'; // User A adds at position 1
      const ours = 'r o o'; // User B adds at position 2

      const { mergedComment } = merge3(ours, base, theirs, ' ');
      expect(mergedComment).toBe('r r o o');
    });
  });
});
