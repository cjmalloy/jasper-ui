import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { OAuthService, OAuthStorage } from 'angular-oauth2-oidc';

import { CommentEditComponent } from './comment-edit.component';

describe('CommentEditComponent', () => {
  let component: CommentEditComponent;
  let fixture: ComponentFixture<CommentEditComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CommentEditComponent ],
      imports: [
        HttpClientTestingModule,
        RouterModule.forRoot([]),
      ],
      providers: [
        { provide: OAuthService, useValue: {} },
        { provide: OAuthStorage, useValue: {} },
      ],
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CommentEditComponent);
    component = fixture.componentInstance;
    component.ref = { url: '' };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
