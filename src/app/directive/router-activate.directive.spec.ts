/// <reference types="vitest/globals" />
import { RouterActivateDirective } from './router-activate.directive';

describe('RouterActivateDirective', () => {
  it('should create an instance', () => {
    const directive = new RouterActivateDirective({} as any);
    expect(directive).toBeTruthy();
  });
});
