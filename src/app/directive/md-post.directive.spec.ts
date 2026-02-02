/// <reference types="vitest/globals" />
import { MdPostDirective } from './md-post.directive';

describe('MdPostDirective', () => {
  it('should create an instance', () => {
    const directive = new MdPostDirective();
    expect(directive).toBeTruthy();
  });
});
