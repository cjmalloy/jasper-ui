import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SubmitFeedPage } from './feed.component';

describe('FeedComponent', () => {
  let component: SubmitFeedPage;
  let fixture: ComponentFixture<SubmitFeedPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SubmitFeedPage],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SubmitFeedPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
