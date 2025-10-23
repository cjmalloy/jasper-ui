/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { InboxAlarmsPage } from './alarms.component';

describe('InboxAlarmsPage', () => {
  let component: InboxAlarmsPage;
  let fixture: ComponentFixture<InboxAlarmsPage>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [InboxAlarmsPage],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    fixture = TestBed.createComponent(InboxAlarmsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
