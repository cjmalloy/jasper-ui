import { NO_ERRORS_SCHEMA } from '@angular/core';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { QueryComponent } from './query.component';

describe('QueryComponent', () => {
  let component: QueryComponent;
  let fixture: ComponentFixture<QueryComponent>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QueryComponent],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(QueryComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should clean and format query string correctly', () => {
    component.search('Test Query! with#Special@Characters');

    // Check that navigation was called with a cleaned query
    expect(router.navigate).toHaveBeenCalled();
    const navigateSpy = router.navigate as jasmine.Spy;
    const navigateCall = navigateSpy.calls.mostRecent().args;
    // The actual cleaning keeps ! and @ characters, removes # and spaces become +
    expect(navigateCall[0]).toEqual(['/tag', 'test+query!+withspecial@characters']);
  });
});
