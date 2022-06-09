import { AfterViewInit, Directive, Inject, Input, OnDestroy, ViewContainerRef } from '@angular/core';
import { Subject } from 'rxjs';
import { EmbedComponent } from '../component/embed/embed.component';
import { RefListComponent } from '../component/ref-list/ref-list.component';
import { RefComponent } from '../component/ref/ref.component';
import { AdminService } from '../service/admin.service';
import { RefService } from '../service/api/ref.service';
import { EditorService } from '../service/editor.service';

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
    @Inject(ViewContainerRef) private viewContainerRef: ViewContainerRef,
  ) { }

  ngAfterViewInit(): void {
    this.postProcess(<HTMLDivElement>this.viewContainerRef.element.nativeElement);
    if (this.load && typeof this.load !== 'string') {
      this.load.subscribe(() => this.postProcess(<HTMLDivElement>this.viewContainerRef.element.nativeElement))
    }
  }

  ngOnDestroy() {
    this.subscriptions.forEach(fn => fn());
    this.subscriptions.length = 0;
  }

  click(el: Element, fn: any) {
    el.addEventListener('click', fn);
    this.subscriptions.push(() => el.removeEventListener('click', fn));
  }

  postProcess(el: HTMLDivElement) {
    const inlineRefs = el.querySelectorAll<HTMLAnchorElement>('.inline-ref');
    inlineRefs.forEach(t => {
      this.refs.get(this.editor.getRefUrl(t.innerText)).subscribe(ref => {
        const c = this.viewContainerRef.createComponent(RefComponent);
        c.instance.ref = ref;
        c.instance.showToggle = true;
        t.parentNode?.insertBefore(c.location.nativeElement, t);
        t.remove();
      });
    });
    const embedRefs = el.querySelectorAll<HTMLAnchorElement>('.embed-ref');
    embedRefs.forEach(t => {
      this.refs.get(this.editor.getRefUrl(t.innerText)).subscribe(ref => {
        const expandPlugins = this.admin.getEmbeds(ref);
        if (ref.comment || expandPlugins.length) {
          const c = this.viewContainerRef.createComponent(EmbedComponent);
          c.instance.ref = ref;
          c.instance.expandPlugins = expandPlugins;
          t.parentNode?.insertBefore(c.location.nativeElement, t);
        }
        t.remove();
      });
    });
    const inlineQueries = el.querySelectorAll<HTMLAnchorElement>('.inline-query');
    inlineQueries.forEach(t => {
      const [query, sort] = this.editor.getQueryUrl(t.innerText);
      this.refs.page({ query, sort: [sort] }).subscribe(page => {
        const c = this.viewContainerRef.createComponent(RefListComponent);
        c.instance.page = page;
        t.parentNode?.insertBefore(c.location.nativeElement, t);
        t.remove();
      });
    });
    const toggles = el.querySelectorAll<HTMLDivElement>('.toggle.inline');
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
          const url = t.title!;
          const type = this.editor.getUrlType(url);
          if (type === 'ref') {
            this.refs.get(this.editor.getRefUrl(url)).subscribe(ref => {
              const c = this.viewContainerRef.createComponent(RefComponent);
              c.instance.ref = ref;
              c.instance.showToggle = true;
              t.parentNode?.insertBefore(c.location.nativeElement, t.nextSibling);
              // @ts-ignore
              t.expanded = !t.expanded;
            });
          } else if (type === 'tag') {
            const [query, sort] = this.editor.getQueryUrl(url);
            // @ts-ignore
            this.refs.page({ query, sort: [sort], ...Object.fromEntries(new URL(url).searchParams) }).subscribe(page => {
              const c = this.viewContainerRef.createComponent(RefListComponent);
              c.instance.page = page;
              t.parentNode?.insertBefore(c.location.nativeElement, t.nextSibling);
              // @ts-ignore
              t.expanded = !t.expanded;
            });
          }
        }
      });
    });
  }
}
