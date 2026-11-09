/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { forwardRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminService } from '../../service/admin.service';
import { AuthzService } from '../../service/authz.service';

import { SettingsPage } from './settings.component';

describe('SettingsPage', () => {
  let component: SettingsPage;
  let fixture: ComponentFixture<SettingsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [forwardRef(() => SettingsPage)],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();
  });

  function create() {
    fixture = TestBed.createComponent(SettingsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('should create', () => {
    create();
    expect(component).toBeTruthy();
  });

  it('should merge plugins with the same settings label into one readable tab', () => {
    vi.spyOn(TestBed.inject(AdminService), 'settings').mockReturnValue([
      { tag: '+plugin/secret', config: { settings: 'secrets' } },
      { tag: 'plugin/other', config: { settings: 'other' } },
      { tag: '_plugin/secret', config: { settings: 'secrets' } },
      { tag: '_plugin/hidden', config: { settings: 'hidden' } },
    ] as any);
    vi.spyOn(TestBed.inject(AuthzService), 'tagReadAccess').mockImplementation(tag => tag !== '_plugin/hidden');

    create();

    const tabs = [...fixture.nativeElement.querySelectorAll('.settings-tab')] as HTMLAnchorElement[];
    expect(tabs.map(t => t.textContent!.trim())).toEqual(['secrets', 'other']);
    expect(tabs[0].getAttribute('href')).toBe('/ref/%2Bplugin%2Fsecret');
    expect(component.store.view.settingsGroups().map(g => g.map(p => p.tag))).toEqual([
      ['+plugin/secret', '_plugin/secret'],
      ['plugin/other'],
    ]);
  });
});
