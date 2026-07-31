/// <reference types="vitest/globals" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DateTime } from 'luxon';
import { Observable, of } from 'rxjs';
import { Page } from '../../model/page';
import { Ref, RefPageArgs } from '../../model/ref';
import { RefService } from '../../service/api/ref.service';
import { QueryStore } from '../../store/query';

import { PageControlsComponent } from './page-controls.component';

const OLD_DATE = '2024-01-01T00:00:00.000Z';
const OLD_DATE_PLUS_1 = '2024-01-01T00:00:00.001Z';
const DATE = '2024-01-02T00:00:00.000Z';

describe('PageControlsComponent', () => {
  let component: PageControlsComponent;
  let fixture: ComponentFixture<PageControlsComponent>;
  let queryStore: {
    args?: RefPageArgs;
    page?: Page<Ref>;
    queueCursorPage: ReturnType<typeof vi.fn>;
  };
  let refService: { page: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    queryStore = { queueCursorPage: vi.fn() };
    refService = { page: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [PageControlsComponent],
      providers: [
        provideRouter([]),
        { provide: QueryStore, useValue: queryStore },
        { provide: RefService, useValue: refService },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PageControlsComponent);
    component = fixture.componentInstance;
    component.page = Page.of([]);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads tied cursor results in one padded request', () => {
    const first = ref('first', {
      published: DATE,
      modified: OLD_DATE,
      origin: '@a',
    });
    const anchor = ref('anchor', {
      published: DATE,
      modified: OLD_DATE,
      origin: '@b',
    });
    const next = ref('next', {
      published: DATE,
      modified: OLD_DATE_PLUS_1,
      origin: '@a',
    });
    const older = ref('older', { published: OLD_DATE });
    const current = refPage([first, anchor], 0, 2, 4);
    queryStore.args = { query: 'public', page: 0, size: 2, sort: ['published,DESC'] };
    queryStore.page = current;
    component.page = current;
    refService.page.mockImplementation((args: RefPageArgs) => {
      const requestSize = args.size!;
      const content = [anchor, next, older].slice(0, requestSize);
      return of(refPage(content, 0, requestSize, 3));
    });

    component.cursorPage(1);

    expect(refService.page).not.toHaveBeenCalled();
    expect(queryStore.queueCursorPage).toHaveBeenCalledOnce();
    expect(queryStore.queueCursorPage.mock.calls[0][0]).toBe(1);

    const result = loadCursor();

    expect(refService.page).toHaveBeenCalledOnce();
    expect(refService.page.mock.calls[0][0]).toMatchObject({
      query: 'public',
      page: undefined,
      size: 3,
      sort: ['published,DESC', 'modified,ASC', 'origin,ASC'],
      publishedBefore: '2024-01-02T00:00:00.001Z',
    });
    expect(result?.content).toEqual([next, older]);
    expect(result?.page).toEqual({ ...current.page, number: 1 });
  });

  it('reverses the stable cursor request when prev is pressed', () => {
    const first = ref('first', {
      published: DATE,
      modified: OLD_DATE,
      origin: '@a',
    });
    const previousLast = ref('previous-last', {
      published: DATE,
      modified: OLD_DATE,
      origin: '@b',
    });
    const anchor = ref('anchor', {
      published: DATE,
      modified: OLD_DATE_PLUS_1,
      origin: '@a',
    });
    const older = ref('older', { published: OLD_DATE });
    const current = refPage([anchor, older], 1, 2, 4);
    queryStore.args = { query: 'public', page: 1, size: 2, sort: ['published,DESC'] };
    queryStore.page = current;
    component.page = current;
    refService.page.mockReturnValue(of(refPage([anchor, previousLast, first], 0, 3, 3)));

    component.cursorPage(0);

    const result = loadCursor();

    expect(refService.page).toHaveBeenCalledOnce();
    expect(refService.page.mock.calls[0][0]).toMatchObject({
      page: undefined,
      size: 3,
      sort: ['published,ASC', 'modified,DESC', 'origin,DESC'],
      publishedAfter: '2024-01-01T23:59:59.999Z',
    });
    expect(result?.content).toEqual([first, previousLast]);
    expect(result?.page).toEqual({ ...current.page, number: 0 });
  });

  it('uses an after cursor for ascending next-page navigation', () => {
    const first = ref('first', { published: '2024-01-01T00:00:00.000Z' });
    const anchor = ref('anchor', { published: '2024-01-02T00:00:00.000Z' });
    const next = ref('next', { published: '2024-01-03T00:00:00.000Z' });
    const last = ref('last', { published: '2024-01-04T00:00:00.000Z' });
    const current = refPage([first, anchor], 0, 2, 4);
    queryStore.args = { query: 'public', page: 0, size: 2, sort: ['published,ASC'] };
    queryStore.page = current;
    component.page = current;
    refService.page.mockReturnValue(of(refPage([anchor, next, last], 0, 3, 3)));

    component.cursorPage(1);
    loadCursor();

    expect(refService.page).toHaveBeenCalledOnce();
    expect(refService.page.mock.calls[0][0]).toMatchObject({
      sort: ['published,ASC', 'modified,ASC', 'origin,ASC'],
      publishedAfter: '2024-01-01T23:59:59.999Z',
    });
  });

  it('falls back without retrying when the cursor cannot reconstruct the page', () => {
    const first = ref('first', { published: DATE });
    const anchor = ref('anchor', { published: DATE });
    const offset = refPage([ref('next', { published: OLD_DATE })], 1, 2, 3);
    const current = refPage([first, anchor], 0, 2, 3);
    queryStore.args = { query: 'public', page: 0, size: 2, sort: ['published,DESC'] };
    queryStore.page = current;
    component.page = current;
    refService.page.mockImplementation((args: RefPageArgs) => {
      if (args.publishedBefore) {
        return of(refPage([
          ref('unrelated-1', { published: DATE }),
          anchor,
        ], 0, args.size!, 4));
      }
      return of(offset);
    });

    component.cursorPage(1);
    const result = loadCursor();

    expect(refService.page).toHaveBeenCalledTimes(2);
    expect(refService.page.mock.calls[1][0]).toEqual({
      ...queryStore.args,
      page: 1,
      sort: ['published,DESC', 'modified,ASC', 'origin,ASC'],
    });
    expect(result).toBe(offset);
  });

  it('does not prepare cursor navigation for non-date sorts', () => {
    const current = refPage([ref('first', { published: DATE })], 0, 1, 2);
    queryStore.args = { query: 'public', page: 0, size: 1, sort: ['title,ASC'] };
    queryStore.page = current;
    component.page = current;

    component.cursorPage(1);

    expect(queryStore.queueCursorPage).not.toHaveBeenCalled();
  });

  it('does not prepare cursor navigation for modified clicks', () => {
    const current = refPage([ref('first', { published: DATE })], 0, 1, 2);
    queryStore.args = { query: 'public', page: 0, size: 1, sort: ['published,DESC'] };
    queryStore.page = current;
    component.page = current;

    component.cursorPage(1, new MouseEvent('click', { ctrlKey: true }));

    expect(queryStore.queueCursorPage).not.toHaveBeenCalled();
  });

  it('does not prepare cursor navigation for a page outside the query store', () => {
    const current = refPage([ref('first', { published: DATE })], 0, 1, 2);
    queryStore.args = { query: 'public', page: 0, size: 1, sort: ['published,DESC'] };
    queryStore.page = current;
    component.page = refPage([...current.content], 0, 1, 2);

    component.cursorPage(1);

    expect(queryStore.queueCursorPage).not.toHaveBeenCalled();
  });

  function loadCursor() {
    const request = queryStore.queueCursorPage.mock.calls[0][1] as Observable<Page<Ref>>;
    let result: Page<Ref> | undefined;
    request.subscribe(page => result = page);
    return result;
  }
});

interface RefValues {
  published?: string;
  created?: string;
  modified?: string;
  origin?: string;
}

function ref(url: string, values: RefValues = {}): Ref {
  const modified = values.modified ?? values.published;
  return {
    url: `https://example.com/${url}`,
    origin: values.origin ?? '',
    published: values.published ? DateTime.fromISO(values.published) : undefined,
    created: values.created ? DateTime.fromISO(values.created) : undefined,
    modified: modified ? DateTime.fromISO(modified) : undefined,
  };
}

function refPage(content: Ref[], number: number, size: number, totalElements: number): Page<Ref> {
  return {
    content,
    page: {
      number,
      size,
      totalElements,
      totalPages: Math.ceil(totalElements / size),
    },
  };
}
