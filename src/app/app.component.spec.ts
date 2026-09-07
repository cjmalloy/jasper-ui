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

  beforeEach(async () => {
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
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  function navigate(id: number, restoredId?: number) {
    const events = TestBed.inject(Router).events as Subject<Event>;
    events.next(new NavigationStart(id, '/home', restoredId === undefined ? 'imperative' : 'popstate',
      restoredId === undefined ? null : { navigationId: restoredId }));
    events.next(new NavigationEnd(id, '/home', '/home'));
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
    events.next(new NavigationStart(3, '/home', 'popstate', { navigationId: 1 }));
    expect(component.store.view.restoreLastSelectedScroll).toBe(true);
    events.next(new NavigationCancel(3, '/home', 'Unsaved changes'));
    expect(component.store.view.restoreLastSelectedScroll).toBe(false);

    navigate(4, 1);
    expect(component.store.view.restoreLastSelectedScroll).toBe(true);
  });
});
