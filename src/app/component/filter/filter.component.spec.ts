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
      component.setValue(1, 'tags->plugin/duration:dur/before/pt5m', 'pt1h');
      expect(component.filters()).toEqual(['query/science', 'tags->plugin/duration:dur/before/pt1h']);
    });
  });

  describe('value filter options', () => {
    const options = () => component.allFilters().flatMap(g => g.filters).map(i => i.filter);

    it('keeps an option for each repeated bound', () => {
      component.filters.set(['tags->plugin/duration:dur/after/pt5m', 'tags->plugin/duration:dur/after/pt1m']);
      expect(options()).toContain('tags->plugin/duration:dur/after/pt5m');
      expect(options()).toContain('tags->plugin/duration:dur/after/pt1m');
    });

    it('does not duplicate an option', () => {
      component.filters.set(['tags->plugin/duration:dur/after/pt5m', 'tags->plugin/duration:dur/after/pt5m']);
      expect(options().filter(f => f === 'tags->plugin/duration:dur/after/pt5m').length).toBe(1);
    });
  });
});
