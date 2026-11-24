import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  Injector,
  signal,
  viewChild
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { omit, pickBy, uniq } from 'lodash-es';
import { DateTime } from 'luxon';
import { catchError, filter, map, of, Subscription, switchMap, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LoadingComponent } from '../../component/loading/loading.component';
import { RefComponent } from '../../component/ref/ref.component';
import { SidebarComponent } from '../../component/sidebar/sidebar.component';
import { TabsComponent } from '../../component/tabs/tabs.component';
import { HasChanges } from '../../guard/pending-changes.guard';
import { Ref } from '../../model/ref';
import { isWiki } from '../../mods/org/wiki';
import { AdminService } from '../../service/admin.service';
import { RefService } from '../../service/api/ref.service';
import { StompService } from '../../service/api/stomp.service';
import { TaggingService } from '../../service/api/tagging.service';
import { ConfigService } from '../../service/config.service';
import { QueryStore } from '../../store/query';
import { Store } from '../../store/store';
import { ThreadStore } from '../../store/thread';
import { markRead } from '../../util/response';
import { hasTag, isAuthorTag, localPluginResponses, pluginResponses, privateTag, top } from '../../util/tag';

@Component({
  selector: 'app-ref-page',
  templateUrl: './ref.component.html',
  styleUrls: ['./ref.component.scss'],
  imports: [
    RefComponent,
    TabsComponent,
    RouterLink,
    RouterLinkActive,
    SidebarComponent,
    RouterOutlet,
    LoadingComponent,
  ],
})
export class RefPage implements HasChanges {
  config = inject(ConfigService);
  admin = inject(AdminService);
  store = inject(Store);
  private refs = inject(RefService);
  private ts = inject(TaggingService);
  private router = inject(Router);
  private stomp = inject(StompService);
  private query = inject(QueryStore);
  private threadStore = inject(ThreadStore);


  private readonly injector = inject(Injector);

  private readonly newResponseUrls = signal<string[]>([]);
  readonly newResponses = computed(() => {
    switch (this.store.view.current()) {
      // These pages fetch new responses, so they can be filtered by type and author
      case 'ref/summary':
      case 'ref/thread':
      case 'ref/errors':
        return this.store.view.responses()
          .filter(ref => this.showsResponse(ref) && !isAuthorTag(this.store.account.tag(), ref)).length;
    }
    const shown = new Set(this.store.view.responses().map(ref => ref.url));
    return this.newResponseUrls().filter(url => !shown.has(url)).length;
  });
  private destroyRef = inject(DestroyRef);

  readonly ref = viewChild<RefComponent>('ref');
  private url = '';
  private origin?: string;
  private watchSelf?: Subscription;
  private watchKey = '';
  private watchResponsesKey = '';
  private watchResponses?: Subscription;

  saveChanges() {
    const ref = this.ref();
    return !ref || ref.saveChanges();
  }

  private readonly initialize = afterNextRender(() => {
    this.url = this.store.view.url();
    this.origin = this.store.view.origin();
    if (this.url) this.reload(this.url, this.origin);
    effect(() => {
      const url = this.store.view.url();
      const origin = this.store.view.origin();
      if (!url) return;
      if (url === this.url && origin === this.origin) return;
      this.url = url;
      this.origin = origin;
      this.reload(url, origin);
    }, { injector: this.injector });
  });

  private readonly destroyCleanup = inject(DestroyRef).onDestroy(() => {
    this.store.view.clearRef();
  });

  readonly refWarning = computed(() => {
    const warn = this.sources() > 0 && this.store.view.published() && +this.store.view.ref()!.published! !== +DateTime.fromISO(this.store.view.published());
    if (this.store.view.published()) this.router.navigate([], { queryParams: { published: null }, queryParamsHandling: 'merge', replaceUrl: true });
    return warn;
  });

  readonly expandedOnLoad = computed(() => this.store.view.current() === 'ref/thread' ||
    this.store.local.isRefToggled(this.store.view.url(), this.store.view.current() === 'ref/summary' || this.fullscreen()?.onload));

  readonly fullscreen = computed(() => {
    if (!this.admin.getPlugin('plugin/fullscreen')) return undefined;
    return this.store.view.ref()?.plugins?.['plugin/fullscreen'];
  });

  readonly comment = computed(() => this.admin.getPlugin('plugin/comment') && hasTag('plugin/comment', this.store.view.ref()));

  readonly comments = computed(() => {
    if (!this.admin.getPlugin('plugin/comment')) return 0;
    return pluginResponses(this.store.view.ref(), 'plugin/comment');
  });

  readonly thread = computed(() => this.admin.getPlugin('plugin/thread') && (hasTag('plugin/thread', this.store.view.ref()) || this.store.view.current() === 'ref/thread'));

  readonly threads = computed(() => {
    if (!this.admin.getPlugin('plugin/thread')) return 0;
    return hasTag('plugin/thread', this.store.view.ref()) || pluginResponses(this.store.view.ref(), 'plugin/thread');
  });

  readonly logs = computed(() => {
    if (!this.admin.getPlugin('+plugin/log')) return 0;
    return localPluginResponses(this.store.view.ref(), '+plugin/log');
  });

  readonly responses = computed(() => this.store.view.ref()?.metadata?.responses || 0);

