import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SettingsOriginsPage } from './origins.component';

describe('OriginsComponent', () => {
  let component: SettingsOriginsPage;
  let fixture: ComponentFixture<SettingsOriginsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SettingsOriginsPage ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SettingsOriginsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
