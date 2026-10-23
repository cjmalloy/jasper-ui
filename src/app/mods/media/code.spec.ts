import { describe, expect, it } from 'vitest';
import { yamlCode } from './code';

describe('yamlCode', () => {
  it('should tag YAML files as plugin/code/yaml', () => {
    expect(yamlCode({ name: 'config.yaml', type: '' })).toEqual(['plugin/code/yaml']);
    expect(yamlCode({ name: 'docker-compose.YML', type: 'application/octet-stream' })).toEqual(['plugin/code/yaml']);
    expect(yamlCode({ name: 'a', type: 'application/yaml' })).toEqual(['plugin/code/yaml']);
    expect(yamlCode({ name: 'a', type: 'application/x-yaml' })).toEqual(['plugin/code/yaml']);
    expect(yamlCode({ name: 'a', type: 'text/yaml' })).toEqual(['plugin/code/yaml']);
    expect(yamlCode({ name: 'a', type: 'text/x-yaml' })).toEqual(['plugin/code/yaml']);
  });

  it('should not tag other files', () => {
    expect(yamlCode({ name: 'a.bin', type: '' })).toEqual([]);
    expect(yamlCode({ name: 'a.json', type: 'application/json' })).toEqual([]);
    expect(yamlCode({ name: 'yaml', type: 'application/octet-stream' })).toEqual([]);
  });
});
