import { describe, expect, it } from 'vitest';
import { fileToCode, mimeToCode } from './code';

describe('mimeToCode', () => {
  it('should map YAML mime types to plugin/code/yaml', () => {
    expect(mimeToCode('application/yaml')).toEqual(['plugin/code/yaml']);
    expect(mimeToCode('application/x-yaml')).toEqual(['plugin/code/yaml']);
    expect(mimeToCode('text/yaml')).toEqual(['plugin/code/yaml']);
    expect(mimeToCode('text/x-yaml')).toEqual(['plugin/code/yaml']);
  });

  it('should map YAML file extensions to plugin/code/yaml', () => {
    expect(mimeToCode('', 'config.yaml')).toEqual(['plugin/code/yaml']);
    expect(mimeToCode('application/octet-stream', 'docker-compose.YML')).toEqual(['plugin/code/yaml']);
  });

  it('should keep existing behaviour', () => {
    expect(mimeToCode('')).toEqual(['plugin/code']);
    expect(mimeToCode('application/json', 'data.json')).toEqual(['plugin/code/json']);
    expect(mimeToCode('application/octet-stream')).toEqual([]);
  });
});

describe('fileToCode', () => {
  it('should tag cached YAML files as code', () => {
    expect(fileToCode({ name: 'a.yaml', type: '' })).toEqual(['plugin/code/yaml']);
    expect(fileToCode({ name: 'a', type: 'application/yaml' })).toEqual(['plugin/code/yaml']);
  });

  it('should not tag unknown or markdown files as code', () => {
    expect(fileToCode({ name: 'a.bin', type: '' })).toEqual([]);
    expect(fileToCode({ name: 'a.bin', type: 'application/octet-stream' })).toEqual([]);
    expect(fileToCode({ name: 'a.md', type: 'text/markdown' })).toEqual([]);
  });
});
