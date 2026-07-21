/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { downloadRef } from '../../util/download';

import { UserComponent } from './user.component';

vi.mock('../../util/download', () => ({
  downloadRef: vi.fn(),
  downloadTag: vi.fn(),
}));

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

    component.connect();

    expect(downloadRef).toHaveBeenCalledWith({
      url: 'https://remote.example/api',
      tags: ['+plugin/origin/pull', '+plugin/origin/tunnel'],
      plugins: {
        '+plugin/origin': { remote: '@example', local: '@example' },
        '+plugin/origin/tunnel': { remoteUser: '+user/test@example' },
      },
    });
  });

  it('recommends the API hostname as the local alias for the default origin', () => {
    component.config.api = 'https://jasper.example/api';
    component.user = { tag: '+user/test', origin: '' };
    component.ngOnChanges({ user: {} as any });

    component.connect();

    expect(downloadRef).toHaveBeenLastCalledWith(expect.objectContaining({
      plugins: expect.objectContaining({
        '+plugin/origin': { remote: '', local: '@jasper.example' },
      }),
    }));
  });
});
