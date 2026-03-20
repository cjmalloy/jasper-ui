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
import { ExtService } from './api/ext.service';
import { PluginService } from './api/plugin.service';
import { RefService } from './api/ref.service';
import { TemplateService } from './api/template.service';
import { AdminService, equalBundle } from './admin.service';
import { Store } from '../store/store';
import { prefix } from '../util/tag';

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

  it('should create a mod ref containing the installed bundle with a receipt tag derived from the sanitized mod id', () => {
    const refs = TestBed.inject(RefService);
    const store = TestBed.inject(Store);
    store.account.origin = '@local';
    vi.spyOn(refs, 'get').mockReturnValue(throwError(() => ({ status: 404 })));
    const create = vi.spyOn(refs, 'create').mockReturnValue(of('ok'));

    service.logModReceipt$('Wiki', {
      template: [{ tag: '+config/wiki', name: 'Wiki' } as any],
    }, () => {}).subscribe();

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      url: 'internal:mod-receipt/wiki',
      origin: '@local',
      title: 'Wiki',
      tags: ['internal', prefix('plugin/mod/receipt', 'wiki')],
      plugins: {
        'plugin/mod': {
          template: [{ tag: '+config/wiki', name: 'Wiki' }],
        },
      },
    }));
  });

  it('should not preload mod refs during init', () => {
    const loadPlugins = vi.spyOn(service as any, 'loadPlugins$').mockReturnValue(of(null));
    const loadTemplates = vi.spyOn(service as any, 'loadTemplates$').mockReturnValue(of(null));
    const loadAllModRefs = vi.spyOn(service, 'loadAllModRefs$').mockReturnValue(of(null));

    service.init$.subscribe();

    expect(loadPlugins).toHaveBeenCalled();
    expect(loadTemplates).toHaveBeenCalled();
    expect(loadAllModRefs).not.toHaveBeenCalled();
  });

  it('should sanitize mod ids when generating receipt tags', () => {
    expect((service as any).getModReceiptTag('📔️ Wiki')).toBe('plugin/mod/receipt/wiki');
    expect((service as any).getModReceiptTag('AI Tools')).toBe('plugin/mod/receipt/ai.tools');
    expect((service as any).getModReceiptTag('Feature/API v2')).toBe('plugin/mod/receipt/feature.api.v2');
    expect((service as any).getModReceiptTag('!!!')).toBeUndefined();
  });

  it('should load all receipt refs in pages on setup', () => {
    const refs = TestBed.inject(RefService);
    const store = TestBed.inject(Store);
    store.account.origin = '@local';
    const page = vi.spyOn(refs, 'page').mockReturnValue(of({
      content: [
        {
          url: 'internal:11111111-1111-4111-8111-111111111111',
          origin: '@local',
          title: '📔️ Wiki',
          plugins: { 'plugin/mod': { plugin: [{ tag: 'plugin/wiki', config: { mod: '📔️ Wiki' } }] } },
        },
        {
          url: 'internal:22222222-2222-4222-8222-222222222222',
          origin: '@local',
          title: 'Obsolete',
          plugins: { 'plugin/mod': { plugin: [{ tag: 'plugin/obsolete', config: { mod: 'Obsolete' } }] } },
        },
        {
          url: 'internal:33333333-3333-4333-8333-333333333333',
          origin: '@local',
          title: '💬 Chat',
          plugins: { 'plugin/mod': { template: [{ tag: 'config/chat', config: { mod: '💬 Chat' } }] } },
        },
      ],
      page: { totalPages: 1 },
    } as any));

    service.loadAllModRefs$().subscribe();

    expect(page).toHaveBeenCalledWith({
      query: '@local:plugin/mod/receipt',
      page: 0,
      size: expect.any(Number),
      sort: ['modified,DESC'],
    });
    expect(service.status.receipts['📔️ Wiki']).toEqual(expect.objectContaining({ title: '📔️ Wiki' }));
    expect(service.status.receipts['💬 Chat']).toEqual(expect.objectContaining({ title: '💬 Chat' }));
    // All receipts are loaded (including ones for mods that are no longer active)
    expect(service.status.receipts.Obsolete).toEqual(expect.objectContaining({ title: 'Obsolete' }));
  });

  it('should load all receipt refs in pages for the default local origin', () => {
    const refs = TestBed.inject(RefService);
    const page = vi.spyOn(refs, 'page').mockReturnValue(of({
      content: [{
        url: 'internal:11111111-1111-4111-8111-111111111111',
        origin: '',
        title: 'Wiki',
        plugins: { 'plugin/mod': { template: [{ tag: 'config/wiki', config: { mod: 'Wiki' } }] } },
      }],
      page: { totalPages: 1 },
    } as any));

    service.loadAllModRefs$().subscribe();

    expect(page).toHaveBeenCalledWith({
      query: '*:plugin/mod/receipt',
      page: 0,
      size: expect.any(Number),
      sort: ['modified,DESC'],
    });
    expect(service.status.receipts.Wiki).toEqual(expect.objectContaining({ title: 'Wiki' }));
  });

  it('should ignore extra live entries that share a mod id but are not in the installed receipt', () => {
    service.status.plugins['plugin/wiki'] = {
      tag: 'plugin/wiki',
      origin: '@local',
      config: { mod: 'Wiki', version: 1 },
    } as any;
    service.status.plugins['plugin/wiki-extra'] = {
      tag: 'plugin/wiki-extra',
      origin: '@local',
      config: { mod: 'Wiki', version: 1 },
    } as any;
    service.status.receipts.Wiki = {
      url: 'internal:22222222-2222-4222-8222-222222222222',
      origin: '@local',
      plugins: {
        'plugin/mod': {
          plugin: [{
            tag: 'plugin/wiki',
            config: { mod: 'Wiki', version: 1 },
          }],
        },
      },
    } as any;

    expect(service.getCurrentMod('Wiki').plugin?.map(plugin => plugin.tag)).toEqual(['plugin/wiki']);
  });

  it('should compare plugin-only receipts without treating empty template arrays as modifications', () => {
    const bundle = {
      plugin: [{
        tag: 'plugin/mod',
        name: '🎁️ Mod',
        schema: { optionalProperties: { tag: { type: 'string' } } },
        config: { mod: '🎁️ Store', version: 1 },
      }],
    };
    service.status.plugins['plugin/mod'] = {
      tag: 'plugin/mod',
      origin: '@local',
      name: '🎁️ Mod',
      config: { mod: '🎁️ Store', version: 1 },
    } as any;
    service.status.receipts['🎁️ Store'] = {
      url: 'internal:33333333-3333-4333-8333-333333333333',
      title: '🎁️ Store',
      origin: '@local',
      plugins: { 'plugin/mod': bundle },
    } as any;

    expect(equalBundle(service.getCurrentMod('🎁️ Store'), service.getInstalledMod('🎁️ Store'))).toBe(true);
  });

  it('should preserve installed plugin fields when current status only contains live editable data', () => {
    service.status.plugins['plugin/mod'] = {
      tag: 'plugin/mod',
      origin: '@local',
      name: '🎁️ Mod',
      config: { mod: '🎁️ Store', version: 1 },
    } as any;
    service.status.receipts['🎁️ Store'] = {
      url: 'internal:55555555-5555-4555-8555-555555555555',
      title: '🎁️ Store',
      origin: '@local',
      plugins: {
        'plugin/mod': {
          plugin: [{
            tag: 'plugin/mod',
            name: '🎁️ Mod',
            schema: { optionalProperties: { tag: { type: 'string' } } },
            defaults: { demo: true },
            config: { mod: '🎁️ Store', version: 1 },
          }],
        },
      },
    } as any;

    expect(service.getCurrentMod('🎁️ Store')).toEqual(expect.objectContaining({
      plugin: [expect.objectContaining({
        tag: 'plugin/mod',
        schema: { optionalProperties: { tag: { type: 'string' } } },
        defaults: { demo: true },
      })],
    }));
    expect(equalBundle(service.getCurrentMod('🎁️ Store'), service.getInstalledMod('🎁️ Store'))).toBe(true);
  });

  it('should clear loaded mod refs by exact mod id when deleting a mod', () => {
    const refs = TestBed.inject(RefService);
    const remove = vi.spyOn(refs, 'delete').mockReturnValue(of(void 0));
    service.status.receipts['📔️ Wiki'] = {
      url: 'internal:44444444-4444-4444-8444-444444444444',
      title: '📔️ Wiki',
      origin: '@local',
      plugins: { 'plugin/mod': { template: [{ tag: 'config/wiki', config: { mod: '📔️ Wiki' } }] } },
    } as any;

    service.deleteMod$('📔️ Wiki', () => {}).subscribe();

    expect(remove).toHaveBeenCalledWith('internal:44444444-4444-4444-8444-444444444444', '@local');
    expect(service.status.receipts['📔️ Wiki']).toBeUndefined();
  });

  it('should call init$ and logDefaultReceipts$ exactly once even with multiple default plugin installs', () => {
    const store = TestBed.inject(Store);
    const exts = TestBed.inject(ExtService);
    const plugins = TestBed.inject(PluginService);
    const templates = TestBed.inject(TemplateService);

    // Set up first-run conditions: admin user, no existing ext, no installed plugins/templates
    store.account.admin = true;
    store.account.ext = undefined;

    // Mock the API calls so no HTTP requests are made
    vi.spyOn(exts, 'create').mockReturnValue(of({} as any));
    vi.spyOn(plugins, 'create').mockReturnValue(of({} as any));
    vi.spyOn(templates, 'create').mockReturnValue(of({} as any));

    // Spy on the private helpers that init$ delegates to, to count invocations
    const loadPlugins = vi.spyOn(service as any, 'loadPlugins$').mockReturnValue(of(null));
    const loadTemplates = vi.spyOn(service as any, 'loadTemplates$').mockReturnValue(of(null));
    const logDefaultReceipts = vi.spyOn(service as any, 'logDefaultReceipts$').mockReturnValue(of(null));

    // Confirm there are multiple default plugins/templates to install (makes the regression meaningful)
    expect(service.defaultPlugins.length).toBeGreaterThan(1);

    service.firstRun$.subscribe();

    // init$ (and therefore loadPlugins$/loadTemplates$) must be invoked exactly once
    expect(loadPlugins).toHaveBeenCalledTimes(1);
    expect(loadTemplates).toHaveBeenCalledTimes(1);
    // logDefaultReceipts$ must also be invoked exactly once
    expect(logDefaultReceipts).toHaveBeenCalledTimes(1);
  });

});
