/// <reference types="vitest/globals" />
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { llmPlugin } from '../mods/ai/ai';
import { blogTemplate } from '../mods/blog';
import { jezzballMod } from '../mods/games/jezzball';
import { durationPlugin } from '../mods/media/duration';
import { cachePlugin } from '../mods/system/cache';
import { scrapePlugin } from '../mods/sync/scrape';
import { userTemplate } from '../mods/user';
import { ORIGIN_WILDCARD_REGEX, TAG_ORIGIN_SELECTOR_REGEX } from '../util/format';
import { defer, firstValueFrom, of, Subject, throwError } from 'rxjs';
import { Store } from '../store/store';
import { AdminService, hotIndexSuggestions } from './admin.service';
import { PluginService } from './api/plugin.service';
import { TemplateService } from './api/template.service';
import { ConfigService } from './config.service';

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

  it.each([
    ['_config/security', 'per origin'],
    ['_config/server', 'global'],
  ])('should add maxRequestsPeriod after maxRequests in %s', (tag, scope) => {
    const form = service.getTemplateAdminForm(tag);
    const keys = form.map(f => f.key);
    const index = keys.indexOf('maxRequests');
    expect(index).toBeGreaterThanOrEqual(0);
    expect(keys[index + 1]).toBe('maxRequestsPeriod');
    expect(form[index].props?.label).toContain(scope);
    const period = form[index + 1];
    expect(period.type).toBe('duration');
    expect(period.props?.hint).toContain('unlimited');
    expect(period.props?.datalist.map((o: any) => o.value)).toEqual(
      expect.arrayContaining(['PT0.0000005S', 'PT0.1S', 'PT1S', 'PT10S', 'PT1M', 'PT1H']));
  });

  it('should not install default mods when installDefaults is disabled', async () => {
    TestBed.inject(ConfigService).installDefaults = false;
    TestBed.inject(Store).account.admin = true;
    const create = vi.spyOn(TestBed.inject(PluginService), 'create');
    await firstValueFrom(service.firstRun$);
    expect(create).not.toHaveBeenCalled();
  });

  it('should install default mods for an admin on an empty origin', () => {
    TestBed.inject(Store).account.admin = true;
    const create = vi.spyOn(TestBed.inject(PluginService), 'create').mockReturnValue(of(null as any));
    service.firstRun$;
    expect(create).toHaveBeenCalled();
  });

  it('should load defaults after installing default mods', () => {
    const store = TestBed.inject(Store);
    store.account.admin = true;
    const calls: string[] = [];
    vi.spyOn(TestBed.inject(PluginService), 'create').mockImplementation(() => defer(() => {
      calls.push('install');
      return of(null as any);
    }));
    vi.spyOn(TestBed.inject(TemplateService), 'create').mockImplementation(() => defer(() => {
      calls.push('install');
      return of(null as any);
    }));
    store.eventBus.events.subscribe(({ event }) => {
      if (event === '*:defaults') calls.push('defaults');
    });
    vi.spyOn(service, 'init$', 'get').mockReturnValue(of(null));
    service.firstRun$.subscribe();
    expect(calls.length).toBeGreaterThan(1);
    expect(calls.indexOf('defaults')).toBe(calls.length - 1);
  });

  it('should only list PDF embeds that will embed', () => {
    (service as any).updateStatus((status: any) => {
      status.plugins['plugin/pdf'] = { tag: 'plugin/pdf', config: { embeddable: true, proxy: false } };
    });
    const external = { url: 'https://example.com/paper.pdf', tags: ['plugin/pdf/scanned'] };
    const cached = { url: 'cache:abc', tags: ['plugin/pdf/scanned'] };
    expect(service.getEmbeds(external)).toEqual([]);
    expect(service.getEmbeds(cached)).toEqual(['plugin/pdf/scanned']);
    (service as any).updateStatus((status: any) => {
      status.plugins['plugin/pdf'] = { tag: 'plugin/pdf', config: { embeddable: true, proxy: true } };
    });
    expect(service.getEmbeds(external)).toEqual(['plugin/pdf/scanned']);
  });

  it('should only embed external PDF URLs through the proxy', () => {
    (service as any).updateStatus((status: any) => {
      status.plugins['plugin/pdf'] = { tag: 'plugin/pdf', config: { embeddable: true, proxy: false, extensions: ['.pdf'] } };
    });
    expect(service.getEmbedPluginsForUrl('https://example.com/paper.pdf')).toEqual([]);
    (service as any).updateStatus((status: any) => {
      status.plugins['plugin/pdf'] = { tag: 'plugin/pdf', config: { embeddable: true, proxy: true, extensions: ['.pdf'] } };
    });
    expect(service.getEmbedPluginsForUrl('https://example.com/paper.pdf').map(p => p.tag)).toEqual(['plugin/pdf']);
  });

  it('should map recipients to their Template signature', () => {
    (service as any).updateStatus((status: any) => {
      status.templates['support'] = { tag: 'support', config: { signature: '+support' } };
    });
    expect(service.recipientSignature('support')).toBe('+support');
    expect(service.recipientSignature('support@tenant')).toBe('+support@tenant');
    expect(service.recipientSignature('other@tenant')).toBe('other@tenant');
  });

  it('should name recipients without an Ext after their Template', async () => {
    (service as any).updateStatus((status: any) => {
      status.templates['support'] = { tag: 'support', name: 'Support', config: { signature: '+support' } };
    });
    const xs = await firstValueFrom(of([
      { tag: '+support', origin: '@tenant', name: '' },
      { tag: 'other', origin: '@tenant', name: '' },
    ]).pipe(service.recipientFallback));
    expect(xs.map(x => x.name)).toEqual(['Support', undefined]);
  });

  it('should not inherit template admin forms', () => {
    (service as any).updateStatus((status: any) => {
      status.templates['parent'] = { tag: 'parent', config: { adminForm: [{ key: 'a' }], advancedAdminForm: [{ key: 'b' }] } };
      status.templates['parent/child'] = { tag: 'parent/child', config: { adminForm: [{ key: 'c' }] } };
    });
    expect(service.getTemplateAdminForm('parent/child').map(f => f.key)).toEqual(['c']);
    expect(service.getTemplateAdminForm('parent/child', 'advancedAdminForm')).toEqual([]);
    expect(service.getTemplateAdminForm('parent', 'advancedAdminForm').map(f => f.key)).toEqual(['b']);
  });

  it('should suggest hot tags and hot plugins from mods in every origin', async () => {
    const page = <T>(content: T[], number: number, totalPages: number) => of({
      content, page: { number, size: content.length, totalElements: 0, totalPages },
    });
    const pluginPage = vi.spyOn(TestBed.inject(PluginService), 'page').mockImplementation(args => args.page === 0
      ? page([{ ...durationPlugin, origin: '@a' }], 0, 2)
      : page([{ ...cachePlugin, origin: '@b' }, ...jezzballMod.plugin!], 1, 2));
    vi.spyOn(TestBed.inject(TemplateService), 'page').mockReturnValue(page([], 0, 1));
    expect(await firstValueFrom(service.hotIndexSuggestions$())).toEqual({
      tags: ['plugin/duration:dur'],
      plugins: ['_plugin/cache->contentLength:num', 'plugin/score:num'],
      responses: [],
      remoteResponses: [],
    });
    expect(pluginPage.mock.calls.map(([args]) => [args.query, args.page])).toEqual([['@*', 0], ['@*', 1]]);
    const [hotTags, hotPlugins] = service.getTemplateAdminForm('_config/index').slice(-4);
    expect(await firstValueFrom((hotTags.fieldArray as any).props.suggestions(service))).toEqual(['plugin/duration:dur']);
    expect(await firstValueFrom((hotPlugins.fieldArray as any).props.suggestions(service))).toEqual(['_plugin/cache->contentLength:num', 'plugin/score:num']);
  });

  it('should suggest hot responses from response count sorts', () => {
    expect(hotIndexSuggestions([
      { tag: 'plugin/comment', config: { sorts: [{ sort: 'metadata->remotePlugins->plugin/comment' }] } },
      { tag: 'plugin/thread', config: { sorts: [{ sort: 'metadata->plugins->plugin/thread:num' }, { sort: 'metadata->newResponse' }] } },
    ] as any, [])).toEqual({ tags: [], plugins: [], responses: ['plugin/thread'], remoteResponses: ['plugin/comment'] });
  });

  it('should suggest hot indexes from field filters', () => {
    expect(hotIndexSuggestions([
      { tag: 'plugin/test', config: { filters: [{ field: 'plugins->plugin/test->status', equals: 'open' }, { field: 'tags->plugin/status', equals: 'done' }] } },
    ] as any, [])).toEqual({ tags: ['plugin/status'], plugins: ['plugin/test->status'], responses: [], remoteResponses: [] });
  });

  it('should scan for hot index suggestions again each time the form opens', async () => {
    const empty = of({ content: [], page: { number: 0, size: 0, totalElements: 0, totalPages: 1 } });
    const pluginPage = vi.spyOn(TestBed.inject(PluginService), 'page').mockReturnValueOnce(throwError(() => 'offline')).mockReturnValue(empty as any);
    vi.spyOn(TestBed.inject(TemplateService), 'page').mockReturnValue(empty as any);
    expect(await firstValueFrom(service.hotIndexSuggestions$())).toEqual({ tags: [], plugins: [], responses: [], remoteResponses: [] });
    pluginPage.mockReturnValue(of({ content: [durationPlugin], page: { number: 0, size: 1, totalElements: 1, totalPages: 1 } }) as any);
    expect(await firstValueFrom(service.hotIndexSuggestions$())).toEqual({ tags: ['plugin/duration:dur'], plugins: [], responses: [], remoteResponses: [] });
    expect(pluginPage).toHaveBeenCalledTimes(2);
  });

  it('should share one hot index scan between fields rendered together', async () => {
    const pages = new Subject<any>();
    const pluginPage = vi.spyOn(TestBed.inject(PluginService), 'page').mockReturnValue(pages);
    vi.spyOn(TestBed.inject(TemplateService), 'page').mockReturnValue(of({ content: [], page: { number: 0, size: 0, totalElements: 0, totalPages: 1 } }) as any);
    const both = Promise.all([firstValueFrom(service.hotIndexSuggestions$()), firstValueFrom(service.hotIndexSuggestions$())]);
    pages.next({ content: [durationPlugin], page: { number: 0, size: 1, totalElements: 1, totalPages: 1 } });
    pages.complete();
    expect((await both)[1].tags).toEqual(['plugin/duration:dur']);
    expect(pluginPage).toHaveBeenCalledTimes(1);
  });

  it('should fall back to hard coded config admin forms', () => {
    expect(service.getTemplateAdminForm('_config/index').map(f => f.key)).toEqual([
      'tags', 'sources', 'alts', 'responses', 'internalResponses', 'fulltext', 'published', 'modified', 'created', 'title', 'origin', 'newResponse', 'newReaction',
      'ignored', 'cascade', 'regen', 'hotTags', 'hotPlugins', 'hotResponses', 'hotRemoteResponses',
    ]);
    expect(service.getTemplateAdminForm('_config/security').map(f => f.key)).toContain('minRole');
    expect(service.getTemplateAdminForm('_config/server').map(f => f.key)).toContain('scriptSelectors');
    expect(service.getTemplateAdminForm('_config/server/worker').map(f => f.key)).toContain('scriptSelectors');
    expect(service.getTemplateAdminForm('_config/server', 'advancedAdminForm')).toEqual([]);
    expect(service.getTemplateAdminForm('_config/other')).toEqual([]);
    (service as any).updateStatus((status: any) => {
      status.templates['_config/server'] = { tag: '_config/server', config: { adminForm: [{ key: 'a' }] } };
    });
    expect(service.getTemplateAdminForm('_config/server').map(f => f.key)).toEqual(['a']);
  });

  it('should allow wildcard web origins in the server config fallback form', () => {
    const webOrigins = service.getTemplateAdminForm('_config/server').find(f => f.key === 'webOrigins')!;
    expect(webOrigins.type).toBe('originSelectorList');
    for (const value of ['', '@', '@*', '@company', '@company.*', '@a.b.*']) {
      expect(ORIGIN_WILDCARD_REGEX.test(value)).toBe(true);
    }
    for (const value of ['*', '@.*', '@company.', '@company*', 'company']) {
      expect(ORIGIN_WILDCARD_REGEX.test(value)).toBe(false);
    }
  });

  it('should allow wildcard origins but not negation in script selectors in the server config fallback form', () => {
    const scriptSelectors = service.getTemplateAdminForm('_config/server').find(f => f.key === 'scriptSelectors')!;
    expect(scriptSelectors.type).toBe('tagOriginSelectors');
    for (const value of ['', '@', '@origin', 'plugin/script', 'plugin/script@', 'plugin/script@a.b', '+plugin/cron@origin',
      '@*', '@origin.*', '@a.b.*', 'plugin/script@*', '_plugin/delta/scrape@navi.*']) {
      expect(TAG_ORIGIN_SELECTOR_REGEX.test(value)).toBe(true);
    }
    for (const value of ['*', 'plugin/*', '@.*', '@origin*', '@origin.', '@*.origin', '!plugin/script', '!@origin', '@.origin']) {
      expect(TAG_ORIGIN_SELECTOR_REGEX.test(value)).toBe(false);
    }
  });

  it('should include a markdown editor for ai instructions in built-in mods', () => {
    expect(userTemplate.config?.adminForm?.find(f => f.key === 'aiInstructions')?.type).toBe('editor');
  });

  it('should keep formly expressions serializable for built-in mods', () => {
    expect(userTemplate.config?.form?.find(f => f.key === 'subscriptions')?.expressions?.hide).toBe('!formState.admin.hasHome');
    expect(blogTemplate.config?.form?.find(f => f.key === 'tags')?.expressions?.hide).toBe('!field.parent.model.filterTags');
    expect(llmPlugin.config?.advancedForm?.find(f => f.key === 'bundle')?.expressions?.hide).toBe('!model.json');
    expect(scrapePlugin.config?.form?.find(f => f.key === 'textSelectors')?.expressions?.hide).toBe('!field.parent.model.text');
  });

  it('should not mutate installed plugin icons or buttons', () => {
    const icon = { label: '🧪️' };
    const button = { label: '🧪️', ribbon: true };
    (service as any).updateStatus((status: any) => status.plugins['plugin/test'] = {
      tag: 'plugin/test',
      name: 'Test',
      config: { icons: [icon], editorButtons: [button] },
    });
    const icons = service.getIcons(['plugin/test']);
    expect(icons.length).toBe(1);
    expect(icons[0].tag).toBe('plugin/test');
    expect(icons[0].title).toBe('Test');
    expect(icons[0]._parent?.tag).toBe('plugin/test');
    expect(icon).toEqual({ label: '🧪️' });
    const buttons = service.getEditorButtons(['plugin/test']);
    expect(buttons[0].toggle).toBe('plugin/test');
    expect(button).toEqual({ label: '🧪️', ribbon: true });
  });
});
