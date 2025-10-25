/// <reference types="vitest/globals" />
import { FillWidthDirective } from './fill-width.directive';

describe('FillWidthDirective', () => {
  it('should create an instance', () => {
    const directive = new FillWidthDirective({} as any, { nativeElement: document.createElement('textarea') });
    expect(directive).toBeTruthy();
  });
});
