/// <reference types="vitest/globals" />
import { Ext } from '../model/ext';
import { Ref } from '../model/ref';
import { filterModels, getModels, isJsonObject, isModelsJson } from './zip';

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

  it('unpacks a ref and ext bundle', () => {
    const models = filterModels(getModels('{"ref":[{"url":"https://example.com","title":"A"}],"ext":[{"tag":"grid/cols","name":"Grid"}]}'));

    expect(models.ref).toEqual([expect.objectContaining({ url: 'https://example.com', title: 'A', upload: true })]);
    expect(models.ext).toEqual([expect.objectContaining({ tag: 'grid/cols', name: 'Grid', upload: true })]);
  });

  it('rejects JSON that is not a model and does not invent a comment URL', () => {
    expect(() => getModels('{"settings":true}')).toThrow(/bundle/);
    expect(() => getModels('[{"url":"https://example.com"},{"foo":1}]')).toThrow(/bundle/);
    expect(() => getModels('{"ref":[{"foo":1}]}')).toThrow(/bundle/);
  });

  it('accepts an empty model list', () => {
    expect(getModels('[]')).toEqual([]);
  });
});

describe('isJsonObject', () => {
  it('only accepts JSON objects and arrays', () => {
    expect(isJsonObject('{"settings":true}')).toBe(true);
    expect(isJsonObject('[1]')).toBe(true);
    expect(isJsonObject('https://example.com')).toBe(false);
    expect(isJsonObject('123')).toBe(false);
    expect(isJsonObject('null')).toBe(false);
  });
});

describe('isModelsJson', () => {
  it('accepts a ref and ext bundle', () => {
    expect(isModelsJson('{"ref":[{"url":"https://example.com"}],"ext":[{"tag":"example"}]}')).toBe(true);
    expect(isModelsJson('{"ext":[{"tag":"example"}]}')).toBe(true);
  });

  it('rejects empty or invalid bundles', () => {
    expect(isModelsJson('{"ref":[]}')).toBe(false);
    expect(isModelsJson('{"ref":[{}]}')).toBe(false);
    expect(isModelsJson('{"ref":[{"url":"https://example.com"}],"settings":true}')).toBe(false);
  });

  it('accepts a single ref or ext', () => {
    expect(isModelsJson('{"url":"https://example.com"}')).toBe(true);
    expect(isModelsJson('{"tag":"example"}')).toBe(true);
  });

  it('accepts mixed refs and exts', () => {
    expect(isModelsJson('[{"url":"https://example.com"},{"tag":"example"}]')).toBe(true);
  });

  it('rejects plain text and non-object JSON', () => {
    expect(isModelsJson('')).toBe(false);
    expect(isModelsJson('https://example.com')).toBe(false);
    expect(isModelsJson('123')).toBe(false);
    expect(isModelsJson('"text"')).toBe(false);
    expect(isModelsJson('null')).toBe(false);
    expect(isModelsJson('[]')).toBe(false);
    expect(isModelsJson('[{"url":"https://example.com"}, 1]')).toBe(false);
  });

  it('accepts a ref comment without a URL', () => {
    expect(isModelsJson('{"comment":"Uploaded comment"}')).toBe(true);
  });

  it('rejects objects without a ref or ext identity', () => {
    expect(isModelsJson('{}')).toBe(false);
    expect(isModelsJson('{"settings":true}')).toBe(false);
    expect(isModelsJson('{"comment":""}')).toBe(false);
    expect(isModelsJson('{"url":123}')).toBe(false);
    expect(isModelsJson('{"tag":true}')).toBe(false);
    expect(isModelsJson('[{"url":"https://example.com"},{}]')).toBe(false);
  });
});
