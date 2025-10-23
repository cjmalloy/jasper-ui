/// <reference types="vitest/globals" />
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AutofocusDirective } from './autofocus.directive';

describe('AutofocusDirective', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
      ]
    });
  });
  it('should create an instance', () => {
    const directive = new AutofocusDirective({} as any, TestBed.inject(Router));
    expect(directive).toBeTruthy();
  });
});
