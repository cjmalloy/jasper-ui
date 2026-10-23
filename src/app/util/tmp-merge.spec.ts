/// <reference types="vitest/globals" />
import { mergeBundle } from './diff';

describe('tmp merge', () => {
  it('scenarios', () => {
    const b = (config: any) => ({ plugin: [{ tag: 'plugin/test', config: { mod: 'Test', ...config } }] } as any);
    const log: string[] = [];
    log.push('adjacent ' + !!mergeBundle(b({ a: 'X', b: 'b', c: 'c' }), b({ a: 'a', b: 'b', c: 'c' }), b({ a: 'a', b: 'Y', c: 'c' })).conflict);
    log.push('comma ' + !!mergeBundle(b({ a: 'a', b: 'X' }), b({ a: 'a', b: 'b' }), b({ a: 'a', b: 'b', c: 'new' })).conflict);
    log.push('version+desc ' + !!mergeBundle(b({ version: 1, description: 'mine' }), b({ version: 1, description: 'd' }), b({ version: 2, description: 'd' })).conflict);
    expect(log).toEqual([]);
  });
});
