/// <reference types="vitest/globals" />
import { SafePipe } from './safe.pipe';

describe('SafePipe', () => {
  it('create an instance', () => {
    const pipe = new SafePipe({} as any);
    expect(pipe).toBeTruthy();
  });
});
