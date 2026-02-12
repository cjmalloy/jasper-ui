import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { catchError, Subscription, throwError } from 'rxjs';
import { Page } from '../model/page';
import { Ref, RefPageArgs, RefSort } from '../model/ref';
import { RefService } from '../service/api/ref.service';
import { getArgs, UrlFilter } from '../util/query';

@Injectable({
  providedIn: 'root'
})
export class ThreadStore {
  private refs = inject(RefService);


  defaultBatchSize = 500;

  private _args = signal<RefPageArgs | undefined>(undefined);
  private _pages = signal<Page<Ref>[]>([]);
  private _error = signal<HttpErrorResponse | undefined>(undefined);
  private _cache = signal(new Map<string | undefined, Ref[]>());
  private _latest = signal<Ref[]>([]);

  private loading?: Subscription;

  get args() { return this._args(); }
  set args(value: RefPageArgs | undefined) { this._args.set(value); }

  get pages() { return this._pages(); }
  set pages(value: Page<Ref>[]) { this._pages.set(value); }

  get error() { return this._error(); }
  set error(value: HttpErrorResponse | undefined) { this._error.set(value); }

  get cache() { return this._cache(); }
  set cache(value: Map<string | undefined, Ref[]>) { this._cache.set(value); }

  get latest() { return this._latest(); }
  set latest(value: Ref[]) { this._latest.set(value); }

  clear() {
    this._error.set(undefined);
    this._args.set({
      size: this.defaultBatchSize,
      page: 0,
    });
    this._pages.set([]);
    this._cache.set(new Map());
    this.loading?.unsubscribe();
  }

  setArgs(top?: string, sort?: RefSort | RefSort[], filters?: UrlFilter[], search?: string) {
    this.clear();
    this._args.set({
      ...getArgs('plugin/comment', sort, filters, search),
      responses: top,
      size: this.defaultBatchSize,
      page: 0,
    });
    this.loadMore();
  }

  add(ref: Ref) {
    const currentCache = this._cache();
    const newCache = new Map(currentCache);
    if (newCache.has(ref.sources?.[0])) {
      const arr = newCache.get(ref.sources?.[0])!;
      if (!arr.find(x => x.url === ref.url)) arr.push(ref);
    } else {
      newCache.set(ref.sources?.[0], [ref]);
    }
    this._cache.set(newCache);
  }

  addPage(page: Page<Ref>) {
    if (!page.content.length) return;
    this._pages.update(pages => [...pages, page]);
    for (const r of page.content) this.add(r);
    this._latest.set(page.content);
  }

  loadMore() {
    this._args.update(args => ({
      ...args,
      page: this._pages().length,
    }));
    this.loading = this.refs.page(this._args()!).pipe(
      catchError((err: HttpErrorResponse) => {
        this._error.set(err);
        return throwError(() => err);
      }),
    ).subscribe(page => this.addPage(page));
  }

  loadAdHoc(source?: string) {
    const args = {
      ...this._args(),
      responses: source,
    };
    const existing = this._cache().get(source)?.length;
    if (existing) {
      args.size = 20;
      args.page = Math.floor(existing / 20);
    }
    this.loading = this.refs.page(args).pipe(
      catchError((err: HttpErrorResponse) => {
        this._error.set(err);
        return throwError(() => err);
      }),
    ).subscribe(page => {
      if (source) {
        for (const ref of page.content) this.add(ref);
        this._latest.set(page.content);
      }
    });
  }

  get hasMore() {
    const pages = this._pages();
    if (!pages.length) return false;
    return pages.length < pages[0].page.totalPages;
  }
}
