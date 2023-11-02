import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { action, computed, makeObservable, observable, runInAction } from 'mobx';
import { catchError, throwError } from 'rxjs';
import { Page } from '../model/page';
import { Ref, RefPageArgs, RefSort } from '../model/ref';
import { RefService } from '../service/api/ref.service';
import { getArgs, UrlFilter } from '../util/query';

@Injectable({
  providedIn: 'root'
})
export class ThreadStore {

  @observable
  defaultBatchSize = 500;
  @observable.struct
  args?: RefPageArgs = {} as any;
  @observable.ref
  pages: Page<Ref>[] = [];
  @observable
  error?: HttpErrorResponse = {} as any;
  @observable.ref
  cache = new Map<string | undefined, Ref[]>();
  @observable.ref
  latest: Ref[] = [];

  constructor(
    private refs: RefService,
  ) {
    makeObservable(this);
    this.clear(); // Initial observables may not be null for MobX
  }

  @action
  clear() {
    this.error = undefined;
    this.args = {
      size: this.defaultBatchSize,
      page: 0,
    };
    this.pages = [];
    this.cache.clear();
  }

  @action
  setArgs(top: Ref, sort?: RefSort | RefSort[], filters?: UrlFilter[], search?: string) {
    this.clear();
    this.args = {
      ...getArgs('plugin/comment', sort, filters, search),
      responses: top.url,
      size: this.defaultBatchSize,
      page: 0,
    };
    this.loadMore();
  }

  @action
  add(ref: Ref) {
    if (this.cache.has(ref.sources?.[0])) {
      const arr = this.cache.get(ref.sources?.[0])!;
      if (!arr.find(x => x.url === ref.url)) arr.push(ref);
    } else {
      this.cache.set(ref.sources?.[0], [ref]);
    }
  }

  @action
  addPage(page: Page<Ref>) {
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
    this.refs.page(this.args).pipe(
      catchError((err: HttpErrorResponse) => {
        runInAction(() => this.error = err);
        return throwError(() => err);
      }),
    ).subscribe(page => runInAction(() => this.addPage(page)));
  }

  loadAdHoc(source?: string) {
    this.args = {
      ...this.args,
      responses: source,
    };
    const existing = this.cache.get(source)?.length;
    if (existing) {
      this.args = {
        ...this.args,
        size: existing || 20,
        page: 1,
      };
    }
    this.refs.page(this.args).pipe(
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

  @computed
  get hasMore() {
    if (!this.pages.length) return false;
    return this.pages.length < this.pages[0].totalPages;
  }
}
