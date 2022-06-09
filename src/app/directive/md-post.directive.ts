import { AfterViewInit, Directive, Inject, Input, OnDestroy, ViewContainerRef } from '@angular/core';
import { Subject } from 'rxjs';
import { AdminService } from '../service/admin.service';
import { RefService } from '../service/api/ref.service';
import { EditorService } from '../service/editor.service';
import { EmbedService } from '../service/embed.service';

@Directive({
  selector: '[appMdPost]'
})
export class MdPostDirective implements AfterViewInit, OnDestroy {

  @Input("appMdPost")
  load?: Subject<void> | string;

  private subscriptions: (() => void)[] = [];

  constructor(
    private refs: RefService,
    private editor: EditorService,
    private admin: AdminService,
    private embeds: EmbedService,
    @Inject(ViewContainerRef) private viewContainerRef: ViewContainerRef,
  ) { }

  ngAfterViewInit(): void {
    this.postProcess();
    if (this.load && typeof this.load !== 'string') {
      this.load.subscribe(() => this.postProcess())
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
    this.embeds.postProcess(
      <HTMLDivElement>this.viewContainerRef.element.nativeElement,
      this.viewContainerRef,
      (type, el, fn) => this.event(type, el, fn))
  }
}
