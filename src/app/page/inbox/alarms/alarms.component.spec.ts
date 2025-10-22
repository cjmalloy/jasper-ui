import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { InboxAlarmsPage } from './alarms.component';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('InboxAlarmsPage', () => {
  let component: InboxAlarmsPage;
  let fixture: ComponentFixture<InboxAlarmsPage>;

  beforeEach(() => {
    TestBed.configureTestingModule({
    imports: [RouterModule.forRoot([]), InboxAlarmsPage],
    providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
});
    fixture = TestBed.createComponent(InboxAlarmsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
