import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InboxAlarmsPage } from './alarms.component';

describe('InboxAlarmsPage', () => {
  let component: InboxAlarmsPage;
  let fixture: ComponentFixture<InboxAlarmsPage>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [InboxAlarmsPage]
    });
    fixture = TestBed.createComponent(InboxAlarmsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
