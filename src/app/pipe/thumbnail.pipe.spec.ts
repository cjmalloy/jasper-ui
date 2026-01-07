/// <reference types="vitest/globals" />
import { ThumbnailPipe } from './thumbnail.pipe';

describe('ThumbnailPipe', () => {
  it('create an instance', () => {
    const pipe = new ThumbnailPipe({} as any, {} as any, {} as any);
    expect(pipe).toBeTruthy();
  });
});
