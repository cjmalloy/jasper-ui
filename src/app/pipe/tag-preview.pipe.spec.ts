/// <reference types="vitest/globals" />
import { TagPreviewPipe } from './tag-preview.pipe';

describe('TagPreviewPipe', () => {
  it('create an instance', () => {
    const pipe = new TagPreviewPipe();
    expect(pipe).toBeTruthy();
  });
});
