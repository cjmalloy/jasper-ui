import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { OAuthService, OAuthStorage } from 'angular-oauth2-oidc';

import { BackgammonComponent } from './backgammon.component';

describe('BackgammonComponent', () => {
  let component: BackgammonComponent;
  let fixture: ComponentFixture<BackgammonComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [BackgammonComponent], imports: [
        HttpClientTestingModule,
        RouterTestingModule,
      ],
      providers: [
        { provide: OAuthService, useValue: {} },
        { provide: OAuthStorage, useValue: {} },
      ],
    });
    fixture = TestBed.createComponent(BackgammonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
