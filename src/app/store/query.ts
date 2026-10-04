import { computed, DestroyRef, Injectable, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { isEqual, omit } from 'lodash-es';
import { catchError, Observable, of } from 'rxjs';
import { Page } from '../model/page';
import { Ref, RefPageArgs } from '../model/ref';
import { RefService } from '../service/api/ref.service';
import { PageStore } from '../util/page-store';
import { withStableDateSort } from '../util/query';

interface PendingCursor {
  args: RefPageArgs;
  target: number;
  request: Observable<Page<Ref>>;
}

@Injectable({
  providedIn: 'root'
})
export class QueryStore extends PageStore<RefPageArgs, Ref> {
  private refs = inject(RefService);

  private readonly relatedSource = signal<() => RefPageArgs | undefined>(() => undefined);
  /** Args used only to load {@link sourcesOf} and {@link responseOf}, without loading a page. */
  readonly relatedArgs = computed(() => this.relatedSource()(), { equal: isEqual });
  private readonly related = computed(() => this.args() || this.relatedArgs());

  private readonly sourcesResource = rxResource({
    params: () => this.related()?.sources,
    stream: ({ params }) => this.refs.getCurrent(params).pipe(catchError(() => of(undefined))),
  });
  readonly sourcesOf = computed(() => this.sourcesResource.value());

  private readonly responseResource = rxResource({
    params: () => this.related()?.responses,
    stream: ({ params }) => this.refs.getCurrent(params).pipe(catchError(() => of(undefined))),
  });
  readonly responseOf = computed(() => this.responseResource.value());

  private pendingCursor?: PendingCursor;

  protected load(args: RefPageArgs) {
    return this.takeCursor(args) ?? this.refs.page(withStableDateSort(args));
  }

  /**
   * Load {@link sourcesOf} and {@link responseOf} for the given args without
   * loading a page, until the calling component is destroyed.
   * Must be called in an injection context.
   */
  watchRelated(args: () => RefPageArgs | undefined) {
    this.relatedSource.set(args);
    inject(DestroyRef).onDestroy(() => {
      if (this.relatedSource() === args) this.relatedSource.set(() => undefined);
    });
  }

  /**
   * Use a prefetched request when the args next change to the target page.
   */
  queueCursorPage(target: number, request: Observable<Page<Ref>>) {
    const args = this.args();
    if (!args) return;
    this.pendingCursor = { args: { ...args }, target, request };
  }

  private takeCursor(args: RefPageArgs): Observable<Page<Ref>> | undefined {
    const pending = this.pendingCursor;
    this.pendingCursor = undefined;
    if (pending?.target !== Number(args.page)) return undefined;
    if (!isEqual(
      omit(pending.args, 'page', 'obsolete'),
      omit(args, 'page', 'obsolete'),
    )) return undefined;
    return pending.request;
  }
}
