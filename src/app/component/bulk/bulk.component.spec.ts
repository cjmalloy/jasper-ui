/// <reference types="vitest/globals" />
import { HttpErrorResponse, provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, throwError } from 'rxjs';
import { Ext } from '../../model/ext';
import { Page } from '../../model/page';
import { Ref } from '../../model/ref';
import { ExtStore } from '../../store/ext';
import { QueryStore } from '../../store/query';

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
        { provide: QueryStore, useValue: { page: signal<Page<Ref> | undefined>(undefined), refresh: vi.fn() } },
        { provide: ExtStore, useValue: { page: signal<Page<Ext> | undefined>(undefined), refresh: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BulkComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('switches query stores immediately when type changes', () => {
    expect(component.queryStore()).toBe(component.query);
    fixture.componentRef.setInput('type', 'ext');
    expect(component.queryStore()).toBe(component.ext);
  });

  it('cancels obsolete defaults requests', async () => {
    const first = new Subject<any>();
    const second = new Subject<any>();
    vi.spyOn(component['refs'], 'getDefaults').mockImplementation((...tags) => tags.includes('first') ? first : second);
    fixture.componentRef.setInput('viewExt', { tag: 'first' });
    TestBed.tick();
    expect(first.observed).toBe(true);
    fixture.componentRef.setInput('viewExt', { tag: 'second' });
    TestBed.tick();
    expect(first.observed).toBe(false);
    second.next({ ref: { title: 'Latest defaults' } });
    await vi.waitFor(() => expect(component.defaults()?.title).toBe('Latest defaults'));
  });

  it('renders a defaults request failure without throwing', async () => {
    vi.spyOn(component['refs'], 'getDefaults').mockReturnValue(throwError(() =>
      new HttpErrorResponse({ status: 500, statusText: 'Defaults unavailable' })));
    fixture.componentRef.setInput('viewExt', { tag: 'failed-defaults' });
    TestBed.tick();
    await vi.waitFor(() => expect(component.defaultsError().length).toBeGreaterThan(0));
    expect(component.defaults()).toBeUndefined();
    expect(() => fixture.detectChanges()).not.toThrow();
  });

  it('derives common action tags from the selected store', () => {
    const actions = vi.spyOn(component.admin, 'getActions').mockReturnValue([]);
    (component.query.page as WritableSignal<Page<Ref> | undefined>).set(Page.of([{ url: 'https://example.com', tags: ['ref-topic'] }]));
    component.actions();
    expect(actions).toHaveBeenLastCalledWith(['ref-topic']);
    (component.ext.page as WritableSignal<Page<Ext> | undefined>).set(Page.of([{ tag: 'ext-topic' }]));
    fixture.componentRef.setInput('type', 'ext');
    component.actions();
    expect(actions).toHaveBeenLastCalledWith([]);
  });
});
