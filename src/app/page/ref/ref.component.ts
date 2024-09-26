import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { pickBy, uniq } from 'lodash-es';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import { catchError, map, of, Subject, Subscription, switchMap, takeUntil, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Ref } from '../../model/ref';
import { isWiki } from '../../mods/wiki';
import { AdminService } from '../../service/admin.service';
import { RefService } from '../../service/api/ref.service';
import { StompService } from '../../service/api/stomp.service';
import { ConfigService } from '../../service/config.service';
import { Store } from '../../store/store';
import { memo, MemoCache } from '../../util/memo';
import { hasTag, privateTag, top } from '../../util/tag';

@Component({
  selector: 'app-ref-page',
  templateUrl: './ref.component.html',
  styleUrls: ['./ref.component.scss'],
})
export class RefPage implements OnInit, OnDestroy {
  private disposers: IReactionDisposer[] = [];
  private destroy$ = new Subject<void>();

  newResponses = 0;
  private watchSelf?: Subscription;
  private watchResponses?: Subscription;

  constructor(
    public config: ConfigService,
    public admin: AdminService,
    public store: Store,
    private refs: RefService,
    private router: Router,
    private stomp: StompService,
  ) {
    store.view.clearRef();
  }

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
      const url = this.store.view.url;
      if (!url) return;
      this.reload(url);
    }));
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
    this.store.view.setRef(undefined);
  }

  @memo
  get refWarning() {
    const warn = (this.store.view.ref?.sources?.length || 0) > 0 && this.store.view.published && !this.store.view.ref!.published!.isSame(this.store.view.published);
    if (this.store.view.published) this.router.navigate([], { queryParams: { published: null }, queryParamsHandling: 'merge', replaceUrl: true });
    return warn;
  }

  @memo
  get expandedOnLoad() {
    return this.store.view.current === 'ref/thread' ||
      this.store.local.isRefToggled(this.store.view.url, this.store.view.current === 'ref/summary' || this.fullscreen?.onload);
  }

  get fullscreen() {
    if (!this.admin.getPlugin('plugin/fullscreen')) return undefined;
    return this.store.view.ref?.plugins?.['plugin/fullscreen'];
  }

  get comments() {
    if (!this.admin.getPlugin('plugin/comment')) return 0;
    return this.store.view.ref?.metadata?.plugins?.['plugin/comment'] || 0;
  }

  get threads() {
    if (!this.admin.getPlugin('plugin/thread')) return 0;
    return hasTag('plugin/thread', this.store.view.ref) || this.store.view.ref?.metadata?.plugins?.['plugin/thread'];
  }

  get logs() {
    if (!this.admin.getPlugin('+plugin/log')) return 0;
    return this.store.view.ref?.metadata?.plugins?.['+plugin/log'];
  }

  get responses() {
    return this.store.view.ref?.metadata?.responses || 0;
  }

  get sources() {
    return this.store.view.ref?.sources?.length || 0;
  }

  get alts() {
    return this.store.view.ref?.alternateUrls?.length || 0;
  }

  reload(url?: string) {
    MemoCache.clear(this);
    url ||= this.store.view.ref?.url;
    if (!url) return;
    this.refs.count({ url, obsolete: true }).subscribe(count => this.store.view.versions = count);
    this.refs.getCurrent(url).pipe(
      catchError(err => err.status === 404 ? of(undefined) : throwError(() => err)),
      tap(ref => this.store.view.setRef(ref || { url })),
      map(ref => top(ref)),
      switchMap(top => !top ? of(undefined)
        : top === url ? of(this.store.view.ref)
        : this.refs.getCurrent(top)),
      tap(ref => runInAction(() => this.store.view.top = ref!)),
    ).subscribe();
    if (this.config.websockets) {
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
        this.store.eventBus.refresh(merged);
        this.store.eventBus.reset();
      });
      this.watchResponses?.unsubscribe();
      this.watchResponses = this.stomp.watchResponse(url).pipe(
        takeUntil(this.destroy$),
      ).subscribe(url => this.newResponses++);
    }
  }

  @memo
  isWiki(url: string) {
    return !this.admin.isWikiExternal() && isWiki(url, this.admin.getWikiPrefix());
  }
}
