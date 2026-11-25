import {
  Component,
  ComponentRef,
  computed,
  effect,
  ElementRef,
  forwardRef,
  inject,
  input,
  untracked,
  viewChildren,
  ViewContainerRef
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { HasChanges } from '../../guard/pending-changes.guard';
import { Ext } from '../../model/ext';
import { Page } from '../../model/page';
import { Ref, RefPageArgs, RefSort } from '../../model/ref';
import { active, hydrate, sortOrder } from '../../model/tag';
import { getTemplateScope, LensUiApi, LensUiMount, Template } from '../../model/template';
import { AccountService } from '../../service/account.service';
import { AdminService } from '../../service/admin.service';
import { GraphService } from '../../service/api/graph.service';
import { RefService } from '../../service/api/ref.service';
import { QueryStore } from '../../store/query';
import { Store } from '../../store/store';
import { createEmbed, createRef } from '../../util/embed';
import { getTitle } from '../../util/format';
import { getScheme } from '../../util/http';
import { getArgs, UrlFilter, withStableDateSort } from '../../util/query';
import { capturesAny, hasPrefix } from '../../util/tag';
import { BlogComponent } from '../blog/blog.component';
import { ChatComponent } from '../chat/chat.component';
import { FolderComponent } from '../folder/folder.component';
import { GridComponent } from '../grid/grid.component';
import { KanbanComponent } from '../kanban/kanban.component';
import { LoadingComponent } from '../loading/loading.component';
import { MapComponent } from '../map/map.component';
import { MdComponent } from '../md/md.component';
import { NotebookComponent } from '../notebook/notebook.component';
import { RefListComponent } from '../ref/ref-list/ref-list.component';
import { RefComponent } from '../ref/ref.component';
import { ViewerComponent } from '../viewer/viewer.component';

@Component({
  selector: 'app-lens',
  templateUrl: './lens.component.html',
  styleUrls: ['./lens.component.scss'],
  imports: [
    LoadingComponent,
    forwardRef(() => RefComponent),
    forwardRef(() => BlogComponent),
    forwardRef(() => ChatComponent),
    forwardRef(() => FolderComponent),
    forwardRef(() => RefListComponent),
    forwardRef(() => KanbanComponent),
    forwardRef(() => NotebookComponent),
    forwardRef(() => GridComponent),
    forwardRef(() => MapComponent),
    ViewerComponent,
    MdComponent,
  ],
})
export class LensComponent implements HasChanges {
  admin = inject(AdminService);
  account = inject(AccountService);
  query = inject(QueryStore);
  private store = inject(Store);
  private refs = inject(RefService);
  private graphs = inject(GraphService);
  private vc = inject(ViewContainerRef);
  private el = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly ext = input<Ext | undefined>();
  readonly tag = input('');
  readonly fullPage = input(false);
  readonly cols = input(0);
  readonly size = input(24);
  readonly sort = input<RefSort[]>([]);
  readonly filter = input<UrlFilter[]>([]);
  readonly search = input('');
  readonly page = input<Page<Ref> | undefined>();
  /** Args used to load {@link page}, if different from tag, sort, filter and search. */
  readonly args = input<RefPageArgs | undefined>();
  readonly pageControls = input(true);
  readonly showAlarm = input(true);
  readonly showVotes = input(false);

  readonly plugins = computed(() => hasPrefix(this.ext()?.tag, 'plugin') ? [this.ext()!.tag] : undefined);
  readonly header = computed(() => this.ext()?.config?.header);
  readonly uiTemplates = computed(() => this.ext() ? this.admin.getTemplateUi(this.ext()!.tag) : []);

  /** Hydrating runs the template's deferred scripts, so only redo it when the inputs change. */
  private readonly ui = computed(() => {
    const templates = this.uiTemplates();
    if (!templates.length) return undefined;
    const ext = this.ext()!;
    const page = this.page();
    const query = this.tag();
    const params = { size: this.size(), sort: this.sort(), filter: this.filter(), search: this.search() };
    const args = this.args() ?? getArgs(query, params.sort, params.filter, params.search);
    return untracked(() => this.hydrateUi(templates, ext, page, query, params, args));
  });
  /** One entry per hydration, so the markdown host is recreated even if the HTML is unchanged. */
  readonly uiHosts = computed(() => this.ui() ? [this.ui()!] : []);

  readonly list = viewChildren<HasChanges>('lens');
  private mounted = new Set<ComponentRef<unknown>>();

  constructor() {
    // Destroy the components and listeners the previous template UI mounted
    effect(onCleanup => {
      const ui = this.ui();
      onCleanup(() => ui?.cleanup());
    });
  }

  saveChanges() {
    return !this.list()?.find(t => !t.saveChanges())
      && ![...this.mounted].find(c => (c.instance as any).saveChanges?.() === false);
  }

  private hydrateUi(templates: Template[], ext: Ext, page: Page<Ref> | undefined, query: string, params: any, args: RefPageArgs) {
    let alive = true;
    const cleanups: (() => void)[] = [];
    const cleanup = () => {
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
    const mount = (el: Element, c: ComponentRef<unknown>): LensUiMount => {
      el.append(c.location.nativeElement);
      this.mounted.add(c);
      let destroyed = false;
      const destroy = () => {
        if (destroyed) return;
        destroyed = true;
        const i = cleanups.indexOf(destroy);
        if (i >= 0) cleanups.splice(i, 1);
        this.mounted.delete(c);
        c.destroy();
      };
      onDestroy(destroy);
      return Object.assign(destroy, {
        hasChanges: () => !destroyed && (c.instance as any).saveChanges?.() === false,
      });
    };
    const actions: LensUiApi = {
      fetch: (pageNumber = 0, size) => firstValueFrom(this.refs.page(withStableDateSort({
        ...args,
        page: pageNumber,
        size: size ?? args.size ?? page?.page.size ?? params.size,
      }))),
      graph: urls => firstValueFrom(this.graphs.list(urls)),
      embed: (el, ref) => mount(el, createEmbed(this.vc, ref)),
      ref: (el, ref) => mount(el, createRef(this.vc, ref, true)),
      list: (el, refs, emptyMessage) => {
        const c = this.vc.createComponent(RefListComponent);
        c.setInput('page', Page.of(refs));
        c.setInput('pageControls', false);
        if (emptyMessage) c.setInput('emptyMessage', emptyMessage);
        return Object.assign(mount(el, c), {
          update: (refs: Ref[]) => c.setInput('page', Page.of(refs)),
        });
      },
      icon: ref => sortOrder(this.admin.getIcons(ref.tags, ref.plugins, getScheme(ref.url))).filter(i => active(ref, i)).shift()?.label || '',
      title: ref => getTitle(ref),
      matches: ref => !!query && !!capturesAny([query], ref.tags),
      onDestroy,
    };
    const text = templates.map(template => hydrate(template.config, 'ui', getTemplateScope(this.store.account.roles(), template, ext, this.el.nativeElement, {
      actions,
      query,
      page,
      params,
    }))).join('');
    return { text, cleanup };
  }

  isTemplate(template: string) {
    return this.admin.getTemplate(template) && hasPrefix(this.ext()?.tag, template);
  }

  cssClass(tag?: string) {
    if (!tag) return '';
    return tag.replace(/\//g, '_')
      .replace(/\./g, '-')
      .replace(/[^\w-]/g, '');
  }
}
