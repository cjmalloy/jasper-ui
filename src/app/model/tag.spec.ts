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
});
