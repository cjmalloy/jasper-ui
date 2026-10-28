/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
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
    fixture.componentRef.setInput('user', { tag: 'user/test' });
    fixture.detectChanges();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('downloads a connection ref for the user and origin', () => {
    component.config.api = 'https://remote.example/api';
    fixture.componentRef.setInput('user', { tag: '+user/test', origin: '@example' });
    fixture.detectChanges();

    expect(component.connectionRef()).toEqual({
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

  it.each(['.', '/api', '//remote.example/api'])(
    'resolves the %s API URL against the document base',
    api => {
      component.config.api = api;

      expect(component.connectionRef().url).toBe(new URL(api, document.baseURI).href);
    },
  );

  it('recommends the API hostname as the local alias for the default origin', () => {
    component.config.api = 'https://jasper.example/api';
    fixture.componentRef.setInput('user', { tag: '+user/test', origin: '' });
    fixture.detectChanges();

    expect(component.connectionRef()).toEqual(expect.objectContaining({
      plugins: expect.objectContaining({
        '+plugin/origin': { remote: '', local: '@jasper.example' },
      }),
    }));
  });

  it('recommends a tilde-prefixed first path as the local alias', () => {
    component.config.api = 'https://jasper.example/~test/api';
    fixture.componentRef.setInput('user', { tag: '+user/test', origin: '' });
    fixture.detectChanges();

    expect(component.connectionRef()).toEqual(expect.objectContaining({
      plugins: expect.objectContaining({
        '+plugin/origin': { remote: '', local: '@test' },
      }),
    }));
  });

  it('templates a connection from an existing origin Ref', () => {
    component.config.api = 'https://jasper.example/api';
    fixture.componentRef.setInput('user', { tag: '+user/test', origin: '@example' });
    fixture.detectChanges();
    component.store.origins.origins.set([{
      url: 'https://origin.example/custom-api',
      origin: '',
      title: 'Example origin',
      plugins: {
        '+plugin/origin': { local: '@example', remote: '@jasper' },
      },
    }]);

    expect(component.connectionRef()).toEqual(expect.objectContaining({
      url: 'https://origin.example/custom-api',
      title: 'Example origin',
      plugins: expect.objectContaining({
        '+plugin/origin': { remote: '@example', local: '@jasper' },
      }),
    }));
  });

  it('keeps the connection ref readable when the profile lookup fails', () => {
    const http = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('user', { tag: '+user', origin: '', modified: '2024-01-01T00:00:00Z' });
    fixture.detectChanges();
    TestBed.tick();
    http.match(req => req.url.endsWith('/profile')).forEach(req =>
      req.flush('', { status: 404, statusText: 'Not Found' }));
    fixture.detectChanges();

    expect(component.profile()).toBeUndefined();
    expect(() => component.connectionRef()).not.toThrow();
    expect(component.connectionRef().plugins?.['+plugin/origin/tunnel']).toEqual({ remoteUser: '+user' });
  });

  it('fills the edit form from the User when editing starts', () => {
    fixture.componentRef.setInput('user', {
      tag: '+user/test',
      origin: '',
      name: 'Test',
      readAccess: ['public', 'plugin/inbox/test'],
      writeAccess: ['+custom'],
      external: { ids: ['a'] },
    });
    component.toggleEditing();

    expect(component.editForm.getRawValue()).toMatchObject({
      name: 'Test',
      notifications: ['plugin/inbox/test'],
      readAccess: ['public'],
      writeAccess: ['+custom'],
      tagReadAccess: [],
      tagWriteAccess: [],
      external: JSON.stringify({ ids: ['a'] }, null, 2),
    });
  });

  it('keeps a hidden draft until it is cancelled', () => {
    fixture.componentRef.setInput('user', { tag: '+user/test', origin: '', name: 'Test' });
    component.toggleEditing();
    component.editForm.get('name')!.setValue('Edited');
    component.editForm.markAsDirty();
    component.toggleEditing();
    expect(component.draft()).toBe(true);

    component.toggleEditing();
    expect(component.editForm.get('name')!.value).toBe('Edited');

    component.cancelEdit();
    expect(component.draft()).toBe(false);
    component.toggleEditing();
    expect(component.editForm.get('name')!.value).toBe('Test');
  });
});
