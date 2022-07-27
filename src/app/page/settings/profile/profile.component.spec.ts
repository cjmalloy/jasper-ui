import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { SettingsProfilePage } from './profile.component';

describe('SettingsProfilePage', () => {
  let component: SettingsProfilePage;
  let fixture: ComponentFixture<SettingsProfilePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SettingsProfilePage ],
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
      ],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SettingsProfilePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
