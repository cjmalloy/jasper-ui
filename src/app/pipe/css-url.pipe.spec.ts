/// <reference types="vitest/globals" />
import { CssUrlPipe } from './css-url.pipe';

describe('CssUrlPipe', () => {
  it('create an instance', () => {
    const pipe = new CssUrlPipe({} as any);
    expect(pipe).toBeTruthy();
  });
});
