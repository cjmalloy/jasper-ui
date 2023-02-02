import { AfterViewInit, ComponentRef, Directive, Inject, Input, OnDestroy, ViewContainerRef } from '@angular/core';
import * as _ from 'lodash-es';
import { Subject } from 'rxjs';
import { RefListComponent } from '../component/ref-list/ref-list.component';
import { RefComponent } from '../component/ref/ref.component';
import { ViewerComponent } from '../component/viewer/viewer.component';
import { Page } from '../model/page';
import { Ref } from '../model/ref';
import { isAudio } from '../plugin/audio';
import { isKnownEmbed } from '../plugin/embed';
import { isImage } from '../plugin/image';
import { isVideo } from '../plugin/video';
import { AdminService } from '../service/admin.service';
import { RefService } from '../service/api/ref.service';
import { EditorService } from '../service/editor.service';
import { EmbedService } from '../service/embed.service';
import { Embed } from '../util/embed';

@Directive({
  selector: '[appMdPost]'
})
export class MdPostDirective implements AfterViewInit, OnDestroy, Embed {

  @Input("appMdPost")
  load?: Subject<void> | string;
  @Input()
  origin? = '';

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
      this,
      (type, el, fn) => this.event(type, el, fn),
    this.origin)
  }

  createEmbed(ref: Ref | string, expandPlugins: string[] = []): ComponentRef<ViewerComponent> {
    const c = this.viewContainerRef.createComponent(ViewerComponent);
    if (_.isString(ref)) {
      const url = ref as string;
      ref = { url, origin: this.origin };
      if (isImage(url)) {
        expandPlugins = ['plugin/image'];
      } else if (isVideo(url)) {
        expandPlugins = ['plugin/video'];
      }  else if (isAudio(url)) {
        expandPlugins = ['plugin/audio'];
      } else if (isKnownEmbed(url)) {
        expandPlugins = ['plugin/embed'];
      }
    }
    c.instance.ref = ref;
    c.instance.tags = expandPlugins;
    return c;
  }

  createRef(ref: Ref, showToggle?: boolean): ComponentRef<RefComponent> {
    const c = this.viewContainerRef.createComponent(RefComponent);
    c.instance.ref = ref;
    c.instance.showToggle = !!showToggle;
    return c;
  }

  createRefList(page: Page<Ref>, pageControls?: boolean): ComponentRef<RefListComponent> {
    const c = this.viewContainerRef.createComponent(RefListComponent);
    c.instance.page = page;
    c.instance.pageControls = !!pageControls;
    return c;
  }
}
