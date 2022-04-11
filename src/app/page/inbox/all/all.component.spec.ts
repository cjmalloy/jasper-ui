import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InboxAllPage } from './all.component';

describe('AllComponent', () => {
  let component: InboxAllPage;
  let fixture: ComponentFixture<InboxAllPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [InboxAllPage],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(InboxAllPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
