import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { NotificationsPopupComponent } from './notifications-popup.component';

describe('NotificationsPopupComponent', () => {
  let component: NotificationsPopupComponent;
  let fixture: ComponentFixture<NotificationsPopupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [NotificationsPopupComponent],
      imports: [
        RouterTestingModule,
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(NotificationsPopupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
