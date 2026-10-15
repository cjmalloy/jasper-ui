/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DateTime } from 'luxon';
import { runInAction } from 'mobx';
import { EMPTY, NEVER, of, Subject, throwError } from 'rxjs';
import { RefUpdates } from '../../model/ref';

import { RefPage } from './ref.component';

describe('RefPage', () => {
  let component: RefPage;
  let fixture: ComponentFixture<RefPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [forwardRef(() => RefPage)],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RefPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('refreshes partial websocket updates with the complete Ref', () => {
    const url = 'comment:thread';
    const created = DateTime.fromISO('2026-01-01T00:00:00Z');
    const updates = new Subject<RefUpdates>();
    component.store.view.setRef({
      url,
      origin: '',
      created,
      tags: ['plugin/thread'],
    });
    vi.spyOn(component['refs'], 'count').mockReturnValue(EMPTY);
    vi.spyOn(component['stomp'], 'watchRef').mockReturnValue(updates);
    vi.spyOn(component['stomp'], 'watchResponse').mockReturnValue(EMPTY);
    const refresh = vi.spyOn(component.store.eventBus, 'refresh');

    component.reload(url);
    updates.next({
      url,
      origin: '',
      tags: ['plugin/thread', '+plugin/error'],
    });

    expect(refresh).toHaveBeenCalledWith(expect.objectContaining({
      url,
      created,
      tags: ['plugin/thread', '+plugin/error'],
    }));
  });

  describe('origin query param', () => {
    const url = 'internal:secret';
    let get: ReturnType<typeof vi.spyOn>;
    let getCurrent: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      component.store.view.setRef(undefined);
      vi.spyOn(component['refs'], 'count').mockReturnValue(EMPTY);
      get = vi.spyOn(component['refs'], 'get').mockImplementation((url: string, origin = '') => of({ url, origin }));
      getCurrent = vi.spyOn(component['refs'], 'getCurrent').mockReturnValue(of({ url, origin: '@remote' }));
    });

    function route(queryParams: Record<string, string>) {
      runInAction(() => component.store.view.route.routeSnapshot = {
        queryParams,
        firstChild: {
          params: { url },
          url: [{ path: 'ref' }, { path: url }],
        },
      } as any);
    }

    it('loads the exact version for an empty origin', () => {
      route({ origin: '' });

      expect(get).toHaveBeenCalledWith(url, '');
      expect(getCurrent).not.toHaveBeenCalled();
      expect(component.store.view.ref).toEqual({ url, origin: '' });
    });

    it('loads the exact version for a remote origin', () => {
      route({ origin: '@other' });

      expect(get).toHaveBeenCalledWith(url, '@other');
      expect(getCurrent).not.toHaveBeenCalled();
      expect(component.store.view.ref).toEqual({ url, origin: '@other' });
    });

    it('loads the newest version without an origin', () => {
      route({});

      expect(getCurrent).toHaveBeenCalledWith(url);
      expect(get).not.toHaveBeenCalled();
      expect(component.store.view.ref).toEqual({ url, origin: '@remote' });
    });

    it('reuses a preloaded Ref from the same origin', () => {
      component.store.view.setRef({ url, origin: '' });
      route({ origin: '' });

      expect(get).not.toHaveBeenCalled();
      expect(getCurrent).not.toHaveBeenCalled();
    });

    it('reloads when only the origin changes', () => {
      route({ origin: '' });
      route({ origin: '@other' });

      expect(get).toHaveBeenNthCalledWith(1, url, '');
      expect(get).toHaveBeenNthCalledWith(2, url, '@other');
      expect(component.store.view.ref).toEqual({ url, origin: '@other' });
    });
  });

  describe('websocket origin', () => {
    const url = 'comment:sub';
    let watch: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      component.store.view.setRef(undefined);
      vi.spyOn(component['refs'], 'count').mockReturnValue(EMPTY);
      vi.spyOn(component['stomp'], 'watchResponse').mockReturnValue(EMPTY);
      watch = vi.spyOn(component['stomp'], 'watch').mockReturnValue(NEVER);
    });

    function topics() {
      return watch.mock.calls.map((c: any[]) => c[0] as string).filter((t: string) => t.startsWith('/topic/ref/'));
    }

    it('subscribes to the origin of a Ref loaded from a sub origin', () => {
      vi.spyOn(component['refs'], 'getCurrent').mockReturnValue(of({ url, origin: '@sub' }));

      component.reload(url, undefined);

      expect(topics()).toEqual(['/topic/ref/@sub/' + encodeURIComponent(url)]);
    });

    it('subscribes to the default origin for a local Ref', () => {
      vi.spyOn(component['refs'], 'get').mockReturnValue(of({ url, origin: '' }));

      component.reload(url, '');

      expect(topics()).toEqual(['/topic/ref/default/' + encodeURIComponent(url)]);
    });

    it('does not subscribe when the Ref is not found', () => {
      vi.spyOn(component['refs'], 'getCurrent').mockReturnValue(throwError(() => ({ status: 404 })));

      component.reload(url, undefined);

      expect(topics()).toEqual([]);
      expect(component.store.view.ref).toEqual({ url });
    });

    it('does not reuse a 404 placeholder', () => {
      const getCurrent = vi.spyOn(component['refs'], 'getCurrent').mockReturnValue(throwError(() => ({ status: 404 })));
      const get = vi.spyOn(component['refs'], 'get').mockReturnValue(throwError(() => ({ status: 404 })));

      component.reload(url, undefined);
      component.reload(url, undefined);
      component.reload(url, '');

      expect(getCurrent).toHaveBeenCalledTimes(2);
      expect(get).toHaveBeenCalledTimes(1);
      expect(topics()).toEqual([]);
      expect(component.store.view.ref).toEqual({ url });
    });

    it('resubscribes when the displayed copy changes origin', () => {
      vi.spyOn(component['refs'], 'get').mockImplementation((url: string, origin = '') => of({ url, origin }));

      component.reload(url, '@sub');
      component.reload(url, '@other');

      expect(topics()).toEqual([
        '/topic/ref/@sub/' + encodeURIComponent(url),
        '/topic/ref/@other/' + encodeURIComponent(url),
      ]);
    });
  });
});
