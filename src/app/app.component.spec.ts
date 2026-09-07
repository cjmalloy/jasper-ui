/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Event, NavigationCancel, NavigationEnd, NavigationStart, provideRouter, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { AppComponent } from './app.component';
import { ExtService } from './service/api/ext.service';

describe('AppComponent', () => {
  let component: AppComponent;
  let fixture: ComponentFixture<AppComponent>;
  let historyState: any;
  let historyEntries: Map<number, { state: any, url: string }>;

  beforeEach(async () => {
    historyState = {};
    historyEntries = new Map();
    vi.spyOn(window.history, 'state', 'get').mockImplementation(() => historyState);
    vi.spyOn(window.history, 'replaceState').mockImplementation(state => historyState = state);
    await TestBed.configureTestingModule({
      imports: [
        AppComponent,
      ],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    const extService = TestBed.inject(ExtService);
    clearTimeout(extService['_batchTimer']);
    fixture.destroy();
    vi.restoreAllMocks();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  function navigate(id: number, restoredId?: number, url = `/page/${id}`) {
    const events = TestBed.inject(Router).events as Subject<Event>;
    const restored = restoredId === undefined ? undefined : historyEntries.get(restoredId);
    url = restored?.url ?? url;
    events.next(new NavigationStart(id, url, restoredId === undefined ? 'imperative' : 'popstate',
      restored?.state ?? null));
    historyState = { navigationId: id, otherState: 'preserved' };
    events.next(new NavigationEnd(id, url, url));
    historyEntries.set(id, { state: historyState, url });
  }

  it('only restores selected-item scrolling on Back, including repeated Back and Forward', () => {
    expect(component.store.view.restoreLastSelectedScroll).toBe(false);
    navigate(1);
    navigate(2);
    expect(component.store.view.restoreLastSelectedScroll).toBe(false);

    navigate(3, 1);
    expect(component.store.view.restoreLastSelectedScroll).toBe(true);
    navigate(4, 2);
    expect(component.store.view.restoreLastSelectedScroll).toBe(false);
    navigate(5, 3);
    expect(component.store.view.restoreLastSelectedScroll).toBe(true);
    navigate(6, 4);
    expect(component.store.view.restoreLastSelectedScroll).toBe(false);
  });

  it('disables scroll restoration on ordinary navigation without clearing the selection', () => {
    navigate(1);
    navigate(2);
    navigate(3, 1);
    component.store.view.setLastSelected({ url: 'https://example.com/selected' });

    navigate(4);

    expect(component.store.view.restoreLastSelectedScroll).toBe(false);
    expect(component.store.view.lastSelected?.url).toBe('https://example.com/selected');
  });

  it.each(['replaceUrl', 'skipLocationChange'])('keeps history ordering after %s navigation', option => {
    navigate(1);
    navigate(2);
    navigate(3, 1);
    const currentNavigation = vi.spyOn(TestBed.inject(Router), 'currentNavigation')
      .mockReturnValue({ extras: { [option]: true } } as any);
    navigate(4);
    currentNavigation.mockRestore();

    navigate(5, 2);
    expect(component.store.view.restoreLastSelectedScroll).toBe(false);
    navigate(6, option === 'replaceUrl' ? 4 : 3);
    expect(component.store.view.restoreLastSelectedScroll).toBe(true);
  });

  it('does not restore scrolling or advance history for a canceled navigation', () => {
    navigate(1);
    navigate(2);
    const events = TestBed.inject(Router).events as Subject<Event>;
    events.next(new NavigationStart(3, '/page/1', 'popstate', historyEntries.get(1)!.state));
    expect(component.store.view.restoreLastSelectedScroll).toBe(true);
    events.next(new NavigationCancel(3, '/home', 'Unsaved changes'));
    expect(component.store.view.restoreLastSelectedScroll).toBe(false);

    navigate(4, 1);
    expect(component.store.view.restoreLastSelectedScroll).toBe(true);
  });

  it('preserves history ordering when same-URL navigation replaces the current entry', () => {
    navigate(1);
    navigate(2);
    navigate(3, 1);
    navigate(4, undefined, '/page/1');

    navigate(5, 2);
    expect(component.store.view.restoreLastSelectedScroll).toBe(false);
    navigate(6, 4);
    expect(component.store.view.restoreLastSelectedScroll).toBe(true);
    expect(historyState.otherState).toBe('preserved');
  });

  it('creates a new position when navigating to a previously hidden URL', () => {
    navigate(1);
    const currentNavigation = vi.spyOn(TestBed.inject(Router), 'currentNavigation')
      .mockReturnValue({ extras: { skipLocationChange: true } } as any);
    navigate(2);
    currentNavigation.mockRestore();
    navigate(3, undefined, '/page/2');

    navigate(4, 1);
    expect(component.store.view.restoreLastSelectedScroll).toBe(true);
    navigate(5, 3);
    expect(component.store.view.restoreLastSelectedScroll).toBe(false);
  });

  it('preserves history ordering across reloads with restarted navigation IDs', () => {
    navigate(7);
    fixture.destroy();
    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    const events = TestBed.inject(Router).events as Subject<Event>;
    events.next(new NavigationStart(1, '/page/7', 'imperative', historyState));
    historyState = { navigationId: 1 };
    events.next(new NavigationEnd(1, '/page/7', '/page/7'));
    historyEntries.set(1, { state: historyState, url: '/page/7' });

    navigate(2);
    navigate(3, 1);
    expect(component.store.view.restoreLastSelectedScroll).toBe(true);
    navigate(4, 2);
    expect(component.store.view.restoreLastSelectedScroll).toBe(false);
  });
});
