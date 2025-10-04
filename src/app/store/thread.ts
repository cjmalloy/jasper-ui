import { HttpErrorResponse } from '@angular/common/http';
import { computed, Injectable, signal } from '@angular/core';
import { catchError, Subscription, throwError } from 'rxjs';
import { Page } from '../model/page';
import { Ref, RefPageArgs, RefSort } from '../model/ref';
import { RefService } from '../service/api/ref.service';
import { getArgs, UrlFilter } from '../util/query';

@Injectable({
  providedIn: 'root'
})
export class ThreadStore {

  defaultBatchSize = 500;
  private _args = signal<RefPageArgs>({ size: this.defaultBatchSize, page: 0 });
  private _pages = signal<Page<Ref>[]>([]);
  private _error = signal<HttpErrorResponse | undefined>(undefined);
  private _cache = signal<Map<string | undefined, Ref[]>>(new Map());
  private _latest = signal<Ref[]>([]);

  // Backwards compatible getters/setters
  get args() { return this._args(); }
  set args(value: RefPageArgs) { this._args.set(value); }
  get pages() { return this._pages(); }
  set pages(value: Page<Ref>[]) { this._pages.set(value); }
  get error() { return this._error(); }
  set error(value: HttpErrorResponse | undefined) { this._error.set(value); }
  get cache() { return this._cache(); }
  set cache(value: Map<string | undefined, Ref[]>) { this._cache.set(value); }
  get latest() { return this._latest(); }
  set latest(value: Ref[]) { this._latest.set(value); }

  // New signal-based API
  args$ = computed(() => this._args());
  pages$ = computed(() => this._pages());
  error$ = computed(() => this._error());
  cache$ = computed(() => this._cache());
  latest$ = computed(() => this._latest());

  private loading?: Subscription;

  constructor(
    private refs: RefService,
  ) {
    this.clear();
  }

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
    const cache = this._cache();
    if (cache.has(ref.sources?.[0])) {
      const arr = cache.get(ref.sources?.[0])!;
      if (!arr.find(x => x.url === ref.url)) arr.push(ref);
    } else {
      cache.set(ref.sources?.[0], [ref]);
    }
    // Trigger signal update
    this._cache.set(new Map(cache));
  }

  addPage(page: Page<Ref>) {
    if (!page.content.length) return;
    const pages = [...this._pages(), page];
    this._pages.set(pages);
    for (const r of page.content) this.add(r);
    this._latest.set(page.content);
  }

  loadMore() {
    const pages = this._pages();
    this._args.set({
      ...this._args(),
      page: pages.length,
    });
    this.loading = this.refs.page(this._args()).pipe(
      catchError((err: HttpErrorResponse) => {
        this._error.set(err);
        return throwError(() => err);
      }),
    ).subscribe(page => this.addPage(page));
  }

  loadAdHoc(source?: string) {
    const cache = this._cache();
    const args = {
      ...this._args(),
      responses: source,
    };
    const existing = cache.get(source)?.length;
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
