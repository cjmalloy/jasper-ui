import { PluginsPipe } from './plugins.pipe';

describe('PluginsPipe', () => {
  it('create an instance', () => {
    const pipe = new PluginsPipe({} as any);
    expect(pipe).toBeTruthy();
  });
});
