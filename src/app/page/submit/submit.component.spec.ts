/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';

import { SubmitPage } from './submit.component';

describe('SubmitPage', () => {
  let component: SubmitPage;
  let fixture: ComponentFixture<SubmitPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ReactiveFormsModule,
        forwardRef(() => SubmitPage),
      ],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            params: of({}),
            queryParams: of({}),
            snapshot: { params: {}, queryParams: {} }
          }
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SubmitPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('queues submission until async validation completes', () => {
    const validation = new Subject<null>();
    component.url.setAsyncValidators(() => validation);
    component.url.setValue('https://example.com');
    const navigate = vi.spyOn(component['router'], 'navigate');

    component.submit();

    expect(navigate).not.toHaveBeenCalled();
    validation.next(null);
    validation.complete();
    expect(navigate).toHaveBeenCalled();
  });

  it('does not submit an invalid link', () => {
    component.url.setAsyncValidators(() => of({ invalid: true }));
    component.url.setValue('not a link');
    const navigate = vi.spyOn(component['router'], 'navigate');

    component.submit();

    expect(navigate).not.toHaveBeenCalled();
  });
});
