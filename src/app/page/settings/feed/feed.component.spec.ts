import { HttpClientModule } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { SettingsFeedPage } from './feed.component';

describe('SettingsFeedPage', () => {
  let component: SettingsFeedPage;
  let fixture: ComponentFixture<SettingsFeedPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SettingsFeedPage],
      imports: [
        HttpClientModule,
        RouterTestingModule,
      ],
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
