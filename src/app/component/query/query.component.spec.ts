/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { provideRouter, Router } from '@angular/router';

import { QueryComponent } from './query.component';

describe('QueryComponent', () => {
  let component: QueryComponent;
  let fixture: ComponentFixture<QueryComponent>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormsModule, QueryComponent],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(QueryComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should clean and format query string correctly', () => {
    component.search('Test Query! with#Special@Characters');

    // Check that navigation was called with a cleaned query
    expect(router.navigate).toHaveBeenCalled();
    const navigateCall = vi.mocked(router.navigate).mock.calls[0];
    // The actual cleaning keeps ! and @ characters, removes # and spaces become +
    expect(navigateCall[0]).toEqual(['/tag', 'test+query!+withspecial@characters']);
  });
});
