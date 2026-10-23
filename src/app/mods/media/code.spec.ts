import { describe, expect, it } from 'vitest';
import { cacheCode } from './code';

describe('cacheCode', () => {
  it('should tag YAML files as plugin/code/yaml', () => {
    expect(cacheCode({ name: 'config.yaml', type: '' })).toEqual(['plugin/code/yaml']);
    expect(cacheCode({ name: 'docker-compose.YML', type: 'application/octet-stream' })).toEqual(['plugin/code/yaml']);
    expect(cacheCode({ name: 'a', type: 'application/yaml' })).toEqual(['plugin/code/yaml']);
    expect(cacheCode({ name: 'a', type: 'application/x-yaml' })).toEqual(['plugin/code/yaml']);
    expect(cacheCode({ name: 'a', type: 'text/yaml' })).toEqual(['plugin/code/yaml']);
    expect(cacheCode({ name: 'a', type: 'text/x-yaml' })).toEqual(['plugin/code/yaml']);
  });

  it('should not tag other files', () => {
    expect(cacheCode({ name: 'a.bin', type: '' })).toEqual([]);
    expect(cacheCode({ name: 'a.json', type: 'application/json' })).toEqual([]);
    expect(cacheCode({ name: 'yaml', type: 'application/octet-stream' })).toEqual([]);
  });
});
