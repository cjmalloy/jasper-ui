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
  readonly args = signal<RefPageArgs | undefined>({ size: this.defaultBatchSize, page: 0 }, { equal: isEqual });
  readonly pages = signal<Page<Ref>[]>([]);
  readonly error = signal<HttpErrorResponse | undefined>(undefined);
  /**
   * Read only. Map of source URL to loaded responses.
   */
  readonly cache = signal(new Map<string | undefined, Ref[]>(), { equal: () => false });
  readonly latest = signal<Ref[]>([]);
  readonly hasMore = computed(() => {
    if (!this.pages().length) return false;
    return this.pages().length < this.pages()[0].page.totalPages;
  });

  private loading?: Subscription;

  constructor(
    private refs: RefService,
  ) { }

  clear() {
    this.error.set(undefined);
    this.args.set({
      size: this.defaultBatchSize,
      page: 0,
    });
    this.pages.set([]);
    this.cache.set(new Map());
    this.loading?.unsubscribe();
  }

  setArgs(top?: string, sort?: RefSort | RefSort[], filters?: UrlFilter[], search?: string) {
    this.clear();
    this.args.set({
      ...getArgs('plugin/comment', sort, filters, search),
      responses: top,
      size: this.defaultBatchSize,
      page: 0,
    });
    this.loadMore();
  }

  add(...refs: Ref[]) {
    const cache = untracked(() => this.cache());
    for (const ref of refs) {
      if (!ref.sources?.[0]) continue;
      if (cache.has(ref.sources?.[0])) {
        const arr = cache.get(ref.sources?.[0])!;
        if (!arr.find(x => x.url === ref.url)) arr.push(ref);
      } else {
        cache.set(ref.sources?.[0], [ref]);
      }
    }
    this.cache.set(cache);
  }

  addPage(page: Page<Ref>) {
    if (!page.content.length) return;
    this.pages.update(pages => [...pages, page]);
    this.add(...page.content);
    this.latest.set(page.content);
  }

  loadMore() {
    this.args.set({
      ...this.args(),
      page: this.pages().length,
    });
    this.loading = this.refs.page(this.args()).pipe(
      catchError((err: HttpErrorResponse) => {
        this.error.set(err);
        return EMPTY;
      }),
    ).subscribe(page => this.addPage(page));
  }

  loadAdHoc(source?: string) {
    const args = {
      ...this.args(),
      responses: source,
    };
    const existing = this.cache().get(source)?.length;
    if (existing) {
      args.size = 20;
      args.page = Math.floor(existing / 20);
    }
    this.loading = this.refs.page(args).pipe(
      catchError((err: HttpErrorResponse) => {
        this.error.set(err);
        return EMPTY;
      }),
    ).subscribe(page => {
      if (source) {
        this.add(...page.content);
        this.latest.set(page.content);
      }
    });
  }
}
