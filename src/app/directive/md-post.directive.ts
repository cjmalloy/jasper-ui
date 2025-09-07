import { ComponentRef, Directive, Inject, Input, OnDestroy, OnInit, ViewContainerRef } from '@angular/core';
import { flatten, isString, uniq } from 'lodash-es';
import { Subject } from 'rxjs';
import { CommentComponent } from '../component/comment/comment.component';
import { LensComponent } from '../component/lens/lens.component';
import { NavComponent } from '../component/nav/nav.component';
import { RefComponent } from '../component/ref/ref.component';
import { ViewerComponent } from '../component/viewer/viewer.component';
import { Ext } from '../model/ext';
import { Page } from '../model/page';
import { Ref } from '../model/ref';
import { AdminService } from '../service/admin.service';
import { EmbedService } from '../service/embed.service';
import { Embed } from '../util/embed';
import { hasTag } from '../util/tag';

@Directive({
  standalone: false,
  selector: '[appMdPost]'
})
export class MdPostDirective implements OnInit, OnDestroy, Embed {

  @Input('appMdPost')
  load?: Subject<void> | string;
  @Input()
  data? = '';
  @Input()
  origin? = '';

  private subscriptions: (() => void)[] = [];
  private lastData = '';

  constructor(
    private admin: AdminService,
    private embeds: EmbedService,
    @Inject(ViewContainerRef) private viewContainerRef: ViewContainerRef,
  ) { }

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
      <HTMLDivElement>this.viewContainerRef.element.nativeElement,
      this,
      (type, el, fn) => this.event(type, el, fn),
      this.origin));
  }

  createLink(url: string, text: string, title = '', css = ''): ComponentRef<NavComponent> {
    const c = this.viewContainerRef.createComponent(NavComponent);
    c.instance.url = url;
    c.instance.text = text;
    c.instance.title = title;
    c.instance.css = css;
    return c;
  }

  createEmbed(ref: Ref | string, expandPlugins?: string[]): ComponentRef<ViewerComponent> {
    const c = this.viewContainerRef.createComponent(ViewerComponent);
    if (isString(ref)) {
      const url = ref as string;
      ref = { url, origin: this.origin };
    } else if (hasTag('plugin/seamless', ref)) {
      expandPlugins = uniq([...(expandPlugins || []), 'plugin/seamless']);
    }
    if (expandPlugins?.length) c.instance.tags = expandPlugins;
    c.instance.ref = ref;
    c.instance.init();
    return c;
  }

  createRef(ref: Ref, showToggle?: boolean): ComponentRef<RefComponent|CommentComponent> {
    if (this.admin.getPlugin('plugin/comment') && hasTag('plugin/comment', ref)) {
      const c = this.viewContainerRef.createComponent(CommentComponent);
      c.instance.ref = ref;
      c.instance.depth = 0;
      c.instance.init();
      return c;
    } else {
      const c = this.viewContainerRef.createComponent(RefComponent);
      c.instance.ref = ref;
      c.instance.showToggle = !!showToggle;
      c.instance.expandInline = !!this.admin.getPlugin('plugin/thread') && hasTag('plugin/thread', ref);
      c.instance.init();
      return c;
    }
  }

  createLens(params: any, page: Page<Ref>, tag: string, ext?: Ext): ComponentRef<LensComponent> {
    const c = this.viewContainerRef.createComponent(LensComponent);
    c.instance.page = page;
    c.instance.pageControls = false;
    c.instance.tag = tag;
    c.instance.ext = ext;
    c.instance.size = params.size;
    c.instance.cols = params.cols;
    c.instance.sort = flatten([params.sort || []]);
    c.instance.filter = flatten([params.filter || []]);
    c.instance.search = params.search;
    c.instance.init();
    return c;
  }
}
