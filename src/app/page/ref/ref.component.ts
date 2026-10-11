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
import { pickBy, uniq } from 'lodash-es';
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
import { Store } from '../../store/store';
import { markRead } from '../../util/response';
import { hasTag, localPluginResponses, pluginResponses, privateTag, top } from '../../util/tag';

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


  private readonly injector = inject(Injector);

  readonly newResponses = signal<number>(0);
  private destroyRef = inject(DestroyRef);

  readonly ref = viewChild<RefComponent>('ref');
  private url = '';
  private watchSelf?: Subscription;
  private watchUrl = '';
  private watchResponses?: Subscription;
  private seen = new Set<string>();

  saveChanges() {
    const ref = this.ref();
    return !ref || ref.saveChanges();
  }

  private readonly initialize = afterNextRender(() => {
    this.url = this.store.view.url();
    if (this.url) this.reload(this.url);
    effect(() => {
      const url = this.store.view.url();
      if (!url) return;
      if (url === this.url) return;
      this.url = url;
      this.reload(url);
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

  reload(url?: string) {
    url ||= this.url || '';
    if (!url) {
      this.store.view.clear();
      return;
    }
    this.newResponses.set(0);
    this.refs.count({ url, obsolete: true }).subscribe(count => this.store.view.versions.set(count));
    const fetchTop = (ref: Ref) => hasTag('plugin/thread', ref) || hasTag('plugin/comment', ref);
    (url === this.store.view.ref()?.url
        ? of(this.store.view.ref())
        : this.refs.getCurrent(url)
    ).pipe(
      catchError(err => err.status === 404 ? of(undefined) : throwError(() => err)),
      map(ref => ref || { url }),
      tap(ref => this.markRead(ref)),
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
    if (this.config.websockets && this.watchUrl !== url) {
      this.watchUrl = url;
      this.watchSelf?.unsubscribe();
      this.watchSelf = this.stomp.watchRef(url).pipe(
        takeUntilDestroyed(this.destroyRef),
      ).subscribe(ud => {
        const current = this.store.view.ref();
        if (!current) return;
        // Merge updates with existing Ref because updates do not contain any private tags
        const tags = uniq([...current.tags || [], ...ud.tags || []])
          .filter(t => privateTag(t) || ud.tags?.includes(t));
        const merged: Ref = {
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
        this.store.view.setRef({ ...this.store.view.ref()!, ...merged }, this.store.view.top());
        this.store.eventBus.refresh(this.store.view.ref());
      });
      this.watchResponses?.unsubscribe();
      this.watchResponses = this.stomp.watchResponse(url).pipe(
        filter(url => url != this.store.view.url()),
        filter(url => !url.startsWith('tag:')),
        filter(url => !this.seen.has(url)),
        takeUntilDestroyed(this.destroyRef),
      ).subscribe(url => {
        this.seen.add(url);
        this.newResponses.update(n => n + 1);
      });
    }
  }

  readonly isWiki = computed(() => !this.admin.isWikiExternal() && isWiki(this.store.view.url(), this.admin.getWikiPrefix()));

  markRead(ref: Ref) {
    markRead(this.admin, this.ts, ref);
  }
}
