import * as Handlebars from 'handlebars/dist/cjs/handlebars';
import { Ref } from './ref';
import { clear, hydrate } from './tag';

const progress = (ref?: Ref) => (Handlebars as any).helpers['progress'](ref, 'plugin/progress');

describe('Tag Model', () => {
  describe('clear', () => {
    it('should preserve an empty tag', () => {
      const cleared = clear({
        tag: '',
        config: {
          mod: '⚓️ Root',
        },
      } as any);

      expect(cleared.tag).toBe('');
    });

    it('should preserve config.mod', () => {
      const cleared = clear({
        tag: 'plugin/wiki',
        config: {
          mod: '📔️ Wiki',
          generated: 'generated',
        },
      } as any);

      expect(cleared.config?.mod).toBe('📔️ Wiki');
      expect(cleared.config?.generated).toBeUndefined();
    });
  });

  describe('progress', () => {
    it('should parse value and max from the tag', () => {
      expect(progress({ url: '', tags: ['public', 'plugin/progress/37/100'] })).toEqual({ value: 37, max: 100, percent: 37 });
      expect(progress({ url: '', tags: ['plugin/progress/3/12'] })).toEqual({ value: 3, max: 12, percent: 25 });
    });

    it('should default max to 100', () => {
      expect(progress({ url: '', tags: ['plugin/progress/42'] })).toEqual({ value: 42, max: 100, percent: 42 });
    });

    it('should clamp value to max', () => {
      expect(progress({ url: '', tags: ['plugin/progress/150/100'] })).toEqual({ value: 100, max: 100, percent: 100 });
    });

    it('should ignore missing or invalid progress tags', () => {
      expect(progress({ url: '', tags: ['public'] })).toBeUndefined();
      expect(progress({ url: '', tags: ['plugin/progress'] })).toBeUndefined();
      expect(progress({ url: '', tags: ['plugin/progress/abc/100'] })).toBeUndefined();
      expect(progress({ url: '', tags: ['plugin/progress/1/0'] })).toBeUndefined();
      expect(progress(undefined)).toBeUndefined();
    });
  });

  describe('hydrate', () => {
    it('should not render indented templates as markdown code blocks', () => {
      const config = {
        infoUi: `
          {{#if (interestingTags addTags)}} tagging refs {{/if}}
          {{#each (interestingTags addTags)}}
            #{{.}}
          {{/each}}`,
      };
      const result = hydrate(config, 'infoUi', { addTags: ['science', 'funny'] });
      for (const line of result.split('\n')) {
        expect(line).not.toMatch(/^ {4}/);
      }
      expect(result).toContain('tagging refs');
      expect(result).toContain('#science');
      expect(result).toContain('#funny');
    });
  });
});
