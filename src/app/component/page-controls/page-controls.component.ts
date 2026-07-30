import { ChangeDetectionStrategy, Component, DestroyRef, HostBinding, inject, Input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { delay, isEqual, omit } from 'lodash-es';
import { DateTime } from 'luxon';
import { runInAction } from 'mobx';
import { catchError, EMPTY, Observable, of, Subscription, switchMap } from 'rxjs';
import { Page } from '../../model/page';
import { Ref, RefPageArgs } from '../../model/ref';
import { RefService } from '../../service/api/ref.service';
import { BookmarkService } from '../../service/bookmark.service';
import { QueryStore } from '../../store/query';
import { Store } from '../../store/store';

const CURSOR_PAGE_ATTEMPTS = 3;
const CURSOR_PAGE_PADDING = 8;
const MAX_CURSOR_PAGE_SIZE = 2000;
const DATE_SORTS = ['created', 'modified', 'published'] as const;
const CURSOR_PAGES = new WeakSet<Page<any>>();
const PREVIOUS_PAGES = new WeakMap<QueryStore, { args: RefPageArgs, page: Page<Ref> }>();

type DateSort = typeof DATE_SORTS[number];
type SortDirection = 'ASC' | 'DESC';

@Component({
  selector: 'app-page-controls',
  templateUrl: './page-controls.component.html',
  styleUrls: ['./page-controls.component.scss'],
  host: { 'class': 'page-controls' },
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    RouterLink,
    RouterLinkActive,
    ReactiveFormsModule,
    FormsModule,
  ]
})
export class PageControlsComponent {

  private destroyRef = inject(DestroyRef);
  private _page?: Page<any>;
  private cursorRequest?: Subscription;

  @Input()
  showPageLast = true;
  @Input()
  hideCols = false;
  @Input()
  showPrev = true;

  pageSizes = [6, 24, 48, 96, 480];
  colSizes = [1, 2, 3, 4, 5, 6];
  colsChanged = false;

  constructor(
    public store: Store,
    private bookmarks: BookmarkService,
    private query: QueryStore,
    private refs: RefService,
  ) { }

  get page() {
    return this._page;
  }

