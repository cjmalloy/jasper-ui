import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SettingsUserPage } from './user.component';

describe('UserComponent', () => {
  let component: SettingsUserPage;
  let fixture: ComponentFixture<SettingsUserPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SettingsUserPage ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SettingsUserPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
