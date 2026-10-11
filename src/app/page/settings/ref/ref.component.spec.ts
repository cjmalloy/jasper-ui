/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { runInAction } from 'mobx';

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
    it(`should always show obsolete versions with filter ${JSON.stringify(filter)}`, async () => {
      runInAction(() => component.store.view.route.routeSnapshot = {
        queryParams: { filter },
        firstChild: {
          params: { tag: 'plugin/test' },
          url: [{ path: 'settings' }, { path: 'ref' }],
        },
      } as any);
      const setArgs = vi.spyOn(component.query, 'setArgs').mockImplementation(() => {});

      fixture.detectChanges();

      await vi.waitFor(() => expect(setArgs).toHaveBeenCalled());
      const args = setArgs.mock.lastCall![0];
      expect('obsolete' in args).toBe(true);
      expect(args.obsolete).toBeNull();
    });
  }
});
