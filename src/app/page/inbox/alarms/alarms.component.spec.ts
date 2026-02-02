import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef, NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { InboxAlarmsPage } from './alarms.component';

describe('InboxAlarmsPage', () => {
  let component: InboxAlarmsPage;
  let fixture: ComponentFixture<InboxAlarmsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [forwardRef(() => InboxAlarmsPage)],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    fixture = TestBed.createComponent(InboxAlarmsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
