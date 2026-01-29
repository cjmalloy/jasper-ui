import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { pickBy, uniq } from 'lodash-es';
import { DateTime } from 'luxon';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import { MobxAngularModule } from 'mobx-angular';
import { catchError, filter, map, of, Subject, Subscription, switchMap, takeUntil, throwError } from 'rxjs';
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
import { memo, MemoCache } from '../../util/memo';
import { hasTag, privateTag, top } from '../../util/tag';

@Component({
  selector: 'app-ref-page',
  templateUrl: './ref.component.html',
  styleUrls: ['./ref.component.scss'],
  imports: [
    RefComponent,
    MobxAngularModule,
    TabsComponent,
    RouterLink,
    RouterLinkActive,
    SidebarComponent,
    RouterOutlet,
    LoadingComponent,
  ],
})
export class RefPage implements OnInit, OnDestroy, HasChanges {
  private disposers: IReactionDisposer[] = [];
  private destroy$ = new Subject<void>();

  @ViewChild(RefComponent)
  ref?: RefComponent;

  newResponses = 0;
  private url = '';
  private watchSelf?: Subscription;
  private watchUrl = '';
  private watchResponses?: Subscription;
  private seen = new Set<string>();

  constructor(
    public config: ConfigService,
    public admin: AdminService,
    public store: Store,
    private refs: RefService,
    private ts: TaggingService,
    private router: Router,
    private stomp: StompService,
  ) { }

  saveChanges() {
    return !this.ref || this.ref.saveChanges();
  }

  ngOnInit(): void {
    this.url = this.store.view.url;
    if (this.url) this.reload(this.url);
    this.disposers.push(autorun(() => {
      const url = this.store.view.url;
      if (!url) return;
      if (url === this.url) return;
      this.url = url;
      this.reload(url);
    }));
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
    this.store.view.clearRef();
  }

  @memo
  get refWarning() {
    const warn = this.sources > 0 && this.store.view.published && +this.store.view.ref!.published! !== +DateTime.fromISO(this.store.view.published);
    if (this.store.view.published) this.router.navigate([], { queryParams: { published: null }, queryParamsHandling: 'merge', replaceUrl: true });
    return warn;
  }

  @memo
  get expandedOnLoad() {
    return this.store.view.current === 'ref/thread' ||
      this.store.local.isRefToggled(this.store.view.url, this.store.view.current === 'ref/summary' || this.fullscreen?.onload);
  }

  @memo
  get fullscreen() {
    if (!this.admin.getPlugin('plugin/fullscreen')) return undefined;
    return this.store.view.ref?.plugins?.['plugin/fullscreen'];
  }

  @memo
  get comment() {
    return this.admin.getPlugin('plugin/comment') && hasTag('plugin/comment', this.store.view.ref);
  }

  @memo
  get comments() {
    if (!this.admin.getPlugin('plugin/comment')) return 0;
    return this.store.view.ref?.metadata?.plugins?.['plugin/comment'] || 0;
  }

  @memo
  get thread() {
    return this.admin.getPlugin('plugin/thread') && (hasTag('plugin/thread', this.store.view.ref) || this.store.view.current === 'ref/thread');
  }

  @memo
  get threads() {
    if (!this.admin.getPlugin('plugin/thread')) return 0;
    return hasTag('plugin/thread', this.store.view.ref) || this.store.view.ref?.metadata?.plugins?.['plugin/thread'];
  }

  @memo
  get logs() {
    if (!this.admin.getPlugin('+plugin/log')) return 0;
    return this.store.view.ref?.metadata?.plugins?.['+plugin/log'];
  }

  @memo
  get responses() {
    return this.store.view.ref?.metadata?.responses || 0;
  }

  @memo
  get sources() {
    const sources = (this.store.view.ref?.sources || []).filter( s => s != this.store.view.url);
    return sources.length || 0;
  }

  @memo
  get alts() {
    return this.store.view.ref?.alternateUrls?.length || 0;
  }

  reload(url?: string) {
    url ||= this.url || '';
    if (!url) {
      this.store.view.clear();
      return;
    }
    this.newResponses = 0;
    this.refs.count({ url, obsolete: true }).subscribe(count => runInAction(() =>
      this.store.view.versions = count));
    const fetchTop = (ref: Ref) => hasTag('plugin/thread', ref) || hasTag('plugin/comment', ref);
    (url === this.store.view.ref?.url
        ? of(this.store.view.ref)
        : this.refs.getCurrent(url)
    ).pipe(
      catchError(err => err.status === 404 ? of(undefined) : throwError(() => err)),
      map(ref => ref || { url }),
      tap(ref => this.markRead(ref)),
      switchMap(ref => !fetchTop(ref) ? of([ref, undefined])
        : top(ref) === url ? of([ref, ref])
        : top(ref) === this.store.view.top?.url ? of([ref, this.store.view.top])
        : this.refs.getCurrent(top(ref)).pipe(
          map(top => [ref, top]),
          catchError(err => err.status === 404 ? of([ref, undefined]) : throwError(() => err)),
        )),
      tap(([ref, top]) => runInAction(() => this.store.view.setRef(ref, top))),
      takeUntil(this.destroy$),
    ).subscribe(() => MemoCache.clear(this));
    if (this.config.websockets && this.watchUrl !== url) {
      this.watchUrl = url;
      this.watchSelf?.unsubscribe();
      this.watchSelf = this.stomp.watchRef(url).pipe(
        takeUntil(this.destroy$),
      ).subscribe(ud => {
        MemoCache.clear(this);
        // Merge updates with existing Ref because updates do not contain any private tags
        const tags = uniq([...this.store.view.ref!.tags || [], ...ud.tags || []])
          .filter(t => privateTag(t) || ud.tags?.includes(t));
        const merged: Ref = {
          ...ud,
          tags,
          metadata: {
            ...ud.metadata,
            plugins: {
              ...pickBy(this.store.view.ref?.metadata?.plugins, (v, k) => tags.includes(k)),
              ...ud.metadata?.plugins || {},
            }
          },
          plugins: {
            ...pickBy(this.store.view.ref!.plugins, (v, k) => tags.includes(k)),
            ...ud.plugins || {},
          },
          // Don't allow editing an update Ref, as we cannot tell when a private
          // tag was deleted
          // TODO: mark Ref as modified remotely to warn user before editing
          modified: this.store.view.ref?.modified,
          modifiedString: this.store.view.ref?.modifiedString,
        };
        runInAction(() => Object.assign(this.store.view.ref!, merged));
        this.store.eventBus.refresh(merged);
        this.store.eventBus.reset();
      });
      this.watchResponses?.unsubscribe();
      this.watchResponses = this.stomp.watchResponse(url).pipe(
        filter(url => url != this.store.view.url),
        filter(url => !url.startsWith('tag:')),
        filter(url => !this.seen.has(url)),
        takeUntil(this.destroy$),
      ).subscribe(url => {
        this.seen.add(url);
        this.newResponses++;
      });
    }
  }

  @memo
  isWiki(url: string) {
    return !this.admin.isWikiExternal() && isWiki(url, this.admin.getWikiPrefix());
  }

  markRead(ref: Ref) {
    if (!this.admin.getPlugin('plugin/user/read')) return;
    if (ref.metadata?.userUrls?.includes('plugin/user/read')) return;
    this.ts.createResponse('plugin/user/read', ref.url).subscribe();
  }
}
