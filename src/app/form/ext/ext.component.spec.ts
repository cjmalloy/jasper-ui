/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { JasperFormlyModule } from '../../formly/formly.module';

import { ExtFormComponent } from './ext.component';

describe('ExtFormComponent', () => {
  let component: ExtFormComponent;
  let fixture: ComponentFixture<ExtFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ReactiveFormsModule,
        JasperFormlyModule,
        forwardRef(() => ExtFormComponent),
      ],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ExtFormComponent);
    component = fixture.componentInstance;
    component.group = new UntypedFormGroup({
      tag: new UntypedFormControl(),
      name: new UntypedFormControl(),
      config: new UntypedFormGroup({}),
    });
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('adds, updates, and removes multiple default sorts', () => {
    component.config.addControl('defaultSort', new FormControl<string[]>([], { nonNullable: true }));
    const select = document.createElement('select');

    component.addSort('published', select);
    component.addSort('modified', select);
    component.setSortDir(0, 'DESC');

    expect(component.defaultSort.value).toEqual(['published,DESC', 'modified,DESC']);

    component.removeSort(0);
    expect(component.defaultSort.value).toEqual(['modified,DESC']);
  });

  it('adds, toggles, dates, and removes multiple default filters', () => {
    component.config.addControl('defaultFilter', new FormControl<string[]>([], { nonNullable: true }));
    const select = document.createElement('select');

    component.addFilter('query/public', select);
    component.addFilter('published/before/2026-07-10T03:00:00.000Z', select);
    component.toggleFilter(0);
    component.setFilterDate(1, component.defaultFilter.value[1], '2026-07-09T12:30');

    expect(component.defaultFilter.value[0]).toBe('query/!(public)');
    expect(component.defaultFilter.value[1]).toContain('published/before/2026-07-09T12:30');

    component.removeFilter(0);
    expect(component.defaultFilter.value).toHaveLength(1);
  });

  it('includes date filters in the available default filters', () => {
    expect(component.allFilters.map(filter => filter.filter)).toEqual(expect.arrayContaining([
      expect.stringMatching(/^modified\/before\//),
      expect.stringMatching(/^response\/after\//),
      expect.stringMatching(/^published\/before\//),
      expect.stringMatching(/^created\/after\//),
    ]));
  });
});
