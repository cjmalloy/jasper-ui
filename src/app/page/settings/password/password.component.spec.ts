import { HttpClientModule } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { SettingsPasswordPage } from './password.component';

describe('PasswordComponent', () => {
  let component: SettingsPasswordPage;
  let fixture: ComponentFixture<SettingsPasswordPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SettingsPasswordPage ],
      imports: [
        HttpClientModule,
        RouterTestingModule,
      ],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SettingsPasswordPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
