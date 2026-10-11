/// <reference types="vitest/globals" />
import { ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ConfigService } from '../service/config.service';
import { ResizeHandleDirective } from './resize-handle.directive';

describe('ResizeHandleDirective', () => {
  it('should create an instance', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: ConfigService, useValue: {} },
        { provide: ElementRef, useValue: { nativeElement: {} } },
      ],
    });
    const directive = TestBed.runInInjectionContext(() => new ResizeHandleDirective());
    expect(directive).toBeTruthy();
  });
});
