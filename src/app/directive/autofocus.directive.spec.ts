/// <reference types="vitest/globals" />
import { ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AutofocusDirective } from './autofocus.directive';

describe('AutofocusDirective', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ElementRef, useValue: { nativeElement: { focus: vi.fn() } } },
      ]
    });
  });
  it('should create an instance', () => {
    const directive = TestBed.runInInjectionContext(() => new AutofocusDirective());
    expect(directive).toBeTruthy();
  });
});
