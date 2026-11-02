/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { FilterComponent } from './filter.component';

describe('FilterComponent', () => {
  let component: FilterComponent;
  let fixture: ComponentFixture<FilterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FilterComponent],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(FilterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('value filters', () => {
    it('replaces the value and keeps the sort column', () => {
      component.filters.set(['query/science', 'tags->plugin/duration:dur/before/pt5m']);
      component.setValue(1, 'tags->plugin/duration:dur/before/pt5m', ' pt1h ');
      expect(component.filters()).toEqual(['query/science', 'tags->plugin/duration:dur/before/pt1h']);
    });

    it('ignores an empty value', () => {
      component.filters.set(['plugins->_plugin/cache->contentLength:num/after/1000']);
      component.setValue(0, 'plugins->_plugin/cache->contentLength:num/after/1000', '');
      expect(component.filters()).toEqual(['plugins->_plugin/cache->contentLength:num/after/1000']);
    });

    it('ignores a value with /', () => {
      component.filters.set(['plugins->_plugin/cache->contentLength:num/after/1000']);
      component.setValue(0, 'plugins->_plugin/cache->contentLength:num/after/1000', '1/2');
      expect(component.filters()).toEqual(['plugins->_plugin/cache->contentLength:num/after/1000']);
    });
  });

  describe('toDate', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-07-09T23:36:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('parses now case-insensitively', () => {
      expect(component.toDate('published/before/NoW')).toBe('2026-07-09T23:36');
    });

    it('subtracts ISO durations case-insensitively', () => {
      expect(component.toDate('published/after/p1d')).toBe('2026-07-08T23:36');
    });

    it('parses standard ISO timestamps', () => {
      expect(component.toDate('published/before/2025-01-02T03:04:00Z')).toBe('2025-01-02T03:04');
    });

    it('returns an empty value for malformed input', () => {
      expect(component.toDate('published/before/P-invalid')).toBe('');
      expect(component.toDate('published/before/not-a-date')).toBe('');
    });
  });
});
