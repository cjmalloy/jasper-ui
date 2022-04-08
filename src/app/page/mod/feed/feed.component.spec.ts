import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModFeedPage } from './feed.component';

describe('FeedComponent', () => {
  let component: ModFeedPage;
  let fixture: ComponentFixture<ModFeedPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ModFeedPage ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ModFeedPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
