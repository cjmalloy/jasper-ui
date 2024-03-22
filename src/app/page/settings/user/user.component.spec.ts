import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { SettingsUserPage } from './user.component';

describe('SettingsUserPage', () => {
  let component: SettingsUserPage;
  let fixture: ComponentFixture<SettingsUserPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SettingsUserPage ],
      imports: [
        HttpClientTestingModule,
        RouterModule.forRoot([]),
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
