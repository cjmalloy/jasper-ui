import { describe, expect, it } from 'vitest';
import { mimeToCode } from './code';

describe('mimeToCode', () => {
  it('should map YAML MIME types', () => {
    expect(mimeToCode('application/yaml')).toEqual(['plugin/code/yaml']);
    expect(mimeToCode('application/x-yaml')).toEqual(['plugin/code/yaml']);
  });

  it('should fall back to the file extension', () => {
    expect(mimeToCode('', 'a.yml')).toEqual(['plugin/code/yaml']);
    expect(mimeToCode('application/octet-stream', 'a.yaml')).toEqual(['plugin/code/yaml']);
  });

  it('should ignore unknown extensions', () => {
    expect(mimeToCode('application/octet-stream', 'a.__proto__')).toEqual([]);
    expect(mimeToCode('', 'a.unknown')).toEqual(['plugin/code']);
  });
});
