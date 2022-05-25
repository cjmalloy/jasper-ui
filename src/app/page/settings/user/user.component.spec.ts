import { HttpClientModule } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { SettingsUserPage } from './user.component';

describe('SettingsUserPage', () => {
  let component: SettingsUserPage;
  let fixture: ComponentFixture<SettingsUserPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SettingsUserPage],
      imports: [
        HttpClientModule,
        RouterTestingModule,
      ],
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
