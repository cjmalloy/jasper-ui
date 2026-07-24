/// <reference types="vitest/globals" />
import { Ext } from '../model/ext';
import { Ref } from '../model/ref';
import { getModels } from './zip';

describe('getModels', () => {
  it('generates a comment URL for a ref without a URL', () => {
    const [ref] = getModels<Ref>('{"comment":"Uploaded comment"}');

    expect(ref).toEqual(expect.objectContaining({
      url: expect.stringMatching(/^comment:[0-9a-f-]{36}$/),
      comment: 'Uploaded comment',
      upload: true,
    }));
  });

  it('preserves an existing ref URL', () => {
    const [ref] = getModels<Ref>('{"url":"https://example.com"}');

    expect(ref.url).toBe('https://example.com');
  });

  it('does not add a URL to an ext', () => {
    const [ext] = getModels<Ext>('{"tag":"example"}');

    expect(ext).not.toHaveProperty('url');
  });
});
