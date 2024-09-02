import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { InboxDmsPage } from '../dms/dms.component';

import { InboxReportsPage } from './reports.component';

describe('InboxReportsPage', () => {
  let component: InboxReportsPage;
  let fixture: ComponentFixture<InboxReportsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [InboxReportsPage],
      imports: [RouterModule.forRoot([])],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting()]
    }).compileComponents();

    fixture = TestBed.createComponent(InboxReportsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
