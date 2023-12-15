import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import { Subject, Subscription, takeUntil } from 'rxjs';
import { tap } from 'rxjs/operators';
import { isWiki } from '../../mods/wiki';
import { AdminService } from '../../service/admin.service';
import { RefService } from '../../service/api/ref.service';
import { StompService } from '../../service/api/stomp.service';
import { ConfigService } from '../../service/config.service';
import { Store } from '../../store/store';
import { printError } from '../../util/http';
import { memo, MemoCache } from '../../util/memo';
import { hasTag } from '../../util/tag';

@Component({
  selector: 'app-ref-page',
  templateUrl: './ref.component.html',
  styleUrls: ['./ref.component.scss'],
})
export class RefPage implements OnInit, OnDestroy {
  private disposers: IReactionDisposer[] = [];
  private destroy$ = new Subject<void>();

  expandedOnload = false;
  newResponses = 0;
  private watch?: Subscription;

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
      this.expandedOnload = store.view.ref && (!hasTag('plugin/fullscreen', store.view.ref) || store.view.ref?.plugins?.['plugin/fullscreen']?.onload);
      if (store.view.ref && this.config.websockets) {
        this.watch?.unsubscribe();
        this.watch = this.stomp.watchResponse(store.view.ref.url).pipe(
          takeUntil(this.destroy$),
        ).subscribe(url => {
          this.newResponses++;
        });
      }
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
  }

  @memo
  get refWarning() {
    const warn = (this.store.view.ref?.sources?.length || 0) > 0 && this.store.view.published && !this.store.view.ref!.published!.isSame(this.store.view.published);
    if (this.store.view.published) this.router.navigate([], { queryParams: { published: null }, queryParamsHandling: 'merge', replaceUrl: true });
    return warn;
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
    url ||= this.store.view.ref?.url;
    if (!url) return;
    this.refs.page({ url, obsolete: true, size: 1 }).pipe(
      tap(page => runInAction(() => {
        this.store.view.setRef(page.content[0] || { url });
        this.store.view.versions = page.totalElements;
      })),
    ).subscribe();

  }

  @memo
  isWiki(url: string) {
    return !this.admin.isWikiExternal() && isWiki(url, this.admin.getWikiPrefix());
  }
}
