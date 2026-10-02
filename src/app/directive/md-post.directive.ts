import { Directive, Inject, input, ViewContainerRef, afterNextRender, DestroyRef, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { EmbedService } from '../service/embed.service';

@Directive({ selector: '[appMdPost]' })
export class MdPostDirective {
  private readonly destroyCleanup = inject(DestroyRef).onDestroy(() => this.cleanup());


  readonly load = input<Subject<void> | string | undefined>(undefined, { alias: 'appMdPost' });
  readonly data = input('');
  readonly origin = input<string | undefined>('');

  private subscriptions: (() => void)[] = [];
  private lastData = '';

  constructor(
    private embeds: EmbedService,
    @Inject(ViewContainerRef) private viewContainerRef: ViewContainerRef,
  ) { }

  private readonly initialize = afterNextRender(() => {
    const load = this.load();
    if (load && typeof load !== 'string') {
      load.subscribe(() => this.postProcess())
    } else {
      this.postProcess();
    }
  });

  cleanup() {
    this.subscriptions.forEach(fn => fn());
    this.subscriptions.length = 0;
  }

  event(type: string, el: Element, fn: any) {
    el.addEventListener(type, fn);
    this.subscriptions.push(() => el.removeEventListener(type, fn));
  }

  postProcess() {
    const data = this.data();
    if (data === this.lastData) return;
    this.lastData = data;
    this.cleanup();
    this.subscriptions.push(this.embeds.postProcess(
      this.viewContainerRef,
      (type, el, fn) => this.event(type, el, fn),
      this.origin()));
  }
}
