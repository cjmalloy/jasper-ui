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

describe('PageControlsComponent', () => {
  let component: PageControlsComponent;
  let fixture: ComponentFixture<PageControlsComponent>;
  let query: {
    args?: RefPageArgs;
    page?: Page<Ref>;
    queueCursorPage: ReturnType<typeof vi.fn>;
  };
  let refs: { page: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    query = { queueCursorPage: vi.fn() };
    refs = { page: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [PageControlsComponent],
      providers: [
        provideRouter([]),
        { provide: QueryStore, useValue: query },
        { provide: RefService, useValue: refs },
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

  it('queues one stable cursor request when next is pressed', () => {
    const first = ref('first', '2024-01-02T00:00:00.000Z', undefined, '2024-01-01T00:00:00.000Z', '@a');
    const anchor = ref('anchor', '2024-01-02T00:00:00.000Z', undefined, '2024-01-01T00:00:00.000Z', '@b');
    const next = ref('next', '2024-01-02T00:00:00.000Z', undefined, '2024-01-01T00:00:00.001Z', '@a');
    const older = ref('older', '2024-01-01T00:00:00.000Z');
    const current = refPage([first, anchor], 0, 2, 4);
    query.args = { query: 'public', page: 0, size: 2, sort: ['published,DESC'] };
    query.page = current;
    component.page = current;
    refs.page.mockImplementation((args: RefPageArgs) => of(
      refPage([first, anchor, next, older].slice(0, args.size), 0, args.size!, 4),
    ));

    component.cursorPage(1);

    expect(refs.page).not.toHaveBeenCalled();
    expect(query.queueCursorPage).toHaveBeenCalledOnce();
    expect(query.queueCursorPage.mock.calls[0][0]).toBe(1);

    let result: Page<Ref> | undefined;
    (query.queueCursorPage.mock.calls[0][1] as Observable<Page<Ref>>)
      .subscribe(page => result = page);

    expect(refs.page).toHaveBeenCalledTimes(2);
    expect(refs.page.mock.calls[0][0]).toMatchObject({
      query: 'public',
      page: undefined,
      size: 3,
      sort: ['published,DESC', 'modified,ASC', 'origin,ASC'],
      publishedBefore: '2024-01-02T00:00:00.001Z',
    });
    expect(refs.page.mock.calls[1][0]).toMatchObject({
      size: 6,
      sort: ['published,DESC', 'modified,ASC', 'origin,ASC'],
      publishedBefore: '2024-01-02T00:00:00.001Z',
    });
    expect(result?.content).toEqual([next, older]);
    expect(result?.page).toEqual({ ...current.page, number: 1 });
  });

  it('reverses the stable cursor request when prev is pressed', () => {
    const first = ref('first', '2024-01-02T00:00:00.000Z', undefined, '2024-01-01T00:00:00.000Z', '@a');
    const previousLast = ref('previous-last', '2024-01-02T00:00:00.000Z', undefined, '2024-01-01T00:00:00.000Z', '@b');
    const anchor = ref('anchor', '2024-01-02T00:00:00.000Z', undefined, '2024-01-01T00:00:00.001Z', '@a');
    const older = ref('older', '2024-01-01T00:00:00.000Z');
    const current = refPage([anchor, older], 1, 2, 4);
    query.args = { query: 'public', page: 1, size: 2, sort: ['published,DESC'] };
    query.page = current;
    component.page = current;
    refs.page.mockReturnValue(of(refPage([anchor, previousLast, first], 0, 3, 3)));

    component.cursorPage(0);

    let result: Page<Ref> | undefined;
    (query.queueCursorPage.mock.calls[0][1] as Observable<Page<Ref>>)
      .subscribe(page => result = page);

    expect(refs.page).toHaveBeenCalledOnce();
    expect(refs.page.mock.calls[0][0]).toMatchObject({
      page: undefined,
      size: 3,
      sort: ['published,ASC', 'modified,DESC', 'origin,DESC'],
      publishedAfter: '2024-01-01T23:59:59.999Z',
    });
    expect(result?.content).toEqual([first, previousLast]);
    expect(result?.page).toEqual({ ...current.page, number: 0 });
  });

  it('uses an after cursor for ascending next-page navigation', () => {
    const first = ref('first', '2024-01-01T00:00:00.000Z');
    const anchor = ref('anchor', '2024-01-02T00:00:00.000Z');
    const next = ref('next', '2024-01-03T00:00:00.000Z');
    const last = ref('last', '2024-01-04T00:00:00.000Z');
    const current = refPage([first, anchor], 0, 2, 4);
    query.args = { query: 'public', page: 0, size: 2, sort: ['published,ASC'] };
    query.page = current;
    component.page = current;
    refs.page.mockReturnValue(of(refPage([anchor, next, last], 0, 3, 3)));

    component.cursorPage(1);
    (query.queueCursorPage.mock.calls[0][1] as Observable<Page<Ref>>)
      .subscribe(() => {});

    expect(refs.page.mock.calls[0][0]).toMatchObject({
      sort: ['published,ASC', 'modified,ASC', 'origin,ASC'],
      publishedAfter: '2024-01-01T23:59:59.999Z',
    });
  });

  it('falls back to the offset request when the cursor cannot reconstruct the page', () => {
    const first = ref('first', '2024-01-02T00:00:00.000Z');
    const anchor = ref('anchor', '2024-01-02T00:00:00.000Z');
    const offset = refPage([ref('next', '2024-01-01T00:00:00.000Z')], 1, 2, 3);
    const current = refPage([first, anchor], 0, 2, 3);
    query.args = { query: 'public', page: 0, size: 2, sort: ['published,DESC'] };
    query.page = current;
    component.page = current;
    refs.page.mockImplementation((args: RefPageArgs) => of(
      args.publishedBefore ? refPage([], 0, 11, 0) : offset,
    ));

    component.cursorPage(1);
    let result: Page<Ref> | undefined;
    (query.queueCursorPage.mock.calls[0][1] as Observable<Page<Ref>>)
      .subscribe(page => result = page);

    expect(refs.page).toHaveBeenCalledTimes(2);
    expect(refs.page.mock.calls[1][0]).toEqual({ ...query.args, page: 1 });
    expect(result).toBe(offset);
  });

  it('does not queue cursors for unrelated pages, sorts, or modified clicks', () => {
    const current = refPage([ref('first', '2024-01-02T00:00:00.000Z')], 0, 1, 2);
    query.args = { query: 'public', page: 0, size: 1, sort: ['title,ASC'] };
    query.page = current;
    component.page = current;

    component.cursorPage(1);
    expect(query.queueCursorPage).not.toHaveBeenCalled();

    query.args = { ...query.args, sort: ['published,DESC'] };
    component.cursorPage(1, new MouseEvent('click', { ctrlKey: true }));
    expect(query.queueCursorPage).not.toHaveBeenCalled();

    component.page = refPage([...current.content], 0, 1, 2);
    component.cursorPage(1);
    expect(query.queueCursorPage).not.toHaveBeenCalled();
  });
});

function ref(
  url: string,
  published?: string,
  created?: string,
  modified = published,
  origin = '',
): Ref {
  return {
    url: `https://example.com/${url}`,
    origin,
    published: published ? DateTime.fromISO(published) : undefined,
    created: created ? DateTime.fromISO(created) : undefined,
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
