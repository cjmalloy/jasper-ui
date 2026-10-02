import { Directive, Inject, input, OnDestroy, OnInit, ViewContainerRef } from '@angular/core';
import { Subject } from 'rxjs';
import { EmbedService } from '../service/embed.service';

@Directive({ selector: '[appMdPost]' })
export class MdPostDirective implements OnInit, OnDestroy {

  readonly load = input<Subject<void> | string | undefined>(undefined, { alias: 'appMdPost' });
  readonly data = input('');
  readonly origin = input<string | undefined>('');

  private subscriptions: (() => void)[] = [];
  private lastData = '';

  constructor(
    private embeds: EmbedService,
    @Inject(ViewContainerRef) private viewContainerRef: ViewContainerRef,
  ) { }

  ngOnInit(): void {
    const load = this.load();
    if (load && typeof load !== 'string') {
      load.subscribe(() => this.postProcess())
    } else {
      this.postProcess();
    }
  }

  ngOnDestroy() {
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
    this.ngOnDestroy();
    this.subscriptions.push(this.embeds.postProcess(
      this.viewContainerRef,
      (type, el, fn) => this.event(type, el, fn),
      this.origin()));
  }
}
