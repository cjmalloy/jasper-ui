import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SettingsMePage } from './me.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { OAuthService, OAuthStorage } from 'angular-oauth2-oidc';

describe('SettingsMePage', () => {
  let component: SettingsMePage;
  let fixture: ComponentFixture<SettingsMePage>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ SettingsMePage ],
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
      ],
      providers: [
        { provide: OAuthService, useValue: {} },
        { provide: OAuthStorage, useValue: {} },
      ],
    });
    fixture = TestBed.createComponent(SettingsMePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
