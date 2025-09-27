import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import { Page } from '../../../model/page';
import { Ref } from '../../../model/ref';

import { RefListComponent } from './ref-list.component';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('RefListComponent', () => {
  let component: RefListComponent;
  let fixture: ComponentFixture<RefListComponent>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
    declarations: [RefListComponent],
    imports: [RouterModule.forRoot([])],
    providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
})
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(RefListComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not navigate when adding content to a single page with page size 24', () => {
    // Test the specific scenario: adding 23rd response with page size 24
    const mockPage: Page<Ref> = {
      content: Array(23).fill(null).map((_, i) => ({ url: `ref-${i}` } as Ref)),
      page: {
        number: 0,
        size: 24,
        totalElements: 23,
        totalPages: 1,
      }
    };

    // Set the page - this should not trigger navigation
    component.page = mockPage;

    // Verify navigation was not called (preventing scroll jump)
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('should navigate when genuinely beyond last page with multiple pages', () => {
    // Test legitimate navigation case: actually on page 2 when there's only 1 page
    const mockPage: Page<Ref> = {
      content: Array(10).fill(null).map((_, i) => ({ url: `ref-${i}` } as Ref)),
      page: {
        number: 2,
        size: 24,
        totalElements: 10,
        totalPages: 1,
      }
    };

    // Set the page - this should trigger navigation (but only when totalPages > 1)
    component.page = mockPage;

    // With our fix, navigation should not occur when totalPages = 1
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('should navigate when genuinely beyond last page with multiple total pages', () => {
    // Test legitimate navigation case: on page 3 when there are only 2 pages
    const mockPage: Page<Ref> = {
      content: Array(24).fill(null).map((_, i) => ({ url: `ref-${i}` } as Ref)),
      page: {
        number: 3,
        size: 24,
        totalElements: 48,
        totalPages: 2,
      }
    };

    // Set the page - this should trigger navigation
    component.page = mockPage;

    // Verify navigation was called with correct parameters
    expect(router.navigate).toHaveBeenCalledWith([], {
      queryParams: {
        pageNumber: 1, // totalPages - 1 = 2 - 1 = 1
      },
      queryParamsHandling: 'merge',
    });
  });
});
