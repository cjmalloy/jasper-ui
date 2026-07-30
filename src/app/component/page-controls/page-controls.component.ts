import { ChangeDetectionStrategy, Component, HostBinding, Input } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { delay } from 'lodash-es';
import { DateTime } from 'luxon';
import { catchError, defaultIfEmpty, defer, EMPTY, Observable, of, switchMap } from 'rxjs';
import { Page } from '../../model/page';
import { Ref, RefPageArgs, RefSort } from '../../model/ref';
import { RefService } from '../../service/api/ref.service';
import { BookmarkService } from '../../service/bookmark.service';
import { QueryStore } from '../../store/query';
import { Store } from '../../store/store';
import { stableDateSortArgs } from '../../util/query';

const CURSOR_PAGE_ATTEMPTS = 3;
const CURSOR_PAGE_PADDING = 1;
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

  @Input()
  page?: Page<any>;
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

  cursorPage(pageNumber: number, event?: MouseEvent) {
    if (event && (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)) return;
    const page = this.page as Page<Ref> | undefined;
    const args = this.query.args;
    if (!page || page !== this.query.page || !args || !page.content.length) return;

    const step = pageNumber - page.page.number;
    const sort = this.dateSort(args);
    if (Math.abs(step) !== 1 || !sort) return;

    const anchor = step > 0 ? page.content.at(-1)! : page.content[0];
    const before = (step > 0) === (sort.direction === 'DESC');
    const cursor = this.dateCursor(anchor, sort.field, before);
    if (!cursor) return;

    const pageSize = page.page.size || page.content.length;
    const contentSize = Math.min(pageSize, page.page.totalElements - pageNumber * pageSize);
    if (contentSize <= 0) return;

    const request = defer(() => this.loadCursorPage(
        args,
        { ...page.page, number: pageNumber },
        contentSize + CURSOR_PAGE_PADDING,
        contentSize,
        anchor,
        sort,
        cursor,
        before,
        step < 0,
      )).pipe(
      catchError(() => EMPTY),
      defaultIfEmpty(undefined),
      switchMap(cursorPage => cursorPage
        ? of(cursorPage)
        : this.refs.page({ ...args, page: pageNumber })),
    );
    this.query.queueCursorPage(pageNumber, request);
  }

  outOfPageSizeRange(size: number) {
    return !this.pageSizes.includes(size);
  }

  outOfColSizeRange(size: number) {
    return !this.colSizes.includes(size);
  }

  private dateSort(args: RefPageArgs): { field: DateSort, direction: SortDirection } | undefined {
    const [field, direction] = args.sort?.[0]?.split(',') || [];
    if (!DATE_SORTS.includes(field as DateSort)) return undefined;
    return {
      field: field as DateSort,
      direction: direction === 'ASC' ? 'ASC' : 'DESC',
    };
  }

  private dateCursor(ref: Ref, field: DateSort, before: boolean) {
    const value = field === 'modified' ? ref.modifiedString || ref.modified : ref[field];
    const date = typeof value === 'string' ? DateTime.fromISO(value) : value;
    if (!date?.isValid) return undefined;
    return (before
      ? date.plus({ milliseconds: 1 })
      : date.minus({ milliseconds: 1 })
    ).toUTC().toISO() || undefined;
  }

  private loadCursorPage(
    args: RefPageArgs,
    page: Page<Ref>['page'],
    initialSize: number,
    contentSize: number,
    anchor: Ref,
    sort: { field: DateSort, direction: SortDirection },
    cursor: string,
    before: boolean,
    reverse: boolean,
    attempt = 0,
  ): Observable<Page<Ref>> {
    const cursorKey = `${sort.field}${before ? 'Before' : 'After'}` as
      `${DateSort}${'Before' | 'After'}`;
    const stableArgs = stableDateSortArgs(args);
    const size = Math.min(initialSize * Math.pow(2, attempt), MAX_CURSOR_PAGE_SIZE);
    const cursorArgs: RefPageArgs = {
      ...stableArgs,
      page: undefined,
      size,
      sort: reverse ? this.reverseSort(stableArgs.sort || []) : stableArgs.sort,
      [cursorKey]: cursor,
    };

    return this.refs.page(cursorArgs).pipe(
      switchMap(response => {
        const anchorIndex = response.content.findIndex(ref => this.sameRef(ref, anchor));
        let content = anchorIndex < 0
          ? []
          : response.content.slice(anchorIndex + 1, anchorIndex + 1 + contentSize);
        if (reverse) content = content.reverse();
        if (content.length === contentSize) {
          return of({
            content,
            page: { ...page },
          });
        }
        const nextSize = Math.min(size * 2, MAX_CURSOR_PAGE_SIZE);
        if (attempt + 1 >= CURSOR_PAGE_ATTEMPTS ||
            response.content.length < size ||
            nextSize === size) return EMPTY;
        return this.loadCursorPage(
          args,
          page,
          initialSize,
          contentSize,
          anchor,
          sort,
          cursor,
          before,
          reverse,
          attempt + 1,
        );
      }),
    );
  }

  private reverseSort(sort: RefSort[]): RefSort[] {
    return sort.map(value => {
      const [field, direction] = value.split(',');
      return `${field},${direction === 'DESC' ? 'ASC' : 'DESC'}` as RefSort;
    });
  }

  private sameRef(a: Ref, b: Ref) {
    return a.url === b.url && (a.origin || '') === (b.origin || '');
  }
}
