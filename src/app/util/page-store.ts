import { HttpErrorResponse } from '@angular/common/http';
import { computed, DestroyRef, inject, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { isEqual, omit } from 'lodash-es';
import { Observable } from 'rxjs';
import { Page } from '../model/page';

interface LoadedPage<A, T> {
  args?: A;
  page?: Page<T>;
  loading: boolean;
}

/**
 * A root store holding the page of entities for the current route.
 * Pages call {@link watch} once with a reactive function returning the args.
 */
export abstract class PageStore<A, T> {
  private readonly source = signal<() => A | undefined>(() => undefined);
  private readonly shown = signal<(() => Page<T> | undefined) | undefined>(undefined);

  readonly args = computed(() => this.source()(), { equal: isEqual });

  protected readonly resource = rxResource({
    params: () => this.args(),
    stream: ({ params }) => this.load(params),
  });

  /**
   * The loaded page, keeping the previous page visible while a search-only change reloads.
   */
  private readonly loaded = linkedSignal<LoadedPage<A, T>, LoadedPage<A, T>>({
    source: () => ({
      args: this.args(),
      page: this.resource.hasValue() ? this.resource.value() : undefined,
      loading: this.resource.isLoading(),
    }),
    computation: (current, previous) => {
      if (current.page || !current.loading || !previous?.value.page) return current;
      if (!isEqual(omit(current.args as object, 'search'), omit(previous.value.args as object, 'search'))) return current;
      return { ...current, page: previous.value.page };
    },
  });

  readonly page = computed(() => {
    const shown = this.shown();
    if (shown) return shown();
    return this.loaded().page;
  });
  readonly error = computed(() => this.resource.error() as HttpErrorResponse | undefined);

  protected abstract load(args: A): Observable<Page<T>>;

  /**
   * Load pages for the given args until the calling component is destroyed.
   * Must be called in an injection context.
   */
  watch(args: () => A | undefined) {
    this.source.set(args);
    inject(DestroyRef).onDestroy(() => {
      if (this.source() === args) this.source.set(() => undefined);
    });
  }

  /**
   * Show a page loaded by the calling component instead of loading pages from args,
   * until the calling component is destroyed.
   * Must be called in an injection context.
   */
  show(page: () => Page<T> | undefined) {
    this.shown.set(page);
    inject(DestroyRef).onDestroy(() => {
      if (this.shown() === page) this.shown.set(undefined);
    });
  }

  refresh() {
    this.resource.reload();
  }
}
