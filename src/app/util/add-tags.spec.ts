/// <reference types="vitest/globals" />
import { getAddTags, negatedTags, withoutNegated } from './add-tags';

describe('getAddTags', () => {
  it('defaults to public', () => {
    expect(getAddTags('science', undefined, undefined)).toEqual(['public', 'science']);
  });

  it('never adds negated tags', () => {
    const plugin = { tag: '+plugin/secret', config: { submit: 'secret', internal: true } } as any;
    expect(getAddTags('+plugin/secret', plugin, { addTags: ['!public', 'plugin/pinned'] }))
      .toEqual(['plugin/pinned', '+plugin/secret', 'internal']);
  });

  it('removes child tags of negated tags', () => {
    expect(getAddTags('science', undefined, { addTags: ['public/news', 'kids', '!public'] }))
      .toEqual(['kids', 'science']);
  });

  it('only negates addTags', () => {
    expect(negatedTags(['!public', 'science', '!'])).toEqual(['public']);
    expect(withoutNegated(['public', 'science'])).toEqual(['public', 'science']);
  });
});
