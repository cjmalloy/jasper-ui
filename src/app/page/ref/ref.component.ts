import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import { map, of, Subject, Subscription, switchMap, takeUntil } from 'rxjs';
import { tap } from 'rxjs/operators';
import { isWiki } from '../../mods/wiki';
import { AdminService } from '../../service/admin.service';
import { RefService } from '../../service/api/ref.service';
import { StompService } from '../../service/api/stomp.service';
import { ConfigService } from '../../service/config.service';
import { Store } from '../../store/store';
import { View } from '../../store/view';
import { memo, MemoCache } from '../../util/memo';
import { hasTag, top } from '../../util/tag';

@Component({
  selector: 'app-ref-page',
  templateUrl: './ref.component.html',
  styleUrls: ['./ref.component.scss'],
})
export class RefPage implements OnInit, OnDestroy {
  private disposers: IReactionDisposer[] = [];
  private destroy$ = new Subject<void>();

  newResponses = 0;
  private watch?: Subscription;
  private currentView?: View;

  constructor(
    public config: ConfigService,
    public admin: AdminService,
    public store: Store,
    private refs: RefService,
    private router: Router,
    private stomp: StompService,
  ) {
    store.view.clear();
    this.disposers.push(autorun(() => {
      MemoCache.clear(this);
      if (store.view.ref && this.config.websockets) {
        this.watch?.unsubscribe();
        this.watch = this.stomp.watchResponse(store.view.ref.url).pipe(
          takeUntil(this.destroy$),
        ).subscribe(url => {
          this.newResponses++;
        });
      }
    }));
    this.disposers.push(autorun(() => {
      MemoCache.clear(this);
      this.currentView = this.store.view.current;
    }));
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
    return this.store.view.current === 'ref/thread'
      || this.store.local.isRefToggled(this.store.view.url,
        !!this.store.view.ref?.comment && (this.store.view.current === 'ref/summary' || this.store.view.current === 'ref/comments')
        || this.store.view.ref && (!hasTag('plugin/fullscreen', this.store.view.ref)
        || this.store.view.ref?.plugins?.['plugin/fullscreen']?.onload));
  }

  @memo
  get comments() {
    if (!this.admin.getPlugin('plugin/comment')) return 0;
    return this.store.view.ref?.metadata?.plugins?.['plugin/comment'] || 0;
  }

  @memo
  get threads() {
    if (!this.admin.getPlugin('plugin/thread')) return 0;
    return hasTag('plugin/thread', this.store.view.ref) || this.store.view.ref?.metadata?.plugins?.['plugin/thread'];
  }

  @memo
  get responses() {
    return this.store.view.ref?.metadata?.responses || 0;
  }

  @memo
  get sources() {
    return this.store.view.ref?.sources?.length || 0;
  }

  @memo
  get alts() {
    return this.store.view.ref?.alternateUrls?.length || 0;
  }

  reload(url?: string) {
    url ||= this.store.view.ref?.url;
    if (!url) return;
    this.refs.page({ url, obsolete: true, size: 1 }).pipe(
      tap(page => runInAction(() => {
        this.store.view.setRef(page.content[0] || { url });
        this.store.view.versions = page.totalElements;
      })),
      map(page => top(page.content[0])),
      switchMap(top => !top ? of(null) : this.refs.page({ url: top, size: 1})),
      tap(page => runInAction(() => {
        this.store.view.top = page?.content[0];
      })),
    ).subscribe();
  }

  @memo
  isWiki(url: string) {
    return !this.admin.isWikiExternal() && isWiki(url, this.admin.getWikiPrefix());
  }
}
