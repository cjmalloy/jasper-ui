import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';

import { AuthzService } from './authz.service';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { Store } from '../store/store';

describe('AuthzService', () => {
  let service: AuthzService;
  let store: Store;

  beforeEach(() => {
    TestBed.configureTestingModule({
    imports: [RouterModule.forRoot([])],
    providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
});
    service = TestBed.inject(AuthzService);
    store = TestBed.inject(Store);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('tagWriteAccess', () => {
    beforeEach(() => {
      // Set up a signed-in user
      store.account.setRoles({
        debug: false,
        tag: 'user/testuser@',
        admin: false,
        mod: false,
        editor: false,
        user: true,
        viewer: false,
        banned: false,
      });
    });

    it('should return false when not signed in', () => {
      store.account.setRoles({
        debug: false,
        tag: '',
        admin: false,
        mod: false,
        editor: false,
        user: false,
        viewer: false,
        banned: false,
      });
      expect(service.tagWriteAccess('science')).toBe(false);
    });

    it('should return false for locked tag', () => {
      expect(service.tagWriteAccess('locked')).toBe(false);
    });

    it('should return true for mod role', () => {
      store.account.setRoles({
        debug: false,
        tag: 'user/testuser@',
        admin: false,
        mod: true,
        editor: false,
        user: true,
        viewer: false,
        banned: false,
      });
      expect(service.tagWriteAccess('science')).toBe(true);
    });

    it('should return true for editor role with public tag', () => {
      store.account.setRoles({
        debug: false,
        tag: 'user/testuser@',
        admin: false,
        mod: false,
        editor: true,
        user: true,
        viewer: false,
        banned: false,
      });
      expect(service.tagWriteAccess('science')).toBe(true);
    });

    it('should return true for user\'s own tag', () => {
      expect(service.tagWriteAccess('user/testuser')).toBe(true);
    });

    it('should return true when tag is in tagWriteAccess array', () => {
      store.account.access = {
        tag: 'user/testuser',
        origin: '',
        tagWriteAccess: ['science'],
      };
      expect(service.tagWriteAccess('science')).toBe(true);
    });

    it('should return true when tag is in writeAccess array', () => {
      store.account.access = {
        tag: 'user/testuser',
        origin: '',
        writeAccess: ['science'],
      };
      expect(service.tagWriteAccess('science')).toBe(true);
    });

    it('should return true when parent tag is in writeAccess array', () => {
      store.account.access = {
        tag: 'user/testuser',
        origin: '',
        writeAccess: ['science'],
      };
      expect(service.tagWriteAccess('science/physics')).toBe(true);
    });

    it('should return true when grandparent tag is in writeAccess array', () => {
      store.account.access = {
        tag: 'user/testuser',
        origin: '',
        writeAccess: ['science'],
      };
      expect(service.tagWriteAccess('science/physics/quantum')).toBe(true);
    });

    it('should return true when parent tag is in tagWriteAccess array', () => {
      store.account.access = {
        tag: 'user/testuser',
        origin: '',
        tagWriteAccess: ['science'],
      };
      expect(service.tagWriteAccess('science/physics')).toBe(true);
    });

    it('should return false when no access is granted', () => {
      store.account.access = {
        tag: 'user/testuser',
        origin: '',
        writeAccess: ['math'],
      };
      expect(service.tagWriteAccess('science')).toBe(false);
    });

    it('should return false when access is to a different branch', () => {
      store.account.access = {
        tag: 'user/testuser',
        origin: '',
        writeAccess: ['science/biology'],
      };
      expect(service.tagWriteAccess('science/physics')).toBe(false);
    });
  });
});
