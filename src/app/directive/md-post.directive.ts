import { DestroyRef, Directive, inject, input, ViewContainerRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MarkdownComponent } from 'ngx-markdown';
import { EmbedService } from '../service/embed.service';

/**
 * Post-processes the rendered markdown every time the host `markdown`
 * component emits `ready`.
 */
@Directive({ selector: '[markdown][appMdPost]' })
export class MdPostDirective {
  private embeds = inject(EmbedService);
  private viewContainerRef = inject(ViewContainerRef);

  readonly origin = input<string | undefined>('');

  private subscriptions: (() => void)[] = [];

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cleanup());
    inject(MarkdownComponent).ready.pipe(takeUntilDestroyed()).subscribe(() => this.postProcess());
  }

  private cleanup() {
    this.subscriptions.forEach(fn => fn());
    this.subscriptions.length = 0;
  }

  private event(type: string, el: Element, fn: any) {
    el.addEventListener(type, fn);
    this.subscriptions.push(() => el.removeEventListener(type, fn));
  }

  private postProcess() {
    this.cleanup();
    this.subscriptions.push(this.embeds.postProcess(
      this.viewContainerRef,
      (type, el, fn) => this.event(type, el, fn),
      this.origin()));
  }
}
