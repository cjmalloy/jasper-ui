/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DateTime } from 'luxon';
import { MarkdownModule } from 'ngx-markdown';

import { GridCellComponent } from './grid-cell.component';
import { GridComponent } from './grid.component';

describe('GridComponent', () => {
  let component: GridComponent;
  let fixture: ComponentFixture<GridComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GridComponent, MarkdownModule.forRoot()],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GridComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
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
});
