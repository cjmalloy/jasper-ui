/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Page } from '../../../model/page';
import { Ref } from '../../../model/ref';
import { AdminService } from '../../../service/admin.service';
import { RefService } from '../../../service/api/ref.service';
import { QueryStore } from '../../../store/query';

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
      vi.spyOn(TestBed.inject(RefService), 'page').mockReturnValue(of(refPage(1, ['c', 'd'])));
      component.newRefs.set([{ url: 'c', origin: '' } as Ref]);
      expect(component.hasMore()).toBe(true);
      component.loadMore();
      expect(component.moreRefs().map(r => r.url)).toEqual(['d']);
    });
  });
});
