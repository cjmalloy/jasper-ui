import { ChangeDetectionStrategy, Component, DestroyRef, HostBinding, inject, Input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { delay } from 'lodash-es';
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
  private cursorPages = new WeakSet<Page<any>>();

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
    if (!value || this.cursorPages.has(value) || value !== this.query.page) return;

    const sort = this.dateSort(this.query.args);
    const pageNumber = Number(this.query.args?.page);
    if (!sort || !pageNumber || pageNumber !== value.page.number || !value.content.length) return;

    const anchor = value.content[0] as Ref;
    const cursor = this.dateCursor(anchor, sort);
    if (!cursor) return;

    const args = { ...this.query.args, sort: [...this.query.args!.sort!] };
    this.cursorRequest?.unsubscribe();
    this.cursorRequest = this.loadCursorPage(args, value as Page<Ref>, anchor, sort, cursor).pipe(
      catchError(() => EMPTY),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(page => {
      if (this.query.page !== value) return;
      this.cursorPages.add(page);
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
    const date = DateTime.isDateTime(value) ? value : value ? DateTime.fromISO(value) : undefined;
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
    attempt = 0,
  ): Observable<Page<Ref>> {
    const cursorKey = `${sort.field}${sort.direction === 'DESC' ? 'Before' : 'After'}`;
    const requestedSize = requested.page.size || requested.content.length;
    const size = Math.min((requestedSize + CURSOR_PAGE_PADDING) * Math.pow(2, attempt), MAX_CURSOR_PAGE_SIZE);
    const cursorArgs = {
      ...args,
      page: 0,
      size,
      [cursorKey]: cursor,
    };

    return this.refs.page(cursorArgs).pipe(
      switchMap(page => {
        const anchorIndex = page.content.findIndex(ref => this.sameRef(ref, anchor));
        const content = anchorIndex < 0
          ? []
          : page.content.slice(anchorIndex, anchorIndex + requested.content.length);
        if (content.length === requested.content.length) {
          return of({
            content,
            page: { ...requested.page },
          });
        }
        const nextSize = Math.min(size * 2, MAX_CURSOR_PAGE_SIZE);
        if (attempt + 1 >= CURSOR_PAGE_ATTEMPTS || page.content.length < size || nextSize === size) return EMPTY;
        return this.loadCursorPage(args, requested, anchor, sort, cursor, attempt + 1);
      }),
    );
  }

  private sameRef(a: Ref, b: Ref) {
    return a.url === b.url && (a.origin || '') === (b.origin || '');
  }
}
