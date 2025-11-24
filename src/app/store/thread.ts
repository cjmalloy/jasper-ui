import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { action, makeAutoObservable, observable, runInAction } from 'mobx';
import { catchError, Subscription, throwError } from 'rxjs';
import { Page } from '../model/page';
import { Ref, RefPageArgs, RefSort } from '../model/ref';
import { RefService } from '../service/api/ref.service';
import { getArgs, UrlFilter } from '../util/query';

@Injectable({
  providedIn: 'root'
})
export class ThreadStore {

  empty = false;
  newComments = false;
  defaultBatchSize = 500;
  args?: RefPageArgs = {} as any;
  pages: Page<Ref>[] = [];
  error?: HttpErrorResponse = {} as any;
  cache = new Map<string | undefined, Ref[]>();
  latest: Ref[] = [];

  private loading?: Subscription;

  constructor(
    private refs: RefService,
  ) {
    makeAutoObservable(this, {
      args: observable.struct,
      cache: observable.ref,
      pages: observable.ref,
      latest: observable.ref,
      clear: action,
      setArgs: action,
      add: action,
      addPage: action,
      loadMore: action,
    });
    this.clear(); // Initial observables may not be null for MobX
  }

  clear() {
    this.error = undefined;
    this.args = {
      size: this.defaultBatchSize,
      page: 0,
    };
    this.pages = [];
    this.cache.clear();
    this.loading?.unsubscribe();
  }

  setArgs(top?: string, sort?: RefSort | RefSort[], filters?: UrlFilter[], search?: string) {
    this.clear();
    this.args = {
      ...getArgs('plugin/comment', sort, filters, search),
      responses: top,
      size: this.defaultBatchSize,
      page: 0,
    };
    this.loadMore();
  }

  add(ref: Ref) {
    if (this.cache.has(ref.sources?.[0])) {
      const arr = this.cache.get(ref.sources?.[0])!;
      if (!arr.find(x => x.url === ref.url)) arr.push(ref);
    } else {
      this.cache.set(ref.sources?.[0], [ref]);
    }
  }

  addPage(page: Page<Ref>) {
    this.empty = !this.latest.length && !page.content.length;
    if (!page.content.length) return;
    this.pages.push(page);
    for (const r of page.content) this.add(r);
    this.latest = page.content;
  }

  loadMore() {
    this.args = {
      ...this.args,
      page: this.pages.length,
    };
    this.loading = this.refs.page(this.args).pipe(
      catchError((err: HttpErrorResponse) => {
        runInAction(() => this.error = err);
        return throwError(() => err);
      }),
    ).subscribe(page => runInAction(() => this.addPage(page)));
  }

  loadAdHoc(source?: string) {
    const args = {
      ...this.args,
      responses: source,
    };
    const existing = this.cache.get(source)?.length;
    if (existing) {
      args.size = 20;
      args.page = Math.floor(existing / 20);
    }
    this.loading = this.refs.page(args).pipe(
      catchError((err: HttpErrorResponse) => {
        runInAction(() => this.error = err);
        return throwError(() => err);
      }),
    ).subscribe(page => runInAction(() => {
      if (source) {
        for (const ref of page.content) this.add(ref);
        runInAction(() => this.latest = page.content);
      }
    }));
  }

  get hasMore() {
    if (!this.pages.length) return false;
    return this.pages.length < this.pages[0].page.totalPages;
  }
}
