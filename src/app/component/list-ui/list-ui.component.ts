import {
  afterRenderEffect,
  Component,
  ComponentRef,
  DestroyRef,
  ElementRef,
  inject,
  input,
  untracked,
  ViewContainerRef
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Ext } from '../../model/ext';
import { Page } from '../../model/page';
import { Ref, RefSort } from '../../model/ref';
import { active, hydrate, sortOrder } from '../../model/tag';
import { getTemplateScope, ListUiApi, Template } from '../../model/template';
import { AdminService } from '../../service/admin.service';
import { GraphService } from '../../service/api/graph.service';
import { RefService } from '../../service/api/ref.service';
import { Store } from '../../store/store';
import { createEmbed, createRef } from '../../util/embed';
import { getTitle } from '../../util/format';
import { getScheme } from '../../util/http';
import { getArgs, UrlFilter } from '../../util/query';
import { capturesAny } from '../../util/tag';
import { RefListComponent } from '../ref/ref-list/ref-list.component';

interface ListUiParams {
  size: number;
  sort: RefSort[];
  filter: UrlFilter[];
  search: string;
}

/**
 * Renders a Template's listUi in place of the default Ref list.
 */
@Component({
  selector: 'app-list-ui',
  template: '',
  host: { 'class': 'list-ui' },
})
export class ListUiComponent {
  private admin = inject(AdminService);
  private store = inject(Store);
  private refs = inject(RefService);
  private graphs = inject(GraphService);
  private vc = inject(ViewContainerRef);
  private el = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly template = input.required<Template>();
  readonly ext = input.required<Ext>();
  readonly tag = input('');
  readonly page = input<Page<Ref> | undefined>();
  readonly size = input(24);
  readonly sort = input<RefSort[]>([]);
  readonly filter = input<UrlFilter[]>([]);
  readonly search = input('');

  private cleanup?: () => void;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cleanup?.());
    // Render the admin trusted Handlebars template into the host element
    afterRenderEffect(() => {
      const template = this.template();
      const ext = this.ext();
      const page = this.page();
      const query = this.tag();
      const params = { size: this.size(), sort: this.sort(), filter: this.filter(), search: this.search() };
      untracked(() => this.render(template, ext, page, query, params));
    });
  }

  private render(template: Template, ext: Ext, page: Page<Ref> | undefined, query: string, params: ListUiParams) {
    this.cleanup?.();
    let alive = true;
    const cleanups: (() => void)[] = [];
    this.cleanup = () => {
      alive = false;
      for (const fn of cleanups.splice(0).reverse()) fn();
    };
    const onDestroy = (fn: () => void) => {
      if (alive) {
        cleanups.push(fn);
      } else {
        fn();
      }
    };
    const mount = (el: Element, c: ComponentRef<unknown>) => {
      el.append(c.location.nativeElement);
      let destroyed = false;
      const destroy = () => {
        if (destroyed) return;
        destroyed = true;
        c.destroy();
      };
      onDestroy(destroy);
      return destroy;
    };
    const api: ListUiApi = {
      fetch: (pageNumber = 0, size = params.size) => firstValueFrom(this.refs.page(getArgs(
        query,
        params.sort,
        [...params.filter, 'query/!internal', 'query/!plugin/delete', 'user/!plugin/user/hide'],
        params.search,
        pageNumber,
        size,
      ))),
      graph: urls => firstValueFrom(this.graphs.list(urls)),
      embed: (el, ref) => mount(el, createEmbed(this.vc, ref)),
      ref: (el, ref) => mount(el, createRef(this.vc, ref, true)),
      list: (el, refs, emptyMessage) => {
        const c = this.vc.createComponent(RefListComponent);
        c.setInput('page', Page.of(refs));
        c.setInput('pageControls', false);
        if (emptyMessage) c.setInput('emptyMessage', emptyMessage);
        return mount(el, c);
      },
      icon: ref => sortOrder(this.admin.getIcons(ref.tags, ref.plugins, getScheme(ref.url))).filter(i => active(ref, i)).shift()?.label || '',
      title: ref => getTitle(ref),
      matches: ref => !!query && !!capturesAny([query], ref.tags),
      onDestroy,
    };
    const host = this.el.nativeElement;
    host.innerHTML = hydrate(template.config, 'listUi', getTemplateScope(this.store.account.roles(), template, ext, host, {
      actions: api,
      query,
      page,
      params,
    }));
  }
}
