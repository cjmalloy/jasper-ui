import { HttpErrorResponse } from '@angular/common/http';
import { computed, DestroyRef, Injectable, inject, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { isEqual } from 'lodash-es';
import { catchError, EMPTY, Subscription } from 'rxjs';
import { Page } from '../model/page';
import { Ref, RefPageArgs, RefSort } from '../model/ref';
import { RefService } from '../service/api/ref.service';
import { getArgs, UrlFilter } from '../util/query';

export interface ThreadArgs {
  top?: string;
  sort?: RefSort | RefSort[];
  filters?: UrlFilter[];
  search?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ThreadStore {
  private refs = inject(RefService);

  defaultBatchSize = 500;

  private readonly source = signal<() => ThreadArgs | undefined>(() => undefined);
  readonly args = computed<RefPageArgs | undefined>(() => {
    const thread = this.source()();
    if (!thread) return undefined;
    return {
      ...getArgs('plugin/comment', thread.sort, thread.filters, thread.search),
      responses: thread.top,
      size: this.defaultBatchSize,
      page: 0,
    };
  }, { equal: isEqual });

  private readonly first = rxResource({
    params: () => this.args(),
    stream: ({ params }) => this.refs.page(params),
  });

  readonly error = linkedSignal<HttpErrorResponse | undefined>(() => this.first.error() as HttpErrorResponse | undefined);
  /** Pages loaded so far. Reset when the args change. */
  readonly pages = linkedSignal<Page<Ref>[]>(() => {
    const page = this.first.hasValue() ? this.first.value() : undefined;
    return page?.content.length ? [page] : [];
  });
  /** Comments loaded outside of {@link pages}, like ad hoc loads and new replies. */
  private readonly extra = linkedSignal<readonly Ref[]>(() => {
    this.args();
    return [];
  });
  /**
   * Map of source URL to loaded responses.
   */
  readonly cache = computed<ReadonlyMap<string | undefined, readonly Ref[]>>(() => {
    const cache = new Map<string | undefined, readonly Ref[]>();
    for (const ref of [...this.pages().flatMap(p => p.content), ...this.extra()]) {
      const source = ref.sources?.[0];
      if (!source) continue;
      const existing = cache.get(source) || [];
      if (!existing.some(x => x.url === ref.url)) cache.set(source, [...existing, ref]);
    }
    return cache;
  });
  /** The most recently loaded batch of comments. */
  readonly latest = linkedSignal<Ref[]>(() => [...this.pages().at(-1)?.content || []]);
  readonly hasMore = computed(() => {
    if (!this.pages().length) return false;
    return this.pages().length < this.pages()[0].page.totalPages;
  });

  private loading?: Subscription;

  /**
   * Load the comment thread for the given args until the calling component is destroyed.
   * Must be called in an injection context.
   */
  watch(args: () => ThreadArgs | undefined) {
    this.loading?.unsubscribe();
    this.source.set(args);
    inject(DestroyRef).onDestroy(() => {
      if (this.source() !== args) return;
      this.loading?.unsubscribe();
      this.source.set(() => undefined);
    });
  }

  add(...refs: Ref[]) {
    this.extra.update(extra => [...extra, ...refs]);
  }

  loadMore() {
    const args = this.args();
    if (!args) return;
    this.loading = this.refs.page({ ...args, page: this.pages().length }).pipe(
      catchError((err: HttpErrorResponse) => {
        this.error.set(err);
        return EMPTY;
      }),
    ).subscribe(page => {
      if (!page.content.length) return;
      this.pages.update(pages => [...pages, page]);
    });
  }

  loadAdHoc(source?: string) {
    const args: RefPageArgs = {
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
        this.latest.set([...page.content]);
      }
    });
  }
}
