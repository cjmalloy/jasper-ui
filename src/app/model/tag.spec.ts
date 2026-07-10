import { clear, uniqueConfigs, Visibility } from './tag';

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

  describe('uniqueConfigs', () => {
    it('should ignore cached visibility state', () => {
      const configs: Visibility[] = [
        { if: 'tag', _on: true },
        { if: 'tag', _on: false },
      ];

      expect(uniqueConfigs(configs)).toHaveLength(1);
    });
  });
});
