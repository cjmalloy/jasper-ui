import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { action, makeAutoObservable, observableRef, observableStruct, runInAction } from 'mobx';
import { catchError, EMPTY, finalize, Subscription } from 'rxjs';
import { Page } from '../model/page';
import { Ref, RefPageArgs, RefSort } from '../model/ref';
import { RefService } from '../service/api/ref.service';
import { getArgs, UrlFilter } from '../util/query';

@Injectable({
  providedIn: 'root'
})
export class ThreadStore {

  defaultBatchSize = 500;
  args?: RefPageArgs = {} as any;
  pages: Page<Ref>[] = [];
  error?: HttpErrorResponse = {} as any;
  cache = new Map<string, Ref[]>();
  latest: Ref[] = [];
  loaded = false;

  private loading?: Subscription;
  private loadingPage = false;
  private loadingSources = new Map<string, Subscription>();

  constructor(
    private refs: RefService,
  ) {
    makeAutoObservable(this, {
      args: observableStruct,
      cache: observableRef,
      pages: observableRef,
      latest: observableRef,
      clear: action,
      setArgs: action,
      add: action,
      addPage: action,
      loadMore: action,
    });
    this.clear(); // Initial observables may not be null for MobX
  }

  clear() {
    this.loading?.unsubscribe();
    this.loading = undefined;
    for (const loading of this.loadingSources.values()) loading.unsubscribe();
    this.loadingSources.clear();
    this.loadingPage = false;
    this.error = undefined;
    this.args = {
      size: this.defaultBatchSize,
      page: 0,
    };
    this.pages = [];
    this.cache = new Map();
    this.latest = [];
    this.loaded = false;
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
    const cache = new Map(this.cache);
    if (this.addToCache(cache, ref)) this.cache = cache;
  }

  addPage(page: Page<Ref>) {
    const cache = new Map(this.cache);
    for (const ref of page.content) this.addToCache(cache, ref);
    this.pages = [...this.pages, page];
    this.cache = cache;
    this.latest = page.content;
    this.loaded = true;
  }

  loadMore() {
    if (this.loadingPage || (this.loaded && !this.hasMore)) return;
    this.loadingPage = true;
    this.error = undefined;
    const args = {
      ...this.args,
      page: this.pages.length,
    };
    this.loading = this.refs.page(args).pipe(
      catchError((err: HttpErrorResponse) => {
        runInAction(() => {
          this.error = err;
          this.loaded = true;
        });
        return EMPTY;
      }),
      finalize(() => runInAction(() => this.loadingPage = false)),
    ).subscribe(page => runInAction(() => this.addPage(page)));
  }

  loadAdHoc(source?: string) {
    if (!source || this.loadingSources.has(source)) return;
    this.error = undefined;
    const existing = this.cache.get(source)?.length || 0;
    const args = {
      ...this.args,
      responses: source,
      size: existing ? 20 : this.defaultBatchSize,
      page: existing ? Math.floor(existing / 20) : 0,
    };
    const loading = new Subscription();
    this.loadingSources.set(source, loading);
    loading.add(this.refs.page(args).pipe(
      catchError((err: HttpErrorResponse) => {
        runInAction(() => this.error = err);
        return EMPTY;
      }),
      finalize(() => runInAction(() => this.loadingSources.delete(source))),
    ).subscribe(page => runInAction(() => {
      const cache = new Map(this.cache);
      for (const ref of page.content) this.addToCache(cache, ref);
      this.cache = cache;
      this.latest = page.content;
    })));
  }

  private addToCache(cache: Map<string, Ref[]>, ref: Ref) {
    const source = ref.sources?.[0];
    if (!source) return false;
    const comments = cache.get(source) || [];
    if (comments.some(comment => comment.url === ref.url && comment.origin === ref.origin)) return false;
    cache.set(source, [...comments, ref]);
    return true;
  }

  get hasMore() {
    if (!this.pages.length) return false;
    return this.pages.length < this.pages[0].page.totalPages;
  }
}
