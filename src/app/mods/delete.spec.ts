/// <reference types="vitest/globals" />
import { Ref } from '../model/ref';
import { deleteNotice } from './delete';

describe('deleteNotice', () => {
  const ref = (): Ref => ({
    url: 'https://example.com',
    origin: '',
    title: 'Title',
    tags: ['public', 'science', '+protected', '_private', '+user/alice', '_user/bob', '+plugin/thing'],
  });

  it('keeps protected and private tags without a predicate', () => {
    expect(deleteNotice(ref()).tags).toEqual(
      ['plugin/delete', 'internal', 'public', '+protected', '_private', '+user/alice', '_user/bob']);
  });

  it('removes protected and private tags that can be removed', () => {
    const result = deleteNotice(ref(), () => true);
    expect(result.tags).toEqual(['plugin/delete', 'internal', 'public', '+user/alice', '_user/bob']);
    expect(result.title).toBeUndefined();
  });

  it('keeps tags that cannot be removed', () => {
    expect(deleteNotice(ref(), t => t !== '_private').tags).toEqual(
      ['plugin/delete', 'internal', 'public', '_private', '+user/alice', '_user/bob']);
  });

  it('only adds delete tags to locked refs', () => {
    const locked = { ...ref(), tags: ['locked', '_private'] };
    expect(deleteNotice(locked, () => true).tags).toEqual(['locked', '_private', 'plugin/delete', 'internal']);
  });
});
