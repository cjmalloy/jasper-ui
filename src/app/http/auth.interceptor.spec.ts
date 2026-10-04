/// <reference types="vitest/globals" />
import { HTTP_INTERCEPTORS, HttpClient, provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ConfigService } from '../service/config.service';
import { Store } from '../store/store';
import { base64Bytes } from '../util/jwt';

import { AuthInterceptor, JASPER_KEY_HEADER } from './auth.interceptor';

const SECRET = btoa('electron-secret');

function payload(jwt: string) {
  return JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
}

async function verify(jwt: string, secret: string) {
  const [header, body, sig] = jwt.split('.');
  const key = await crypto.subtle.importKey('raw', base64Bytes(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const signature = Uint8Array.from(atob(sig.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  return crypto.subtle.verify('HMAC', key, signature, new TextEncoder().encode(header + '.' + body));
}

describe('AuthInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let store: Store;
  let config: ConfigService;

  beforeEach(async () => {
    localStorage.removeItem('selectedUserTag');
    await TestBed.configureTestingModule({
      providers: [
        AuthInterceptor,
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    store = TestBed.inject(Store);
    store.local._selectedUserTag = undefined;
    config = TestBed.inject(ConfigService);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.removeItem('selectedUserTag');
  });

  async function nextRequest(url: string) {
    http.get(url).subscribe(() => {});
    let req: any;
    await vi.waitFor(() => {
      req = httpMock.expectOne(url);
    });
    return req;
  }

  async function receiveSecret(secret = SECRET) {
    const req = await nextRequest('config.json');
    req.flush({}, { headers: { [JASPER_KEY_HEADER]: secret } });
  }

  it('should be created', () => {
    const interceptor: AuthInterceptor = TestBed.inject(AuthInterceptor);
    expect(interceptor).toBeTruthy();
  });

  it('sends User-Tag header without the electron secret', async () => {
    store.local.selectedUserTag = '+user/alice';
    const req = await nextRequest('/api/v1/user/whoami');
    expect(req.request.headers.get('User-Tag')).toBe('+user/alice');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('creates an admin token for the root user from the electron secret', async () => {
    await receiveSecret();
    const req = await nextRequest('/api/v1/user/whoami');
    const jwt = req.request.headers.get('Authorization')!.substring('Bearer '.length);
    expect(req.request.headers.has('User-Tag')).toBe(false);
    expect(payload(jwt)).toEqual({ sub: '+user', auth: 'ROLE_ADMIN' });
    expect(await verify(jwt, SECRET)).toBe(true);
    expect(config.token).toBe(jwt);
    req.flush({});
  });

  it('creates an admin token for the private root user', async () => {
    store.local.selectedUserTag = '_user';
    await receiveSecret();
    const req = await nextRequest('/api/v1/user/whoami');
    const jwt = req.request.headers.get('Authorization')!.substring('Bearer '.length);
    expect(payload(jwt)).toEqual({ sub: '_user', auth: 'ROLE_ADMIN,ROLE_PRIVATE' });
    req.flush({});
  });

  it('creates an anonymous token for other users so the db provides the role', async () => {
    store.local.selectedUserTag = '+user/alice';
    await receiveSecret();
    const req = await nextRequest('/api/v1/user/whoami');
    const jwt = req.request.headers.get('Authorization')!.substring('Bearer '.length);
    expect(req.request.headers.has('User-Tag')).toBe(false);
    expect(payload(jwt)).toEqual({ sub: '+user/alice', auth: 'ROLE_ANONYMOUS' });
    req.flush({});
  });

  it('creates a new token when the secret or user tag changes', async () => {
    await receiveSecret();
    let req = await nextRequest('/api/v1/user/whoami');
    const first = req.request.headers.get('Authorization');
    req.flush({});

    store.local.selectedUserTag = '+user/bob';
    req = await nextRequest('/api/v1/user/whoami');
    const second = req.request.headers.get('Authorization');
    expect(second).not.toBe(first);
    expect(payload(second.substring('Bearer '.length)).sub).toBe('+user/bob');
    const newSecret = btoa('new-secret');
    req.flush({}, { headers: { [JASPER_KEY_HEADER]: newSecret } });

    req = await nextRequest('/api/v1/user/whoami');
    const third = req.request.headers.get('Authorization');
    expect(third).not.toBe(second);
    expect(await verify(third.substring('Bearer '.length), newSecret)).toBe(true);
    req.flush({});
  });
});
