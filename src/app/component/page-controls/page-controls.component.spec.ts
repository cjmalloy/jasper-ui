/// <reference types="vitest/globals" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DateTime } from 'luxon';
import { of } from 'rxjs';
import { Page } from '../../model/page';
import { Ref, RefPageArgs } from '../../model/ref';
import { RefService } from '../../service/api/ref.service';
import { QueryStore } from '../../store/query';

import { PageControlsComponent } from './page-controls.component';

describe('PageControlsComponent', () => {
  let component: PageControlsComponent;
  let fixture: ComponentFixture<PageControlsComponent>;
  let query: { args?: RefPageArgs, page?: Page<Ref> };
  let refs: { page: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    query = {};
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

  it('secretly reloads a published page from its date cursor', () => {
    const duplicate = ref('duplicate', '2024-01-02T00:00:00.000Z');
    const anchor = ref('anchor', '2024-01-02T00:00:00.000Z');
    const older = ref('older', '2024-01-01T00:00:00.000Z');
    const requested = refPage([anchor, older], 1, 2, 4);
    refs.page.mockReturnValue(of(refPage([duplicate, anchor, older], 0, 10, 3)));
    query.args = { query: 'public', page: 1, size: 2, sort: ['published,DESC'] };
    query.page = requested;

    component.page = requested;

    expect(refs.page).toHaveBeenCalledOnce();
    expect(refs.page.mock.calls[0][0]).toMatchObject({
      query: 'public',
      page: 0,
      size: 10,
      sort: ['published,DESC', 'modified,ASC', 'origin,ASC'],
      publishedBefore: '2024-01-02T00:00:00.001Z',
    });
    expect(query.args).toEqual({ query: 'public', page: 1, size: 2, sort: ['published,DESC'] });
    expect(query.page).toEqual(refPage([anchor, older], 1, 2, 4));
  });

  it('expands the cursor page to find duplicate created dates', () => {
    const anchor = ref('anchor', undefined, '2024-01-02T00:00:00.000Z');
    const older = ref('older', undefined, '2024-01-01T00:00:00.000Z');
    const requested = refPage([anchor, older], 2, 2, 6);
    refs.page.mockImplementation((args: RefPageArgs) => {
      if (args.size === 10) {
        return of(refPage(Array.from({ length: 10 }, (_, i) =>
          ref(`duplicate-${i}`, undefined, '2024-01-02T00:00:00.000Z')
        ), 0, 10, 20));
      }
      return of(refPage([
        ...Array.from({ length: 10 }, (_, i) =>
          ref(`duplicate-${i}`, undefined, '2024-01-02T00:00:00.000Z')
        ),
        anchor,
        older,
      ], 0, 20, 20));
    });
    query.args = { query: 'public', page: 2, size: 2, sort: ['created,DESC'] };
    query.page = requested;

    component.page = requested;

    expect(refs.page).toHaveBeenCalledTimes(2);
    expect(refs.page.mock.calls[0][0]).toMatchObject({
      page: 0,
      size: 10,
      sort: ['created,DESC', 'modified,ASC', 'origin,ASC'],
      createdBefore: '2024-01-02T00:00:00.001Z',
    });
    expect(refs.page.mock.calls[1][0]).toMatchObject({
      page: 0,
      size: 20,
      sort: ['created,DESC', 'modified,ASC', 'origin,ASC'],
      createdBefore: '2024-01-02T00:00:00.001Z',
    });
    expect(query.page?.content).toEqual([anchor, older]);
    expect(query.page?.page).toEqual(requested.page);
  });

  it('uses an after cursor for ascending date sorts', () => {
    const anchor = ref('anchor', '2024-01-01T00:00:00.000Z');
    const newer = ref('newer', '2024-01-02T00:00:00.000Z');
    const requested = refPage([anchor, newer], 1, 2, 4);
    refs.page.mockReturnValue(of(refPage([anchor, newer], 0, 10, 2)));
    query.args = { query: 'public', page: 1, size: 2, sort: ['published,ASC'] };
    query.page = requested;

    component.page = requested;

    expect(refs.page.mock.calls[0][0]).toMatchObject({
      page: 0,
      sort: ['published,ASC', 'modified,ASC', 'origin,ASC'],
      publishedAfter: '2023-12-31T23:59:59.999Z',
    });
  });

  it('keeps regular paging for the first page and non-date sorts', () => {
    const requested = refPage([ref('anchor', '2024-01-01T00:00:00.000Z')], 0, 1, 2);
    query.args = { query: 'public', page: 0, size: 1, sort: ['published,DESC'] };
    query.page = requested;

    component.page = requested;
    expect(refs.page).not.toHaveBeenCalled();

    const secondPage = refPage([ref('other')], 1, 1, 2);
    query.args = { query: 'public', page: 1, size: 1, sort: ['title,ASC'] };
    query.page = secondPage;
    component.page = secondPage;

    expect(refs.page).not.toHaveBeenCalled();
  });
});

function ref(url: string, published?: string, created?: string): Ref {
  return {
    url: `https://example.com/${url}`,
    origin: '',
    published: published ? DateTime.fromISO(published) : undefined,
    created: created ? DateTime.fromISO(created) : undefined,
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