  readonly sources = computed(() => {
    const sources = (this.store.view.ref()?.sources || []).filter( s => s != this.store.view.url());
    return sources.length || 0;
  });

  readonly alts = computed(() => this.store.view.ref()?.alternateUrls?.length || 0);

  reload(url?: string, origin = this.origin) {
    url ||= this.url || '';
    if (!url) {
      this.store.view.clear();
      return;
    }
    this.newResponseUrls.set([]);
    this.store.view.responses.set([]);
    this.refs.count({ url, obsolete: null }).subscribe(count => this.store.view.versions.set(Math.max(0, count - 1)));
    const fetchTop = (ref: Ref) => hasTag('plugin/thread', ref) || hasTag('plugin/comment', ref);
    const cached = this.store.view.ref();
    (url === cached?.url && cached.origin !== undefined && (origin === undefined || cached.origin === origin)
        ? of(cached)
        : origin === undefined
        ? this.refs.getCurrent(url)
        : this.refs.get(url, origin)
    ).pipe(
      catchError(err => err.status === 404 ? of(undefined) : throwError(() => err)),
      map(ref => ref || { url }),
      map(ref => this.markRead(ref)),
      tap(ref => this.watch(ref)),
      switchMap(ref => !fetchTop(ref) ? of([ref, undefined])
        : top(ref) === url ? of([ref, ref])
        : top(ref) === this.store.view.top()?.url ? of([ref, this.store.view.top()])
        : this.refs.getCurrent(top(ref)).pipe(
          map(top => [ref, top]),
          catchError(err => err.status === 404 ? of([ref, undefined]) : throwError(() => err)),
        )),
      tap(([ref, top]) => this.store.view.setRef(ref, top)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe();
    if (this.config.websockets && this.watchResponsesKey !== url) {
      this.watchResponsesKey = url;
      this.watchResponses?.unsubscribe();
      this.watchResponses = this.stomp.watchResponse(url).pipe(
        filter(res => res !== url && !res.startsWith('tag:')),
        filter(res => !this.newResponseUrls().includes(res) && !this.visible(res)),
        takeUntilDestroyed(this.destroyRef),
      ).subscribe(res => this.newResponseUrls.update(urls => [...urls, res]));
    }
  }

  /**
   * Responses already listed on the page were edited, not created.
   */
  private visible(url: string) {
    if (this.query.page()?.content.some(ref => ref.url === url)) return true;
    for (const refs of this.threadStore.cache().values()) {
      if (refs.some(ref => ref.url === url)) return true;
    }
    return false;
  }

  /**
   * Whether the current sub page lists this response.
   */
  private showsResponse(ref: Ref) {
    switch (this.store.view.current()) {
      case 'ref/comments': return hasTag('plugin/comment', ref);
      case 'ref/thread': return hasTag('plugin/thread', ref);
      case 'ref/errors': return hasTag('+plugin/log', ref);
      case 'ref/responses': return !hasTag('internal', ref);
      default: return hasTag('plugin/comment', ref) || hasTag('plugin/thread', ref) || !hasTag('internal', ref);
    }
  }

  private watch(ref: Ref) {
    // 404 placeholders have no origin
    const watchKey = ref.origin === undefined ? '' : ref.origin + ':' + ref.url;
    if (this.config.websockets && this.watchKey !== watchKey) {
      this.watchKey = watchKey;
      this.watchSelf?.unsubscribe();
      if (!watchKey) return;
      this.watchSelf = this.stomp.watchRef(ref.url, ref.origin).pipe(
        takeUntilDestroyed(this.destroyRef),
      ).subscribe(ud => {
        const current = this.store.view.ref();
        if (!current) return;
        // Merge updates with existing Ref because updates do not contain any private tags
        const tags = uniq([...current.tags || [], ...ud.tags || []])
          .filter(t => privateTag(t) || ud.tags?.includes(t));
        const merged: Ref = {
          // Empty fields are left out of updates, so a missing field has been cleared
          ...omit(current, 'title', 'comment', 'sources', 'alternateUrls'),
          ...ud,
          tags,
          metadata: {
            ...ud.metadata,
            plugins: {
              ...pickBy(current.metadata?.plugins, (v, k) => tags.includes(k)),
              ...ud.metadata?.plugins || {},
            },
            ...(current.metadata?.remotePlugins || ud.metadata?.remotePlugins) ? {
              remotePlugins: {
                ...pickBy(current.metadata?.remotePlugins, (v, k) => tags.includes(k)),
                ...ud.metadata?.remotePlugins || {},
              },
            } : {},
          },
          plugins: {
            ...pickBy(current.plugins, (v, k) => tags.includes(k)),
            ...ud.plugins || {},
          },
          // Don't allow editing an update Ref, as we cannot tell when a private
          // tag was deleted
          // TODO: mark Ref as modified remotely to warn user before editing
          modified: current.modified,
          modifiedString: current.modifiedString,
        };
        this.store.view.setRef(merged, this.store.view.top());
        this.store.eventBus.refresh(this.store.view.ref());
      });
    }
  }

  readonly isWiki = computed(() => !this.admin.isWikiExternal() && isWiki(this.store.view.url(), this.admin.getWikiPrefix()));

  markRead(ref: Ref) {
    return markRead(this.admin, this.ts, ref);
  }
}
