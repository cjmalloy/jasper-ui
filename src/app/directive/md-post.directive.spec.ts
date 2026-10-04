/// <reference types="vitest/globals" />
import { EventEmitter, ViewContainerRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MarkdownComponent } from 'ngx-markdown';
import { EmbedService } from '../service/embed.service';
import { MdPostDirective } from './md-post.directive';

describe('MdPostDirective', () => {
  it('post-processes on every ready emission, even with the same data', () => {
    const ready = new EventEmitter<void>();
    const cleanup = vi.fn();
    const postProcess = vi.fn(() => cleanup);
    TestBed.configureTestingModule({
      providers: [
        { provide: EmbedService, useValue: { postProcess } },
        { provide: ViewContainerRef, useValue: {} },
        { provide: MarkdownComponent, useValue: { ready } },
      ],
    });
    TestBed.runInInjectionContext(() => new MdPostDirective());
    ready.emit();
    ready.emit();
    expect(postProcess).toHaveBeenCalledTimes(2);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
