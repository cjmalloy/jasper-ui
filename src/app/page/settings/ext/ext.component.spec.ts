import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SettingsExtPage } from './ext.component';

describe('ExtComponent', () => {
  let component: SettingsExtPage;
  let fixture: ComponentFixture<SettingsExtPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SettingsExtPage ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SettingsExtPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
