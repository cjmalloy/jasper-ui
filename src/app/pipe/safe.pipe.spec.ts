/// <reference types="vitest/globals" />
import { TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';
import { SafePipe } from './safe.pipe';

describe('SafePipe', () => {
  it('create an instance', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: DomSanitizer, useValue: {} },
      ],
    });
    const pipe = TestBed.runInInjectionContext(() => new SafePipe());
    expect(pipe).toBeTruthy();
  });
});
