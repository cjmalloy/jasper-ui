/// <reference types="vitest/globals" />
import { Plugin } from '../model/plugin';
import { getAddTags } from './add-tags';

describe('getAddTags', () => {
  it('adds public by default', () => {
    const plugin: Plugin = { tag: 'plugin/test', config: { submit: 'test' } };
    expect(getAddTags('plugin/test', plugin, undefined)).toEqual(['public', 'plugin/test']);
  });

  it('lets the plugin override the default tags', () => {
    const plugin: Plugin = { tag: '+plugin/secret', config: { submit: 'secret', internal: true, addTags: [] } };
    expect(getAddTags('+plugin/secret', plugin, { addTags: ['public'] } as any)).toEqual(['+plugin/secret', 'internal']);
  });
});
