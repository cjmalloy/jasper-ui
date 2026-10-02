/// <reference types="vitest/globals" />
import { TestBed } from '@angular/core/testing';
import { TitleDirective } from './title.directive';

describe('TitleDirective', () => {
  it('should create an instance', () => {
    const directive = TestBed.runInInjectionContext(() => new TitleDirective({} as any, {} as any));
    expect(directive).toBeTruthy();
  });
});
