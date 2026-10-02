import { HttpErrorResponse } from '@angular/common/http';
import { computed, Injectable, signal, untracked } from '@angular/core';
import { isEqual } from 'lodash-es';
import { catchError, EMPTY, Subscription } from 'rxjs';
import { Page } from '../model/page';
import { Ref, RefPageArgs, RefSort } from '../model/ref';
import { RefService } from '../service/api/ref.service';
import { getArgs, UrlFilter } from '../util/query';

@Injectable({
  providedIn: 'root'
})
export class ThreadStore {

  defaultBatchSize = 500;
  private readonly _args = signal<RefPageArgs | undefined>({ size: this.defaultBatchSize, page: 0 }, { equal: isEqual });
  private readonly _pages = signal<Page<Ref>[]>([]);
  private readonly _error = signal<HttpErrorResponse | undefined>(undefined);
  private readonly _cache = signal(new Map<string | undefined, Ref[]>(), { equal: () => false });
  private readonly _latest = signal<Ref[]>([]);
  private readonly _hasMore = computed(() => {
    if (!this.pages.length) return false;
    return this.pages.length < this.pages[0].page.totalPages;
  });

  private loading?: Subscription;

  constructor(
    private refs: RefService,
  ) { }

  get args() { return this._args(); }
  set args(value: RefPageArgs | undefined) { this._args.set(value); }

  get pages() { return this._pages(); }

  get error() { return this._error(); }
  set error(value: HttpErrorResponse | undefined) { this._error.set(value); }

  /**
   * Read only. Map of source URL to loaded responses.
   */
  get cache(): ReadonlyMap<string | undefined, Ref[]> { return this._cache(); }

  get latest() { return this._latest(); }

  get hasMore() {
    return this._hasMore();
  }

  clear() {
    this.error = undefined;
    this.args = {
      size: this.defaultBatchSize,
      page: 0,
    };
    this._pages.set([]);
    this._cache.set(new Map());
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

  add(...refs: Ref[]) {
    const cache = untracked(() => this._cache());
    for (const ref of refs) {
      if (!ref.sources?.[0]) continue;
      if (cache.has(ref.sources?.[0])) {
        const arr = cache.get(ref.sources?.[0])!;
        if (!arr.find(x => x.url === ref.url)) arr.push(ref);
      } else {
        cache.set(ref.sources?.[0], [ref]);
      }
    }
    this._cache.set(cache);
  }

  addPage(page: Page<Ref>) {
    if (!page.content.length) return;
    this._pages.update(pages => [...pages, page]);
    this.add(...page.content);
    this._latest.set(page.content);
  }

  loadMore() {
    this.args = {
      ...this.args,
      page: this.pages.length,
    };
    this.loading = this.refs.page(this.args).pipe(
      catchError((err: HttpErrorResponse) => {
        this.error = err;
        return EMPTY;
      }),
    ).subscribe(page => this.addPage(page));
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
        this.error = err;
        return EMPTY;
      }),
    ).subscribe(page => {
      if (source) {
        this.add(...page.content);
        this._latest.set(page.content);
      }
    });
  }
}
