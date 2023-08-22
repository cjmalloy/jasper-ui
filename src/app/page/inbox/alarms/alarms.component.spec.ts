import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InboxAlarmsPage } from './alarms.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

describe('InboxAlarmsPage', () => {
  let component: InboxAlarmsPage;
  let fixture: ComponentFixture<InboxAlarmsPage>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ InboxAlarmsPage ],
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
      ]
    });
    fixture = TestBed.createComponent(InboxAlarmsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
