import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { of, Subject } from 'rxjs';
import { DateTime } from 'luxon';

import { ActionService, RefActionHandler } from './action.service';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { Ref, RefUpdates } from '../model/ref';
import { Store } from '../store/store';
import { RefService } from './api/ref.service';
import { AuthzService } from './authz.service';

describe('ActionService', () => {
  let service: ActionService;
  let store: jasmine.SpyObj<Store>;
  let refs: jasmine.SpyObj<RefService>;
  let auth: jasmine.SpyObj<AuthzService>;

  beforeEach(() => {
    const storeSpy = jasmine.createSpyObj('Store', [], {
      account: { origin: '@local' }
    });
    const refsSpy = jasmine.createSpyObj('RefService', ['get', 'patch', 'merge', 'create']);
    const authSpy = jasmine.createSpyObj('AuthzService', ['writeAccess']);

    TestBed.configureTestingModule({
      imports: [RouterModule.forRoot([])],
      providers: [
        provideHttpClient(withInterceptorsFromDi()), 
        provideHttpClientTesting(),
        { provide: Store, useValue: storeSpy },
        { provide: RefService, useValue: refsSpy },
        { provide: AuthzService, useValue: authSpy }
      ]
    });
    
    service = TestBed.inject(ActionService);
    store = TestBed.inject(Store) as jasmine.SpyObj<Store>;
    refs = TestBed.inject(RefService) as jasmine.SpyObj<RefService>;
    auth = TestBed.inject(AuthzService) as jasmine.SpyObj<AuthzService>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('RefActionHandler', () => {
    let handler: RefActionHandler;
    let testRef: Ref;
    let updates$: Subject<RefUpdates>;

    beforeEach(() => {
      testRef = {
        url: 'https://example.com/test',
        origin: '@local',
        modifiedString: '2023-01-01T00:00:00Z',
        comment: 'Test comment',
        created: DateTime.fromISO('2023-01-01T00:00:00Z'),
        upload: false
      } as Ref;
      
      updates$ = new Subject<RefUpdates>();
      auth.writeAccess.and.returnValue(true);
    });

    it('should create RefActionHandler for local ref', () => {
      handler = service.createRefHandler(testRef, updates$);
      
      expect(handler).toBeTruthy();
      expect(handler.ref).toBe(testRef);
      expect(handler.writeAccess).toBe(true);
      expect(handler.cursor).toBe('2023-01-01T00:00:00Z');
    });

    it('should detect local refs correctly', () => {
      handler = service.createRefHandler(testRef, updates$);
      
      expect(handler.isLocal()).toBe(true);
    });

    it('should detect remote refs correctly', () => {
      testRef.origin = '@remote';
      testRef.created = DateTime.fromISO('2023-01-01T00:00:00Z'); // Set as created
      testRef.upload = false; // Not an upload
      
      // Mock the get call that happens in initialization for remote refs
      refs.get.and.returnValue(of({
        ...testRef,
        modifiedString: '2023-01-02T00:00:00Z'
      } as Ref));
      
      handler = service.createRefHandler(testRef, updates$);
      
      expect(handler.isLocal()).toBe(false);
    });

    it('should handle remote ref initialization', () => {
      testRef.origin = '@remote';
      testRef.created = DateTime.fromISO('2023-01-01T00:00:00Z'); // Set as created
      testRef.upload = false; // Not an upload
      
      // Set up the mock before creating the handler
      refs.get.and.returnValue(of({
        ...testRef,
        modifiedString: '2023-01-02T00:00:00Z'
      } as Ref));
      
      handler = service.createRefHandler(testRef, updates$);
      
      expect(refs.get).toHaveBeenCalledWith(testRef.url, '@local');
    });

    it('should update comment successfully', () => {
      refs.patch.and.returnValue(of('2023-01-03T00:00:00Z'));
      handler = service.createRefHandler(testRef, updates$);
      
      const result$ = handler.updateComment('New comment');
      
      result$.subscribe(cursor => {
        expect(cursor).toBe('2023-01-03T00:00:00Z');
        expect(testRef.comment).toBe('New comment');
        expect(testRef.modifiedString).toBe('2023-01-03T00:00:00Z');
      });
      
      expect(refs.patch).toHaveBeenCalledWith(
        testRef.url,
        testRef.origin!,
        '2023-01-01T00:00:00Z', // Original modifiedString
        [{ op: 'add', path: '/comment', value: 'New comment' }]
      );
    });

    it('should handle merge for existing cursor', () => {
      refs.merge.and.returnValue(of('2023-01-04T00:00:00Z'));
      handler = service.createRefHandler(testRef, updates$);
      
      const result$ = handler.updateRef({ title: 'New title' });
      
      result$.subscribe(cursor => {
        expect(cursor).toBe('2023-01-04T00:00:00Z');
        expect(testRef.title).toBe('New title');
      });
      
      expect(refs.merge).toHaveBeenCalledWith(
        testRef.url,
        '@local',
        '2023-01-01T00:00:00Z',
        { title: 'New title' }
      );
    });

    it('should handle create for new ref', () => {
      // Use a fresh testRef without modifiedString to trigger create
      const newRef = {
        url: 'https://example.com/test',
        origin: '@local',
        comment: 'Original comment',
        created: DateTime.fromISO('2023-01-01T00:00:00Z'),
        upload: false
      } as Ref;
      
      refs.create.and.returnValue(of('2023-01-05T00:00:00Z'));
      
      handler = service.createRefHandler(newRef, updates$);
      
      const result$ = handler.updateRef({ comment: 'New comment' });
      
      result$.subscribe(cursor => {
        expect(cursor).toBe('2023-01-05T00:00:00Z');
        expect(newRef.comment).toBe('New comment');
      });
      
      expect(refs.create).toHaveBeenCalledWith(jasmine.objectContaining({
        url: 'https://example.com/test',
        origin: '@local',
        comment: 'New comment'
      }));
    });

    it('should manage subscriptions correctly', () => {
      handler = service.createRefHandler(testRef, updates$);
      
      handler.subscribe();
      expect(updates$.observers.length).toBe(1);
      
      handler.unsubscribe();
      expect(updates$.observers.length).toBe(0);
    });
  });
});
