import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { autorun, IReactionDisposer, runInAction } from 'mobx';
import { catchError, map, of, switchMap } from 'rxjs';
import { tap } from 'rxjs/operators';
import { isWiki } from '../../plugin/wiki';
import { AdminService } from '../../service/admin.service';
import { RefService } from '../../service/api/ref.service';
import { ConfigService } from '../../service/config.service';
import { Store } from '../../store/store';
import { printError } from '../../util/http';
import { hasTag } from '../../util/tag';

@Component({
  selector: 'app-ref-page',
  templateUrl: './ref.component.html',
  styleUrls: ['./ref.component.scss'],
})
export class RefPage implements OnInit, OnDestroy {

  private disposers: IReactionDisposer[] = [];
  error?: HttpErrorResponse;
  printError = printError;

  constructor(
    public config: ConfigService,
    public admin: AdminService,
    public store: Store,
    private refs: RefService,
  ) {
    store.view.clear();
  }

  get refWarning() {
    return (this.store.view.ref?.sources?.length || 0) > 0 && this.store.view.published && !this.store.view.ref!.published!.isSame(this.store.view.published);
  }

  get comments() {
    if (!this.admin.status.plugins.comment) return 0;
    return this.store.view.ref?.metadata?.plugins?.['plugin/comment'] || 0;
  }

  get threads() {
    if (!this.admin.status.plugins.thread) return 0;
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

  ngOnInit(): void {
    this.disposers.push(autorun(() => {
      const url = this.store.view.url;
      const origin = this.store.view.origin !== undefined ? this.store.view.origin : this.store.account.origin;
      if (!url) return;
      this.refs.count({ url }).pipe(
        catchError(err => {
          this.error = err;
          return of(0);
        }),
        tap(count => runInAction(() => this.store.view.versions = count)),
        switchMap(count => count > 0 ? this.refs.get(url, origin) : of({url, origin})),
        catchError(err => this.refs.page({ url, size: 1 }).pipe(map(page => page.content[0] || {url, origin}))),
        tap(ref => runInAction(() => this.store.view.ref = ref)),
      ).subscribe();
    }));
  }

  ngOnDestroy() {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
  }

  isWiki(url: string) {
    return !this.admin.isWikiExternal() && isWiki(url, this.admin.getWikiPrefix());
  }
}
