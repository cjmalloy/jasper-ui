import { clear } from './tag';

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
  });
});
