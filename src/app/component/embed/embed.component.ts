import {
  AfterViewInit,
  Component,
  ComponentFactoryResolver,
  ElementRef,
  HostBinding,
  Inject,
  Input, OnDestroy,
  OnInit,
  ViewChild, ViewContainerRef
} from '@angular/core';
import { MarkdownComponent } from 'ngx-markdown';
import { Ref } from '../../model/ref';
import { AdminService } from '../../service/admin.service';
import { RefService } from '../../service/api/ref.service';
import { EmbedService } from '../../service/embed.service';
import { RefComponent } from '../ref/ref.component';

@Component({
  selector: 'app-embed',
  templateUrl: './embed.component.html',
  styleUrls: ['./embed.component.scss']
})
export class EmbedComponent implements AfterViewInit, OnDestroy {
  @HostBinding('class') css = 'embed';

  @Input()
  ref!: Ref;
  @Input()
  expandPlugins: string[] = [];

  @ViewChild('iframe')
  iframe!: ElementRef;
  @ViewChild('md')
  md!: MarkdownComponent;

  private subscriptions: (() => void)[] = [];

  constructor(
    public admin: AdminService,
    private embeds: EmbedService,
    private refs: RefService,
    @Inject(ViewContainerRef) private viewContainerRef: ViewContainerRef,
  ) { }

  ngAfterViewInit(): void {
    if (this.iframe) {
      this.embeds.writeIframe(this.embed, this.iframe.nativeElement);
    }
    if (this.md) {
      this.postProcess(<HTMLDivElement>this.md.element.nativeElement);
    }
  }

  ngOnDestroy() {
    this.subscriptions.forEach(fn => fn());
    this.subscriptions.length = 0;
  }

  get emoji() {
    return !!this.admin.status.plugins.emoji && !!this.ref.tags?.includes('plugin/emoji');
  }

  get latex() {
    return !!this.admin.status.plugins.latex && !!this.ref.tags?.includes('plugin/latex');
  }

  get embed() {
    return this.ref.plugins?.['plugin/embed']?.url || this.ref.url;
  }

  get qrWidth() {
    return Math.min(256, window.innerWidth);
  }

  cssUrl(url: string) {
    return `url("${url}")`;
  }

  click(el: Element, fn: any) {
    el.addEventListener('click', fn);
    this.subscriptions.push(() => el.removeEventListener('click', fn));
  }

  postProcess(el: HTMLDivElement) {
    const inlineRefs = el.querySelectorAll<HTMLAnchorElement>('.inline-ref');
    inlineRefs.forEach(t => {
      this.refs.get(this.embeds.getRefUrl(t.href!)).subscribe(ref => {
        const c = this.viewContainerRef.createComponent(RefComponent);
        c.instance.ref = ref;
        c.instance.showToggle = true;
        t.parentNode?.insertBefore(c.location.nativeElement, t);
        t.remove();
      });
    });
    const toggles = el.querySelectorAll<HTMLDivElement>('.toggle');
    toggles.forEach(t => {
      // @ts-ignore
      t.expanded = false;
      // @ts-ignore
      t.querySelector('.toggle-x').style.display = 'none';
      this.click(t, () => {
        // @ts-ignore
        t.querySelector('.toggle-plus').style.display = t.expanded ? 'block' : 'none';
        // @ts-ignore
        t.querySelector('.toggle-x').style.display = !t.expanded ? 'block' : 'none';
        // @ts-ignore
        if (t.expanded) {
          t.nextSibling?.remove();
          // @ts-ignore
          t.expanded = !t.expanded;
        } else {
          // TODO: Don't use title to store url
          this.refs.get(this.embeds.getRefUrl(t.title!)).subscribe(ref => {
            const c = this.viewContainerRef.createComponent(RefComponent);
            c.instance.ref = ref;
            c.instance.showToggle = true;
            t.parentNode?.insertBefore(c.location.nativeElement, t.nextSibling);
            // @ts-ignore
            t.expanded = !t.expanded;
          });
        }
      });
    });
  }
}
