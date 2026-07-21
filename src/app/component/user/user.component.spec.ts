/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { provideRouter } from '@angular/router';

import { UserComponent } from './user.component';

describe('UserComponent', () => {
  let component: UserComponent;
  let fixture: ComponentFixture<UserComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ReactiveFormsModule,
        UserComponent,
      ],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UserComponent);
    component = fixture.componentInstance;
    component.user = { tag: 'user/test' };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('downloads a connection ref for the user and origin', () => {
    component.config.api = 'https://remote.example/api';
    component.user = { tag: '+user/test', origin: '@example' };
    component.ngOnChanges({ user: {} as any });

    expect(component.connectionRef).toEqual({
      url: 'https://remote.example/api',
      title: '@example',
      tags: ['public', 'internal', '+plugin/cron', '+plugin/origin/pull', '+plugin/origin/tunnel'],
      plugins: {
        '+plugin/cron': { interval: 'PT15M' },
        '+plugin/origin': { remote: '@example', local: '@example' },
        '+plugin/origin/tunnel': { remoteUser: '+user/test@example' },
      },
    });
  });

  it('recommends the API hostname as the local alias for the default origin', () => {
    component.config.api = 'https://jasper.example/api';
    component.user = { tag: '+user/test', origin: '' };
    component.ngOnChanges({ user: {} as any });

    expect(component.connectionRef).toEqual(expect.objectContaining({
      plugins: expect.objectContaining({
        '+plugin/origin': { remote: '', local: '@jasper.example' },
      }),
    }));
  });

  it('recommends a tilde-prefixed first path as the local alias', () => {
    component.config.api = 'https://jasper.example/~test/api';
    component.user = { tag: '+user/test', origin: '' };
    component.ngOnChanges({ user: {} as any });

    expect(component.connectionRef).toEqual(expect.objectContaining({
      plugins: expect.objectContaining({
        '+plugin/origin': { remote: '', local: '@test' },
      }),
    }));
  });

  it('templates a connection from an existing origin Ref', () => {
    component.config.api = 'https://jasper.example/api';
    component.user = { tag: '+user/test', origin: '@example' };
    component.store.origins.origins = [{
      url: 'https://origin.example/custom-api',
      origin: '',
      title: 'Example origin',
      plugins: {
        '+plugin/origin': { local: '@example', remote: '@jasper' },
      },
    }];
    component.ngOnChanges({ user: {} as any });

    expect(component.connectionRef).toEqual(expect.objectContaining({
      url: 'https://origin.example/custom-api',
      title: 'Example origin',
      plugins: expect.objectContaining({
        '+plugin/origin': { remote: '@example', local: '@jasper' },
      }),
    }));
  });
});
