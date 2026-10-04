/// <reference types="vitest/globals" />
import { ViewContainerRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EmbedService } from '../service/embed.service';
import { MdPostDirective } from './md-post.directive';

describe('MdPostDirective', () => {
  it('should create an instance', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: EmbedService, useValue: {} },
        { provide: ViewContainerRef, useValue: {} },
      ],
    });
    const directive = TestBed.runInInjectionContext(() => new MdPostDirective());
    expect(directive).toBeTruthy();
  });
});
