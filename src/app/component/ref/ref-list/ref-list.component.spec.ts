/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Ext } from '../../../model/ext';
import { Page } from '../../../model/page';
import { Ref } from '../../../model/ref';

import { RefListComponent } from './ref-list.component';

describe('RefListComponent', () => {
  let component: RefListComponent;
  let fixture: ComponentFixture<RefListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [forwardRef(() => RefListComponent)],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RefListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows bulk-selection checkboxes when bulk tools are open without configured columns', () => {
    const ref = { url: 'https://example.com', origin: '' } as Ref;
    const page = Page.of([ref]);
    component.query.page = page;
    component.page = page;
    component.query.setBulkToolsOpen(true);

    expect(component.bulkSelectable).toBe(true);
    expect(component.gridTemplateColumns).toBe('min-content min-content auto');
  });

  it('disables bulk-selection checkboxes when columns are configured', () => {
    const ref = { url: 'https://example.com', origin: '' } as Ref;
    const page = Page.of([ref]);
    const ext = { config: { defaultCols: 0 } } as Ext;
    component.query.page = page;
    component.ext = ext;
    component.page = page;
    component.query.setBulkToolsOpen(true);

    expect(component.hasConfiguredColumns).toBe(true);
    expect(component.bulkSelectable).toBe(false);
    expect(component.gridTemplateColumns).toBe('');
  });
});
