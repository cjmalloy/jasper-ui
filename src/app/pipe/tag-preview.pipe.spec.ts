import { TagPreviewPipe } from './tag-preview.pipe';

describe('TagPreviewPipe', () => {
  it('create an instance', () => {
    const pipe = new TagPreviewPipe({} as any, {} as any);
    expect(pipe).toBeTruthy();
  });
});
