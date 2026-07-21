/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Page } from '../../model/page';
import { Ref } from '../../model/ref';

import { BulkComponent } from './bulk.component';

describe('BulkComponent', () => {
  let component: BulkComponent;
  let fixture: ComponentFixture<BulkComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BulkComponent],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BulkComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('uses only checked refs for bulk urls', () => {
    const checked = { url: 'checked', origin: 'origin' } as Ref;
    const unchecked = { url: 'unchecked', origin: 'origin' } as Ref;
    component.query.page = Page.of([checked, unchecked]);
    component.query.setBulkToolsOpen(true);
    component.query.setBulkSelected(unchecked, false);

    expect(component.urls).toEqual(['checked']);
  });

  it('runs batch actions only on checked refs', () => {
    const checked = { url: 'checked', origin: 'origin' } as Ref;
    const unchecked = { url: 'unchecked', origin: 'origin' } as Ref;
    const urls: string[] = [];
    component.query.page = Page.of([checked, unchecked]);
    component.query.setBulkToolsOpen(true);
    component.query.setBulkSelected(unchecked, false);

    component.batch$<Ref>(ref => {
      urls.push(ref.url);
      return of(null);
    }).subscribe();

    expect(urls).toEqual(['checked']);
  });

  it('is empty when all refs are unchecked', () => {
    const ref = { url: 'unchecked', origin: 'origin' } as Ref;
    component.query.page = Page.of([ref]);
    component.query.setBulkToolsOpen(true);
    component.query.setBulkSelected(ref, false);

    expect(component.empty).toBe(true);
  });
});
