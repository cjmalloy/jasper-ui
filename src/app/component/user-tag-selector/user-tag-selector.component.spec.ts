import { NO_ERRORS_SCHEMA } from '@angular/core';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthInterceptor } from '../../http/auth.interceptor';

import { UserTagSelectorComponent } from './user-tag-selector.component';

describe('UserTagSelectorComponent', () => {
  let component: UserTagSelectorComponent;
  let fixture: ComponentFixture<UserTagSelectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserTagSelectorComponent],
      providers: [
        AuthInterceptor,
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(UserTagSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
