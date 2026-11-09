/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SettingsRefPage } from './ref.component';

describe('SettingsRefPage', () => {
  let component: SettingsRefPage;
  let fixture: ComponentFixture<SettingsRefPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [forwardRef(() => SettingsRefPage)],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsRefPage);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();

    expect(component).toBeTruthy();
  });

  for (const filter of [[], ['obsolete'], ['!obsolete'], ['!obsolete', 'obsolete']]) {
    it(`should always show obsolete versions with filter ${JSON.stringify(filter)}`, () => {
      component.store.view.route.routeSnapshot.set({
        queryParams: { filter },
        firstChild: {
          params: { tag: 'plugin/test' },
          url: [{ path: 'settings' }, { path: 'ref' }],
        },
      } as any);

      fixture.detectChanges();

      const args = component.query.args()!;
      expect('obsolete' in args).toBe(true);
      expect(args.obsolete).toBeNull();
    });
  }

  for (const showRemotes of [false, true]) {
    it(`should query every plugin in a merged settings tab with showRemotes ${showRemotes}`, () => {
      component.store.view.settingsTabs.set([
        { tag: '+plugin/secret', origin: '', config: { settings: 'secrets' } },
        { tag: '_plugin/secret', origin: '', config: { settings: 'secrets' } },
        { tag: 'plugin/other', origin: '', config: { settings: 'other' } },
      ] as any);
      component.store.view.route.routeSnapshot.set({
        queryParams: showRemotes ? { showRemotes: 'true' } : {},
        firstChild: {
          routeConfig: { path: 'settings' },
          params: {},
          url: [{ path: 'settings' }],
          firstChild: {
            routeConfig: { path: 'ref/:tag' },
            params: { tag: '_plugin/secret' },
          },
        },
      } as any);

      fixture.detectChanges();

      expect(component.query.args()!.query).toBe(showRemotes
        ? '+plugin/secret|_plugin/secret'
        : '+plugin/secret@|_plugin/secret@');
      expect(component.plugin()!.tag).toBe('+plugin/secret');
    });
  }
});
