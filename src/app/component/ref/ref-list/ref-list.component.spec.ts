/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of } from 'rxjs';
import { Page } from '../../../model/page';
import { Ref } from '../../../model/ref';
import { AdminService } from '../../../service/admin.service';
import { RefService } from '../../../service/api/ref.service';
import { QueryStore } from '../../../store/query';
import { Store } from '../../../store/store';

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

  describe('infinite scroll', () => {
    const refPage = (number: number, urls: string[]): Page<Ref> => ({
      content: urls.map(url => ({ url, origin: '' } as Ref)),
      page: { number, size: 2, totalElements: 6, totalPages: 3 },
    });
    const first = refPage(0, ['a', 'b']);

    beforeEach(() => {
      vi.spyOn(TestBed.inject(AdminService), 'getTemplate').mockReturnValue({ tag: 'config/infinite' } as any);
      TestBed.runInInjectionContext(() => TestBed.inject(QueryStore).show(() => first));
      fixture = TestBed.createComponent(RefListComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('page', first);
    });

    it('should not offer more pages without query args', () => {
      expect(component.hasMore()).toBe(false);
    });

    it('should not duplicate live replies in appended pages', () => {
      TestBed.runInInjectionContext(() => TestBed.inject(QueryStore).watch(() => ({ query: 'test' })));
      vi.spyOn(TestBed.inject(QueryStore), 'pageArgs').mockReturnValue({ query: 'test' });
      vi.spyOn(TestBed.inject(RefService), 'page').mockReturnValue(of(refPage(1, ['c', 'd'])));
      component.newRefs.set([{ url: 'c', origin: '' } as Ref]);
      expect(component.hasMore()).toBe(true);
      component.loadMore();
      expect(component.moreRefs().map(r => r.url)).toEqual(['d']);
    });

    describe('with query args', () => {
      let query: QueryStore;
      let requests: Subject<Page<Ref>>[];

      beforeEach(() => {
        query = TestBed.inject(QueryStore);
        TestBed.runInInjectionContext(() => query.watch(() => ({ query: 'test' })));
        vi.spyOn(query, 'pageArgs').mockReturnValue({ query: 'test' });
        requests = [];
        vi.spyOn(TestBed.inject(RefService), 'page').mockImplementation(() => {
          const request = new Subject<Page<Ref>>();
          requests.push(request);
          return request;
        });
      });

      it('should not offer more pages while a search reloads', () => {
        vi.mocked(query.pageArgs).mockReturnValue({ query: 'test', search: 'old' });
        expect(component.hasMore()).toBe(false);
      });

      it('should ignore stale responses after the page changes', () => {
        component.loadMore();
        const second = refPage(0, ['e', 'f']);
        TestBed.runInInjectionContext(() => query.show(() => second));
        fixture.componentRef.setInput('page', second);
        component.loadMore();
        requests[0].next(refPage(1, ['x', 'y']));
        expect(component.loadingMore()).toBe(true);
        requests[1].next(refPage(1, ['c', 'd']));
        expect(component.moreRefs().map(r => r.url)).toEqual(['c', 'd']);
      });

      it('should let the infinite query param override the ext config', () => {
        fixture.componentRef.setInput('ext', { tag: 'test', config: { defaultInfinite: false } });
        expect(component.infiniteScroll()).toBe(false);
        vi.spyOn(TestBed.inject(Store).view, 'infinite').mockReturnValue(true);
        fixture.componentRef.setInput('ext', { tag: 'test', config: { defaultInfinite: false } });
        expect(component.infiniteScroll()).toBe(true);
      });
    });
  });
});
