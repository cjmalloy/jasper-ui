import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InboxPage } from './inbox.component';

describe('InboxComponent', () => {
  let component: InboxPage;
  let fixture: ComponentFixture<InboxPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [InboxPage],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(InboxPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
