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
import { withStableDateSort } from '../../util/query';

const CURSOR_PAGE_PADDING = 1;
const DATE_SORT_FIELDS = ['created', 'modified', 'published'] as const;

type DateSortField = typeof DATE_SORT_FIELDS[number];
type SortDirection = 'ASC' | 'DESC';
type CursorBound = 'Before' | 'After';
type CursorFilter = `${DateSortField}${CursorBound}`;

interface DateSort {
  field: DateSortField;
  direction: SortDirection;
}

interface CursorMove {
  anchor: Ref;
  bound: CursorBound;
  reverse: boolean;
  target: number;
}

interface CursorPlan {
  anchor: Ref;
  request: RefPageArgs;
  fallback: RefPageArgs;
  initialSize: number;
  reverse: boolean;
  contentSize: number;
  page: Page<Ref>['page'];
}

function isDateSortField(value: string | undefined): value is DateSortField {
  return DATE_SORT_FIELDS.some(field => field === value);
}

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

  cursorPage(target: number, event?: MouseEvent) {
    if (!this.plainClick(event)) return;

    const page = this.currentPage();
    const args = this.query.args;
    if (!page || !args) return;

    const sort = this.dateSort(args);
    if (!sort) return;

    const move = this.cursorMove(page, target, sort);
    if (!move) return;

    const plan = this.cursorPlan(page, args, sort, move);
    if (!plan) return;

    this.query.queueCursorPage(target, this.loadOrFallback(plan));
  }

  outOfPageSizeRange(size: number) {
    return !this.pageSizes.includes(size);
  }

  outOfColSizeRange(size: number) {
    return !this.colSizes.includes(size);
  }

  private currentPage(): Page<Ref> | undefined {
    const page = this.page as Page<Ref> | undefined;
    if (!page || page !== this.query.page || page.content.length === 0) return undefined;
    return page;
  }

  private dateSort(args: RefPageArgs): DateSort | undefined {
    const [field, direction] = args.sort?.[0]?.split(',') || [];
    if (!isDateSortField(field)) return undefined;
    return {
      field,
      direction: direction === 'ASC' ? 'ASC' : 'DESC',
    };
  }

  private cursorMove(page: Page<Ref>, target: number, sort: DateSort): CursorMove | undefined {
    if (target === page.page.number + 1) {
      const anchor = page.content.at(-1)!;
      return {
        anchor,
        bound: sort.direction === 'DESC' ? 'Before' : 'After',
        reverse: false,
        target,
      };
    }

    if (target === page.page.number - 1) {
      const anchor = page.content[0];
      return {
        anchor,
        bound: sort.direction === 'DESC' ? 'After' : 'Before',
        reverse: true,
        target,
      };
    }

    return undefined;
  }

  private cursorPlan(
    page: Page<Ref>,
    args: RefPageArgs,
    sort: DateSort,
    move: CursorMove,
  ): CursorPlan | undefined {
    const contentSize = this.contentSize(page, move.target);
    if (contentSize <= 0) return undefined;

    const cursor = this.cursorValue(move.anchor, sort.field, move.bound);
    if (!cursor) return undefined;

    const stableArgs = withStableDateSort(args);
    const stableSort = stableArgs.sort ?? [];
    const filter = `${sort.field}${move.bound}` as CursorFilter;

    return {
      anchor: move.anchor,
      request: {
        ...stableArgs,
        page: undefined,
        sort: move.reverse ? this.reverseSort(stableSort) : stableSort,
        [filter]: cursor,
      },
      fallback: { ...stableArgs, page: move.target },
      initialSize: contentSize + CURSOR_PAGE_PADDING,
      reverse: move.reverse,
      contentSize,
      page: { ...page.page, number: move.target },
    };
  }

  private cursorValue(ref: Ref, field: DateSortField, bound: CursorBound) {
    const value = field === 'modified' ? ref.modifiedString || ref.modified : ref[field];
    const date = typeof value === 'string' ? DateTime.fromISO(value) : value;
    if (!date?.isValid) return undefined;

    return (bound === 'Before'
      ? date.plus({ milliseconds: 1 })
      : date.minus({ milliseconds: 1 })
    ).toUTC().toISO() || undefined;
  }

  private contentSize(page: Page<Ref>, target: number) {
    const pageSize = page.page.size || page.content.length;
    const firstElement = target * pageSize;
    const remainingElements = page.page.totalElements - firstElement;
    return Math.min(pageSize, remainingElements);
  }

  private loadOrFallback(plan: CursorPlan): Observable<Page<Ref>> {
    return defer(() => this.loadCursorPage(plan)).pipe(
      catchError(() => EMPTY),
      defaultIfEmpty(undefined),
      switchMap(cursorPage => cursorPage
        ? of(cursorPage)
        : this.refs.page(plan.fallback)),
    );
  }

  private loadCursorPage(plan: CursorPlan): Observable<Page<Ref>> {
    const args = {
      ...plan.request,
      size: plan.initialSize,
    };

    return this.refs.page(args).pipe(
      switchMap(response => {
        const page = this.reconstruct(response.content, plan);
        return page ? of(page) : EMPTY;
      }),
    );
  }

  private reconstruct(content: Ref[], plan: CursorPlan): Page<Ref> | undefined {
    const anchorIndex = content.findIndex(ref => this.sameRef(ref, plan.anchor));
    if (anchorIndex < 0) return undefined;

    const contentStart = anchorIndex + 1;
    const contentEnd = contentStart + plan.contentSize;
    const pageContent = content.slice(contentStart, contentEnd);
    if (pageContent.length !== plan.contentSize) return undefined;

    return {
      content: plan.reverse ? pageContent.reverse() : pageContent,
      page: { ...plan.page },
    };
  }

  private reverseSort(sort: RefSort[]): RefSort[] {
    return sort.map(value => {
      const [field, direction] = value.split(',');
      const reverseDirection = direction === 'DESC' ? 'ASC' : 'DESC';
      return `${field},${reverseDirection}` as RefSort;
    });
  }

  private plainClick(event?: MouseEvent) {
    return !event || (
      event.button === 0 &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey
    );
  }

  private sameRef(a: Ref, b: Ref) {
    return a.url === b.url && (a.origin || '') === (b.origin || '');
  }
}
