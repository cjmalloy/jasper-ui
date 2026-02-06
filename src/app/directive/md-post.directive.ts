import { Directive, inject, Input, OnDestroy, OnInit, ViewContainerRef } from '@angular/core';
import { Subject } from 'rxjs';
import { EmbedService } from '../service/embed.service';

@Directive({ selector: '[appMdPost]' })
export class MdPostDirective implements OnInit, OnDestroy {
  private embeds = inject(EmbedService);
  private viewContainerRef = inject<ViewContainerRef>(ViewContainerRef);


  @Input('appMdPost')
  load?: Subject<void> | string;
  @Input()
  data? = '';
  @Input()
  origin? = '';

  private subscriptions: (() => void)[] = [];
  private lastData = '';

  ngOnInit(): void {
    if (this.load && typeof this.load !== 'string') {
      this.load.subscribe(() => this.postProcess())
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
    if (this.data === this.lastData) return;
    this.ngOnDestroy();
    this.subscriptions.push(this.embeds.postProcess(
      this.viewContainerRef,
      (type, el, fn) => this.event(type, el, fn),
      this.origin));
  }
}
