/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { llmPlugin } from '../mods/ai/ai';
import { blogTemplate } from '../mods/blog';
import { scrapePlugin } from '../mods/sync/scrape';
import { userTemplate } from '../mods/user';
import { PluginService } from './api/plugin.service';
import { RefService } from './api/ref.service';
import { AdminService } from './admin.service';
import { Store } from '../store/store';
import { TemplateService } from './api/template.service';

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
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

  it('should create a mod ref containing the installed bundle', () => {
    const refs = TestBed.inject(RefService);
    const plugins = TestBed.inject(PluginService);
    const store = TestBed.inject(Store);
    store.account.origin = '@local';
    vi.spyOn(refs, 'get').mockReturnValue(throwError(() => ({ status: 404 })));
    const create = vi.spyOn(refs, 'create').mockReturnValue(of('ok'));
    vi.spyOn(plugins, 'delete').mockReturnValue(of(undefined));
    vi.spyOn(plugins, 'create').mockReturnValue(of(undefined));

    service.install$('Wiki', {
      plugin: [{ tag: 'plugin/wiki', name: 'Wiki' } as any],
    }, () => {}).subscribe();

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      url: 'mod:Wiki',
      origin: '@local',
      title: 'Wiki',
      tags: ['public', 'plugin/mod'],
      plugins: {
        'plugin/mod': {
          plugin: [{ tag: 'plugin/wiki', name: 'Wiki' }],
        },
      },
    }));
  });

  it('should flag locally edited mods using the installed mod ref bundle', () => {
    service.status.plugins['plugin/wiki'] = {
      tag: 'plugin/wiki',
      origin: '@local',
      config: { mod: 'Wiki', version: 2, description: 'edited' },
    } as any;
    service.status.modRefs.Wiki = {
      url: 'mod:Wiki',
      origin: '@local',
      plugins: {
        'plugin/mod': {
          plugin: [{
            tag: 'plugin/wiki',
            config: { mod: 'Wiki', version: 2 },
          }],
        },
      },
    } as any;

    expect(service.isModModified('Wiki')).toBe(true);
  });

  it('should ignore plugin order when comparing installed bundles', () => {
    service.status.plugins['plugin/one'] = { tag: 'plugin/one', origin: '@local', config: { mod: 'Wiki' } } as any;
    service.status.plugins['plugin/two'] = { tag: 'plugin/two', origin: '@local', config: { mod: 'Wiki' } } as any;
    service.status.modRefs.Wiki = {
      url: 'mod:Wiki',
      origin: '@local',
      plugins: {
        'plugin/mod': {
          plugin: [
            { tag: 'plugin/two', config: { mod: 'Wiki' } },
            { tag: 'plugin/one', config: { mod: 'Wiki' } },
          ],
        },
      },
    } as any;

    expect(service.isModModified('Wiki')).toBe(false);
  });

  it('should treat mods without an installed mod ref as unmodified in setup status', () => {
    service.mods.unshift({
      plugin: [{ tag: 'plugin/wiki', config: { mod: 'Wiki', version: 2 } } as any],
    });
    service.status.plugins['plugin/wiki'] = {
      tag: 'plugin/wiki',
      origin: '@local',
      config: { mod: 'Wiki', version: 1, description: 'edited' },
    } as any;

    expect(service.isModModified('Wiki')).toBe(false);
  });

  it('should require review when local edits exist without a stored mod ref', () => {
    service.mods.unshift({
      plugin: [{ tag: 'plugin/wiki', config: { mod: 'Wiki', version: 2 } } as any],
    });
    service.status.plugins['plugin/wiki'] = {
      tag: 'plugin/wiki',
      origin: '@local',
      config: { mod: 'Wiki', version: 1, description: 'edited' },
    } as any;

    expect(service.getModUpdatePreview('Wiki')).toEqual(expect.objectContaining({
      needsReview: true,
      conflict: true,
      reason: 'missing-base',
    }));
  });

  it('should merge admin edits into the updated mod bundle when a stored base exists', () => {
    service.mods.unshift({
      plugin: [{ tag: 'plugin/wiki', config: { mod: 'Wiki', version: 2 } } as any],
    });
    service.status.plugins['plugin/wiki'] = {
      tag: 'plugin/wiki',
      origin: '@local',
      config: { mod: 'Wiki', version: 1, description: 'edited' },
    } as any;
    service.status.modRefs.Wiki = {
      url: 'mod:Wiki',
      origin: '@local',
      plugins: {
        'plugin/mod': {
          plugin: [{ tag: 'plugin/wiki', config: { mod: 'Wiki', version: 1 } }],
        },
      },
    } as any;

    expect(service.getModUpdatePreview('Wiki')).toEqual(expect.objectContaining({
      needsReview: false,
      conflict: false,
      proposed: expect.objectContaining({
        plugin: [expect.objectContaining({ tag: 'plugin/wiki', config: { mod: 'Wiki', version: 2, description: 'edited' } })],
      }),
    }));
  });

  it('should reconcile plugin and template changes when applying a mod update', () => {
    const refs = TestBed.inject(RefService);
    const templates = TestBed.inject(TemplateService);
    const store = TestBed.inject(Store);
    store.account.origin = '@local';
    service.status.plugins['plugin/wiki'] = { tag: 'plugin/wiki', origin: '@local', config: { mod: 'Wiki' } } as any;
    vi.spyOn(refs, 'get').mockReturnValue(throwError(() => ({ status: 404 })));
    vi.spyOn(refs, 'create').mockReturnValue(of('ok'));
    const deletePlugin = vi.spyOn(service, 'deletePlugin$').mockReturnValue(of(null));
    const installTemplate = vi.spyOn(service, 'installTemplate$').mockReturnValue(of(null));
    vi.spyOn(templates, 'delete').mockReturnValue(of(null as any));
    vi.spyOn(templates, 'create').mockReturnValue(of(undefined));

    service.applyModUpdate$('Wiki', {
      template: [{ tag: 'config/wiki', config: { mod: 'Wiki' } } as any],
    }, {
      template: [{ tag: 'config/wiki', config: { mod: 'Wiki' } } as any],
    }, () => {}).subscribe();

    expect(deletePlugin).toHaveBeenCalled();
    expect(installTemplate).toHaveBeenCalled();
  });
});
