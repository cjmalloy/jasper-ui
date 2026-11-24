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
      TestBed.runInInjectionContext(() => TestBed.inject(QueryStore).show(() => first));
      fixture = TestBed.createComponent(RefListComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('page', first);
      fixture.componentRef.setInput('ext', { tag: 'test', config: { defaultInfinite: true } });
    });

    it('should keep page controls for lists without query args', () => {
      vi.spyOn(TestBed.inject(Store).view, 'infinite').mockReturnValue(true);
      fixture.componentRef.setInput('ext', { tag: 'test', config: { defaultInfinite: true } });
      fixture.detectChanges();
      expect(component.infiniteScroll()).toBe(false);
      expect(component.hasMore()).toBe(false);
      expect(fixture.nativeElement.querySelector('app-page-controls:not(.infinite-controls)')).toBeTruthy();
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

      it('should be off unless a template enables it', () => {
        fixture.componentRef.setInput('ext', { tag: 'test', config: {} });
        expect(component.infiniteScroll()).toBe(false);
        vi.spyOn(TestBed.inject(AdminService), 'getDefaults').mockReturnValue({ defaultInfinite: true });
        fixture.componentRef.setInput('ext', { tag: 'test', modifiedString: '1', config: {} });
        expect(component.infiniteScroll()).toBe(true);
      });

      it('should drop appended pages when infinite scroll is disabled', () => {
        component.loadMore();
        requests[0].next(refPage(1, ['c', 'd']));
        expect(component.moreRefs().map(r => r.url)).toEqual(['c', 'd']);
        vi.spyOn(TestBed.inject(Store).view, 'infinite').mockReturnValue(false);
        fixture.componentRef.setInput('ext', { tag: 'test', config: { defaultInfinite: true } });
        expect(component.moreRefs()).toEqual([]);
      });

      it('should retry after a failed request', () => {
        component.loadMore();
        requests[0].error(new Error());
        expect(component.loadMoreError()).toBe(true);
        expect(component.hasMore()).toBe(false);
        component.retryMore();
        expect(requests.length).toBe(2);
        requests[1].next(refPage(1, ['c', 'd']));
        expect(component.loadMoreError()).toBe(false);
        expect(component.moreRefs().map(r => r.url)).toEqual(['c', 'd']);
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

      it('should let sub tag templates override the default ext config', () => {
        const admin = TestBed.inject(AdminService);
        vi.spyOn(admin, 'status').mockReturnValue({ templates: {
          'plugin/image': { tag: 'plugin/image', defaults: { defaultInfinite: true } },
          'plugin/image/masonry': { tag: 'plugin/image/masonry', defaults: { defaultInfinite: false } },
        } } as any);
        fixture.componentRef.setInput('ext', { tag: 'plugin/image', config: { defaultInfinite: true } });
        expect(component.infiniteScroll()).toBe(false);
      });

      it('should prefer a saved ext over sub tag templates', () => {
        const admin = TestBed.inject(AdminService);
        vi.spyOn(admin, 'status').mockReturnValue({ templates: {
          'plugin/image/masonry': { tag: 'plugin/image/masonry', defaults: { defaultInfinite: false } },
        } } as any);
        fixture.componentRef.setInput('ext', { tag: 'plugin/image', modifiedString: '1', config: { defaultInfinite: true } });
        expect(component.infiniteScroll()).toBe(true);
      });
    });
  });
});
