import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SettingsFeedPage } from './feed.component';

describe('FeedComponent', () => {
  let component: SettingsFeedPage;
  let fixture: ComponentFixture<SettingsFeedPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SettingsFeedPage ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SettingsFeedPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
