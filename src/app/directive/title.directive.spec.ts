/// <reference types="vitest/globals" />
import { ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Store } from '../store/store';
import { TitleDirective } from './title.directive';

describe('TitleDirective', () => {
  it('should create an instance', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: Store, useValue: {} },
        { provide: ElementRef, useValue: { nativeElement: {} } },
      ],
    });
    const directive = TestBed.runInInjectionContext(() => new TitleDirective());
    expect(directive).toBeTruthy();
  });
});
