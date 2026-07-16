/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { llmPlugin } from '../mods/ai/ai';
import { blogTemplate } from '../mods/blog';
import { scrapePlugin } from '../mods/sync/scrape';
import { userTemplate } from '../mods/user';
import { Store } from '../store/store';
import { AdminService } from './admin.service';
import { Mod } from '../model/tag';
import { of } from 'rxjs';

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    service = TestBed.inject(AdminService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should keep formly expressions serializable for built-in mods', () => {
    expect(userTemplate.config?.form?.find(f => f.key === 'subscriptions')?.expressions?.hide).toBe('!formState.admin.home');
    expect(blogTemplate.config?.form?.find(f => f.key === 'tags')?.expressions?.hide).toBe('!field.parent.model.filterTags');
    expect(llmPlugin.config?.advancedForm?.find(f => f.key === 'bundle')?.expressions?.hide).toBe('!model.json');
    expect(scrapePlugin.config?.form?.find(f => f.key === 'textSelectors')?.expressions?.hide).toBe('!field.parent.model.text');
  });

  it('should classify unmet peer dependencies by built-in availability', () => {
    service.status.plugins['plugin/existing'] = {
      tag: 'plugin/existing',
      config: { mod: 'Existing' },
    };
    const available: Mod = {
      plugin: [{ tag: 'plugin/available', config: { mod: 'Available' } }],
    };
    service.mods.push(available);

    expect(service.getUnmetPeerDependencies({
      plugin: [{
        tag: 'plugin/dependent',
        config: { peerDependencies: ['Existing', 'Available', 'Missing'] },
      }],
      template: [{
        tag: 'template/dependent',
        config: { peerDependencies: ['Missing'] },
      }],
    })).toEqual({
      available: [['Available', available]],
      unavailable: ['Missing'],
    });
  });

  it('should offer to install available peers and log unavailable peers', () => {
    const dependency: Mod = {
      plugin: [{ tag: 'plugin/available', config: { mod: 'Available' } }],
    };
    const target: Mod = {
      plugin: [{
        tag: 'plugin/community',
        config: {
          mod: 'Community',
          peerDependencies: ['Available', 'Missing'],
        },
      }],
    };
    service.mods.push(dependency);
    const install = vi.spyOn(service, 'install$').mockReturnValue(of(null));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const store = TestBed.inject(Store);
    store.eventBus.fire('install', {
      url: 'comment:community',
      title: 'Community',
      plugins: { 'plugin/mod': target },
    });

    expect(window.confirm).toHaveBeenCalledWith('Install peer dependencies?');
    expect(install.mock.calls.map(([name]) => name)).toEqual(['Available', 'Community']);
    expect(store.eventBus.unmetDependencies).toEqual(['Missing']);
  });

  it('should log available peer dependencies when installation is declined', () => {
    const dependency: Mod = {
      plugin: [{ tag: 'plugin/available', config: { mod: 'Available' } }],
    };
    const target: Mod = {
      plugin: [{
        tag: 'plugin/community',
        config: {
          mod: 'Community',
          peerDependencies: ['Available'],
        },
      }],
    };
    service.mods.push(dependency);
    vi.spyOn(service, 'install$').mockReturnValue(of(null));
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    const store = TestBed.inject(Store);
    store.eventBus.fire('install', {
      url: 'comment:community',
      title: 'Community',
      plugins: { 'plugin/mod': target },
    });

    expect(store.eventBus.unmetDependencies).toEqual(['Available']);
  });
});
