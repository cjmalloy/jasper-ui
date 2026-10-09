import { describe, expect, it } from 'vitest';
import { getPluginScope } from '../model/plugin';
import { hydrate } from '../model/tag';
import { progressPlugin } from './progress';

describe('progressPlugin', () => {
  const render = (tags: string[]) => hydrate(progressPlugin.config, 'infoUi', getPluginScope(progressPlugin, { url: '', tags }));

  it('draws a progress bar from the tag', () => {
    const html = render(['public', 'plugin/progress/3/12']);
    expect(html).toContain('<progress max="12" value="3"></progress> 25%');
    expect(html).toContain('title="3 / 12"');
  });

  it('draws nothing without a valid progress tag', () => {
    expect(render(['public']).trim()).toBe('');
    expect(render(['plugin/progress']).trim()).toBe('');
  });
});
