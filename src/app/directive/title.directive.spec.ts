/// <reference types="vitest/globals" />
import { TitleDirective } from './title.directive';

describe('TitleDirective', () => {
  it('should create an instance', () => {
    const directive = new TitleDirective({} as any, {} as any);
    expect(directive).toBeTruthy();
  });
});
