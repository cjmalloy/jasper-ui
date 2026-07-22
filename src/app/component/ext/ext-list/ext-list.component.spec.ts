/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Ext } from '../../../model/ext';
import { Page } from '../../../model/page';

import { ExtListComponent } from './ext-list.component';

describe('ExtListComponent', () => {
  let component: ExtListComponent;
  let fixture: ComponentFixture<ExtListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [forwardRef(() => ExtListComponent)],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExtListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows checked Ext bulk-selection cells in the grid', () => {
    const ext = { tag: 'selected', origin: '' } as Ext;
    const page = Page.of([ext]);
    component.query.page = page;
    fixture.componentRef.setInput('page', page);
    component.query.setBulkToolsOpen(true);
    fixture.detectChanges();

    const checkbox = fixture.nativeElement.querySelector('.bulk-select') as HTMLInputElement;
    expect(component.gridTemplateColumns).toBe('min-content min-content auto');
    expect(checkbox.checked).toBe(true);
  });
});