  @Input()
  set page(value: Page<any> | undefined) {
    this._page = value;
    if (!value) {
      this.cursorRequest?.unsubscribe();
      return;
    }
    if (CURSOR_PAGES.has(value) || value !== this.query.page) return;
    const previous = PREVIOUS_PAGES.get(this.query);
    const args = this.query.args!;
    PREVIOUS_PAGES.set(this.query, { args, page: value as Page<Ref> });

    const sort = this.dateSort(args);
    const pageNumber = Number(args.page);
    if (!sort || !pageNumber || pageNumber !== value.page.number || !value.content.length) return;

    const previousAnchor = previous?.page.page.number === pageNumber - 1
      && isEqual(omit(previous.args, 'page'), omit(args, 'page'))
      ? previous.page.content.at(-1)
      : undefined;
    const anchor = previousAnchor || value.content[0] as Ref;
    const cursor = this.dateCursor(anchor, sort);
    if (!cursor) return;

    const cursorArgs = { ...args, sort: [...args.sort!] };
    this.cursorRequest?.unsubscribe();
    this.cursorRequest = this.loadCursorPage(cursorArgs, value as Page<Ref>, anchor, sort, cursor, Boolean(previousAnchor)).pipe(
      catchError(() => EMPTY),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(page => {
      if (this.query.page !== value) return;
      CURSOR_PAGES.add(page);
      PREVIOUS_PAGES.set(this.query, { args, page });
      runInAction(() => this.query.page = page);
    });
  }

  @HostBinding('class.print-hide')
  get fullResults() {
    return this.page?.page.totalPages === 1;
  }

  @Input()
  set defaultCols(value: number | undefined) {
    this.colsChanged ||= value !== undefined;
  }

  get hasQuery() {
    return this.store.view.pageNumber !== undefined;
  }

  get prev() {
    return Math.max(0, this.page!.page.number - 1);
  }

  get next() {
    return Math.max(0, Math.min(this.last, this.page!.page.number + 1));
  }

  get last() {
    return Math.max(0, this.page!.page.totalPages - 1);
  }

  get pageSize() {
    return this.store.view.pageSize;
  }

  set pageSize(value: number) {
    this.bookmarks.pageSize = value;
  }

  get cols() {
    if (this.store.view.cols) {
      this.colsChanged = true;
    }
    return this.store.view.cols;
  }

  set cols(value: number) {
    this.bookmarks.cols = value;
  }

  scrollUp() {
    delay(() => window.scrollTo(0, 0), 400);
  }

  outOfPageSizeRange(size: number) {
    return !this.pageSizes.includes(size);
  }

  outOfColSizeRange(size: number) {
    return !this.colSizes.includes(size);
  }

  private dateSort(args?: RefPageArgs): { field: DateSort, direction: SortDirection } | undefined {
    const [field, direction] = args?.sort?.[0]?.split(',') || [];
    if (!DATE_SORTS.includes(field as DateSort)) return undefined;
    return {
      field: field as DateSort,
      direction: direction === 'ASC' ? 'ASC' : 'DESC',
    };
  }

  private dateCursor(ref: Ref, sort: { field: DateSort, direction: SortDirection }) {
    const value = sort.field === 'modified' ? ref.modifiedString || ref.modified : ref[sort.field];
    const date = typeof value === 'string' ? DateTime.fromISO(value) : value;
    if (!date?.isValid) return undefined;
    return (sort.direction === 'DESC'
      ? date.plus({ milliseconds: 1 })
      : date.minus({ milliseconds: 1 })
    ).toUTC().toISO() || undefined;
  }

  private loadCursorPage(
    args: RefPageArgs,
    requested: Page<Ref>,
    anchor: Ref,
    sort: { field: DateSort, direction: SortDirection },
    cursor: string,
    afterAnchor = false,
    attempt = 0,
  ): Observable<Page<Ref>> {
    const cursorKey = `${sort.field}${sort.direction === 'DESC' ? 'Before' : 'After'}`;
    const requestedSize = requested.page.size || requested.content.length;
    const size = Math.min((requestedSize + CURSOR_PAGE_PADDING) * Math.pow(2, attempt), MAX_CURSOR_PAGE_SIZE);
    const hasModified = args.sort?.some(s => s === 'modified' || s === 'modified,ASC' || s === 'modified,DESC');
    const hasOrigin = args.sort?.some(s => s === 'origin' || s === 'origin,ASC' || s === 'origin,DESC');
    const stableSort = [
      ...(args.sort || []),
      ...(!hasModified ? ['modified,ASC' as const] : []),
      ...(!hasOrigin ? ['origin,ASC' as const] : []),
    ];
    const cursorArgs = {
      ...args,
      page: 0,
      size,
      sort: stableSort,
      [cursorKey]: cursor,
    };

    return this.refs.page(cursorArgs).pipe(
      switchMap(page => {
        const anchorIndex = page.content.findIndex(ref => this.sameRef(ref, anchor));
        const start = anchorIndex + (afterAnchor ? 1 : 0);
        const content = anchorIndex < 0
          ? []
          : page.content.slice(start, start + requested.content.length);
        if (content.length === requested.content.length) {
          return of({
            content,
            page: { ...requested.page },
          });
        }
        const nextSize = Math.min(size * 2, MAX_CURSOR_PAGE_SIZE);
        if (attempt + 1 >= CURSOR_PAGE_ATTEMPTS || page.content.length < size || nextSize === size) return EMPTY;
        return this.loadCursorPage(args, requested, anchor, sort, cursor, afterAnchor, attempt + 1);
      }),
    );
  }

  private sameRef(a: Ref, b: Ref) {
    return a.url === b.url && (a.origin || '') === (b.origin || '');
  }
}
