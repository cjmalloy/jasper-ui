/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DateTime } from 'luxon';

import { GridComponent } from './grid.component';

describe('GridComponent', () => {
  let component: GridComponent;
  let fixture: ComponentFixture<GridComponent>;

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

  describe('applyFormatters', () => {
    it('should add valueFormatter and filter to a published column', () => {
      const cols = [{ headerName: 'Published', field: 'published' }];
      const result = component.applyFormatters(cols);
      expect(result[0].filter).toBe('agDateColumnFilter');
      expect(typeof result[0].valueFormatter).toBe('function');
    });

    it('should not modify non-published columns', () => {
      const cols = [{ headerName: 'Title', field: 'title' }];
      const result = component.applyFormatters(cols);
      expect(result[0].valueFormatter).toBeUndefined();
      expect(result[0].filter).toBeUndefined();
    });

    it('should preserve existing filter on published column', () => {
      const cols = [{ headerName: 'Published', field: 'published', filter: 'myFilter' }];
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
      component.ext = { tag: 'grid', config: { columnDefs: [{ headerName: 'Published', field: 'published' }] } } as any;
      const defs = component.columnDefs;
      expect(typeof defs[0].valueFormatter).toBe('function');
    });
  });
});
