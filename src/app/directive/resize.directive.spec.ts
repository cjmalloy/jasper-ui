/// <reference types="vitest/globals" />
import { ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ResizeDirective } from './resize.directive';

describe('ResizeDirective', () => {
  it('should create an instance', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: ElementRef, useValue: { nativeElement: { style: {} } } },
      ],
    });
    const directive = TestBed.runInInjectionContext(() => new ResizeDirective());
    expect(directive).toBeTruthy();
  });
});
