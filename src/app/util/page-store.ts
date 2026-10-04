import { HttpErrorResponse } from '@angular/common/http';
import { computed, DestroyRef, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { isEqual } from 'lodash-es';
import { Observable } from 'rxjs';
import { Page } from '../model/page';

/**
 * A root store holding the page of entities for the current route.
 * Pages call {@link watch} once with a reactive function returning the args.
 */
export abstract class PageStore<A, T> {
  private readonly source = signal<() => A | undefined>(() => undefined);

  readonly args = computed(() => this.source()(), { equal: isEqual });

  protected readonly resource = rxResource({
    params: () => this.args(),
    stream: ({ params }) => this.load(params),
  });

  readonly page = computed(() => this.resource.hasValue() ? this.resource.value() : undefined);
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

  refresh() {
    this.resource.reload();
  }
}
