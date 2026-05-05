/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DateTime } from 'luxon';

import { Page } from '../../model/page';
import { Ref } from '../../model/ref';
import { GridCellComponent } from './grid-cell/grid-cell.component';
import { GridComponent } from './grid.component';

describe('GridComponent', () => {
  let component: GridComponent;
  let fixture: ComponentFixture<GridComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GridComponent],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GridComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('formatDate', () => {
    it('should format a Luxon DateTime as a localized date/time string', () => {
      const dt = DateTime.fromISO('2024-06-15T10:30:00.000Z');
      const result = component.formatDate(dt);
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should format a Luxon DateTime with a custom format', () => {
      const dt = DateTime.fromISO('2024-06-15T10:30:00.000Z');
      const result = component.formatDate(dt, DateTime.DATE_SHORT);
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should return empty string for null', () => {
      expect(component.formatDate(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect(component.formatDate(undefined)).toBe('');
    });

    it('should return empty string for non-DateTime value', () => {
      expect(component.formatDate('2024-06-15')).toBe('');
      expect(component.formatDate(12345)).toBe('');
    });
  });

  describe('formatDateString', () => {
    it('should format a valid ISO date string', () => {
      const result = component.formatDateString('2024-06-15T10:30:00.000Z');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should format a valid ISO date string with a custom format', () => {
      const result = component.formatDateString('2024-06-15T10:30:00.000Z', DateTime.DATE_SHORT);
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should return empty string for an invalid ISO string', () => {
      expect(component.formatDateString('not-a-date')).toBe('');
    });

    it('should return empty string for non-string values', () => {
      expect(component.formatDateString(null)).toBe('');
      expect(component.formatDateString(undefined)).toBe('');
      expect(component.formatDateString(12345)).toBe('');
    });
  });

  describe('applyFormatters', () => {
    it('should add valueFormatter and filter to a dateTime column', () => {
      const cols = [{ headerName: 'Published', field: 'published', type: 'dateTime' }];
      const result = component.applyFormatters(cols);
      expect(result[0].filter).toBe('agDateColumnFilter');
      expect(typeof result[0].valueFormatter).toBe('function');
    });

    it('should add valueFormatter and filter to a date column', () => {
      const cols = [{ headerName: 'Date', field: 'someDate', type: 'date' }];
      const result = component.applyFormatters(cols);
      expect(result[0].filter).toBe('agDateColumnFilter');
      expect(typeof result[0].valueFormatter).toBe('function');
    });

    it('should add valueFormatter and filter to a dateTimeString column', () => {
      const cols = [{ headerName: 'Created', field: 'plugin/custom.created', type: 'dateTimeString' }];
      const result = component.applyFormatters(cols);
      expect(result[0].filter).toBe('agDateColumnFilter');
      expect(typeof result[0].valueFormatter).toBe('function');
    });

    it('should add valueFormatter and filter to a dateString column', () => {
      const cols = [{ headerName: 'Date', field: 'plugin/custom.date', type: 'dateString' }];
      const result = component.applyFormatters(cols);
      expect(result[0].filter).toBe('agDateColumnFilter');
      expect(typeof result[0].valueFormatter).toBe('function');
    });

    it('should not modify columns without a date type', () => {
      const cols = [{ headerName: 'Title', field: 'title' }];
      const result = component.applyFormatters(cols);
      expect(result[0].valueFormatter).toBeUndefined();
      expect(result[0].filter).toBeUndefined();
    });

    it('should add the custom grid cell renderer to a url column', () => {
      const cols = [{ headerName: 'Url', field: 'url', type: 'url' }];
      const result = component.applyFormatters(cols);
      expect(result[0].cellRenderer).toBe(GridCellComponent);
      expect(result[0].autoHeight).toBe(false);
    });

    it('should add the custom grid cell renderer and auto height to rich content columns', () => {
      const cols = [{ headerName: 'Comment', field: 'comment', type: 'markdown' }];
      const result = component.applyFormatters(cols);
      expect(result[0].cellRenderer).toBe(GridCellComponent);
      expect(result[0].autoHeight).toBe(true);
      expect(result[0].wrapText).toBe(true);
    });

    it('should preserve existing filter on date type column', () => {
      const cols = [{ headerName: 'Published', field: 'published', type: 'dateTime', filter: 'myFilter' }];
      const result = component.applyFormatters(cols);
      expect(result[0].filter).toBe('myFilter');
    });
  });

  describe('columnDefs', () => {
    it('should return formatted column defs from defaultCols', () => {
      const defs = component.columnDefs;
      const published = defs.find(c => c.field === 'published');
      expect(published).toBeTruthy();
      expect(published?.filter).toBe('agDateColumnFilter');
      expect(typeof published?.valueFormatter).toBe('function');
    });

    it('should apply formatters to ext config columnDefs when provided', () => {
      component.ext = { tag: 'grid', config: { columnDefs: [{ headerName: 'Published', field: 'published', type: 'dateTime' }] } } as any;
      const defs = component.columnDefs;
      expect(typeof defs[0].valueFormatter).toBe('function');
    });
  });

  describe('page', () => {
    it('should fetch source refs for bare repost rows', () => {
      const repostRef: Ref = {
        url: 'tag:/repost/1',
        origin: '',
        tags: ['plugin/repost'],
        sources: ['https://example.com/original'],
      };
      const sourceRef: Ref = {
        url: 'https://example.com/original',
        origin: '',
        tags: ['article'],
        title: 'Original title',
      };

      component.page = Page.of([repostRef]);

      const req = http.expectOne(request =>
        request.url.endsWith('/api/v1/ref/page')
        && request.params.get('url') === sourceRef.url
        && request.params.get('size') === '1'
      );
      req.flush(Page.of([sourceRef]));

      expect(component.rowData).toEqual([expect.objectContaining({
        url: sourceRef.url,
        title: sourceRef.title,
      })]);
    });

    it('should not fetch source refs for repost rows with their own content', () => {
      const repostRef: Ref = {
        url: 'tag:/repost/1',
        origin: '',
        tags: ['plugin/repost'],
        sources: ['https://example.com/original'],
        title: 'Repost title',
      };

      component.page = Page.of([repostRef]);

      http.expectNone(request => request.url.endsWith('/api/v1/ref/page'));
      expect(component.rowData).toEqual([repostRef]);
    });

    it('should keep bare repost rows when source refs fail to load', () => {
      const repostRef: Ref = {
        url: 'tag:/repost/1',
        origin: '',
        tags: ['plugin/repost'],
        sources: ['https://example.com/original'],
      };

      component.page = Page.of([repostRef]);

      const req = http.expectOne(request =>
        request.url.endsWith('/api/v1/ref/page')
        && request.params.get('url') === repostRef.sources![0]
      );
      req.flush('server error', { status: 500, statusText: 'Server Error' });

      expect(component.rowData).toEqual([repostRef]);
    });

    it('should cancel previous bare repost source fetches when page changes', () => {
      const firstRepost: Ref = {
        url: 'tag:/repost/1',
        origin: '',
        tags: ['plugin/repost'],
        sources: ['https://example.com/first'],
      };
      const secondRepost: Ref = {
        url: 'tag:/repost/2',
        origin: '',
        tags: ['plugin/repost'],
        sources: ['https://example.com/second'],
      };
      const secondSource: Ref = {
        url: 'https://example.com/second',
        origin: '',
        tags: ['article'],
        title: 'Second original',
      };

      component.page = Page.of([firstRepost]);
      const firstReq = http.expectOne(request =>
        request.url.endsWith('/api/v1/ref/page')
        && request.params.get('url') === firstRepost.sources![0]
      );

      component.page = Page.of([secondRepost]);

      expect(firstReq.cancelled).toBe(true);
      const secondReq = http.expectOne(request =>
        request.url.endsWith('/api/v1/ref/page')
        && request.params.get('url') === secondRepost.sources![0]
      );
      secondReq.flush(Page.of([secondSource]));

      expect(component.rowData).toEqual([expect.objectContaining({
        url: secondSource.url,
        title: secondSource.title,
      })]);
    });
  });
});
