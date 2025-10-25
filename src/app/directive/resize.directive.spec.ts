/// <reference types="vitest/globals" />
import { ResizeDirective } from './resize.directive';

describe('ResizeDirective', () => {
  it('should create an instance', () => {
    const directive = new ResizeDirective({} as any, {} as any);
    expect(directive).toBeTruthy();
  });
});
