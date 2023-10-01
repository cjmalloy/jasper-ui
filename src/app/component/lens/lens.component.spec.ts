import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { OAuthService, OAuthStorage } from 'angular-oauth2-oidc';

import { LensComponent } from './lens.component';

describe('LensComponent', () => {
  let component: LensComponent;
  let fixture: ComponentFixture<LensComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [LensComponent],
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
      ],
      providers: [
        { provide: OAuthService, useValue: {} },
        { provide: OAuthStorage, useValue: {} },
      ],
    });
    fixture = TestBed.createComponent(LensComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
