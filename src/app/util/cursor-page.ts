import { DateTime } from 'luxon';
import { catchError, defaultIfEmpty, defer, EMPTY, Observable, of, switchMap } from 'rxjs';
import { Page } from '../model/page';
import { Ref, RefPageArgs, RefSort } from '../model/ref';
import { RefService } from '../service/api/ref.service';
import { dateRange, defaultDesc, withStableDateSort } from './query';

const CURSOR_PAGE_PADDING = 1;
const DATE_SORT_FIELDS = ['created', 'modified', 'published'] as const;

type DateSortField = typeof DATE_SORT_FIELDS[number];
type SortDirection = 'ASC' | 'DESC';
type CursorBound = 'Before' | 'After';

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

/**
 * Load the adjacent page by anchoring on the first or last ref of the given page,
 * so refs deleted or reordered since it loaded don't shift the offset.
 * Falls back to offset paging if the anchor cannot be found.
 * Returns undefined when the page is not sorted by date or the target is not adjacent.
 */
export function cursorPage(refs: RefService, page: Page<Ref>, args: RefPageArgs, target: number): Observable<Page<Ref>> | undefined {
  if (!page.content.length) return undefined;
  const sort = dateSort(args);
  if (!sort) return undefined;
  const move = cursorMove(page, target, sort);
  if (!move) return undefined;
  const plan = cursorPlan(page, args, sort, move);
  if (!plan) return undefined;
  return loadOrFallback(refs, plan);
}

function dateSort(args: RefPageArgs): DateSort | undefined {
  const [field, direction] = args.sort?.[0]?.split(',') || [];
  if (!isDateSortField(field)) return undefined;
  return {
    field,
    direction: direction === 'ASC' ? 'ASC' : 'DESC',
  };
}

function cursorMove(page: Page<Ref>, target: number, sort: DateSort): CursorMove | undefined {
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

function cursorPlan(
  page: Page<Ref>,
  args: RefPageArgs,
  sort: DateSort,
  move: CursorMove,
): CursorPlan | undefined {
  const contentSize = pageContentSize(page, move.target);
  if (contentSize <= 0) return undefined;

  const cursor = cursorValue(move.anchor, sort.field, move.bound);
  if (!cursor) return undefined;

  const stableArgs = withStableDateSort(args);
  const stableSort = stableArgs.sort ?? [];
  const request = {
    ...stableArgs,
    page: undefined,
    sort: move.reverse ? reverseSort(stableSort) : stableSort,
  };

  return {
    anchor: move.anchor,
    request: move.bound === 'Before'
      ? dateRange(request, sort.field, undefined, cursor)
      : dateRange(request, sort.field, cursor),
    fallback: { ...stableArgs, page: move.target },
    initialSize: contentSize + CURSOR_PAGE_PADDING,
    reverse: move.reverse,
    contentSize,
    page: { ...page.page, number: move.target },
  };
}

function cursorValue(ref: Ref, field: DateSortField, bound: CursorBound) {
  const value = field === 'modified' ? ref.modifiedString || ref.modified : ref[field];
  const date = typeof value === 'string' ? DateTime.fromISO(value) : value;
  if (!date?.isValid) return undefined;

  return (bound === 'Before'
    ? date.plus({ milliseconds: 1 })
    : date.minus({ milliseconds: 1 })
  ).toUTC().toISO() || undefined;
}

function pageContentSize(page: Page<Ref>, target: number) {
  const pageSize = page.page.size || page.content.length;
  const firstElement = target * pageSize;
  const remainingElements = page.page.totalElements - firstElement;
  return Math.min(pageSize, remainingElements);
}

function loadOrFallback(refs: RefService, plan: CursorPlan): Observable<Page<Ref>> {
  return defer(() => loadCursorPage(refs, plan)).pipe(
    catchError(() => EMPTY),
    defaultIfEmpty(undefined),
    switchMap(cursorPage => cursorPage
      ? of(cursorPage)
      : refs.page(plan.fallback)),
  );
}

function loadCursorPage(refs: RefService, plan: CursorPlan): Observable<Page<Ref>> {
  const args = {
    ...plan.request,
    size: plan.initialSize,
  };

  return refs.page(args).pipe(
    switchMap(response => {
      const page = reconstruct(response.content, plan);
      return page ? of(page) : EMPTY;
    }),
  );
}

function reconstruct(content: Ref[], plan: CursorPlan): Page<Ref> | undefined {
  const anchorIndex = content.findIndex(ref => sameRef(ref, plan.anchor));
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

function reverseSort(sort: RefSort[]): RefSort[] {
  return sort.map(value => {
    const [field, direction] = value.split(',');
    const reverseDirection = direction
      ? direction === 'DESC' ? 'ASC' : 'DESC'
      : defaultDesc(field) ? 'ASC' : 'DESC';
    return `${field},${reverseDirection}` as RefSort;
  });
}

function sameRef(a: Ref, b: Ref) {
  return a.url === b.url && (a.origin || '') === (b.origin || '');
}

/**
 * A primary click without modifiers, which navigates in the current tab.
 */
export function plainClick(event?: MouseEvent) {
  return !event || (
    event.button === 0 &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey
  );
}
