import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InboxUnreadPage } from './unread.component';

describe('UnreadComponent', () => {
  let component: InboxUnreadPage;
  let fixture: ComponentFixture<InboxUnreadPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [InboxUnreadPage],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(InboxUnreadPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
